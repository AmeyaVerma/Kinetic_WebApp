-- An agent login can now be an AGENT (spec v2).
--
-- Migration 0074 gave every portal login a party_id referencing `parties`. v2
-- then moved agents out of Parties into their own master, which left the
-- agent portal with no way to say who it speaks for: the only thing an agent
-- login could be linked to was a customer. Found while setting up the first
-- agent test login -- the link form offered parties and nothing else.
--
-- A portal account now points at EITHER a party (customer) OR an agent, and
-- the check constraint says exactly one.
--
-- WHAT AN AGENT SEES, per v2: "shipments where they are the POD Agent, plus
-- bookings they created." The old policy compared origin_agent_id and
-- destination_agent_id to a party id -- text columns that still hold PARTY
-- uuids on two bookings (defect M4), so it could only ever have matched
-- customers. It now reads pod_agent_id, the typed column migration 0087 added,
-- and the bookings the agent raised through a booking request.
--
-- Invoices: an agent sees none yet. v2 says an agent sees "invoices addressed
-- to them", and that needs the bill-to party chosen on the booking, which is
-- not built; showing none is the safe direction to be wrong in.

alter table public.portal_accounts
  add column if not exists agent_id uuid references public.agents(id) on delete cascade;

alter table public.portal_accounts alter column party_id drop not null;

alter table public.portal_accounts drop constraint if exists portal_accounts_one_identity;
alter table public.portal_accounts add constraint portal_accounts_one_identity
  check (
    (kind = 'customer' and party_id is not null and agent_id is null)
    or (kind = 'agent' and agent_id is not null and party_id is null)
  );

create index if not exists portal_accounts_agent_idx on public.portal_accounts (agent_id);

create or replace function public.portal_agent_id()
returns uuid
language sql stable security definer set search_path to 'public'
as $fn$
  select pa.agent_id from public.portal_accounts pa
   where pa.user_id = auth.uid() and pa.tenant_id = public.auth_tenant_id()
$fn$;

-- One definition of "this portal user may see this booking", used by every
-- child-table policy, so the rule is changed in exactly one place.
create or replace function public.portal_can_see_booking(b_id uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $fn$
  select exists (
    select 1 from public.bookings b
     where b.id = b_id
       and b.tenant_id = public.auth_tenant_id()
       and (
         (public.portal_kind() = 'customer'
            and b.booking_party_id = public.portal_party_id()::text)
         or (public.portal_kind() = 'agent'
            and (
              b.pod_agent_id = public.portal_agent_id()
              or exists (
                select 1 from public.booking_requests r
                 where r.booking_id = b.id and r.agent_id = public.portal_agent_id()
              )
            ))
       )
  )
$fn$;

drop policy if exists "portal reads its own bookings" on public.bookings;
create policy "portal reads its own bookings" on public.bookings
  for select using (portal_can_see_booking(id));
