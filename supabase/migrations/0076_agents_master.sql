-- The Agents master (spec v2).
--
-- v2 is explicit: every agent lives here "and only here", and no agent is
-- kept in Parties. Checking the data first changed what this migration has
-- to do: ZERO parties carry the 'Agent' role, so there is no population to
-- migrate out. What exists instead is two bookings whose agent columns point
-- at customers -- AHUJA MARBLE STONEX, AARK GLOBALEX, 7 WORLD STONA -- picked
-- from a list of all 230 parties because the agent picker never filtered.
-- That is defect M4 showing up as data. Those references are left alone here
-- and dealt with once real agents exist to point at.
--
-- Shape: company, branches, contacts, documents. v2 asks for this across all
-- four new masters because several supplied rows are one company at many
-- sites (SAI Marine at three ports, Transworld at two). One row per company,
-- not per site.

create table if not exists public.agents (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null default default_tenant_id() references public.tenants(id) on delete cascade,

  code        text unique,
  name        text not null,
  country     text,
  tax_id      text,
  ports_covered text[] not null default '{}',

  -- An agent starts Inactive. v2: it cannot be made Active without its
  -- required documents, so Active is something a person grants, never a
  -- default an import hands out.
  status      text not null default 'Inactive' check (status in ('Active', 'Inactive')),

  -- Sanctions screening. Four of the seven supplied agents are Iranian or
  -- Iran-connected, which is why v2 asks for this at all. A booking must not
  -- be approved against a Blocked agent.
  compliance_status     text not null default 'Not screened'
                        check (compliance_status in ('Not screened', 'Cleared', 'Blocked')),
  compliance_checked_at date,
  compliance_note       text,

  -- v2: some overseas agents settle through their own bank, and for those the
  -- portal hides Pay now and staff mark the invoice paid instead.
  pays_via_other_bank boolean not null default false,

  bank_name    text,
  bank_account text,
  bank_ifsc    text,
  bank_swift   text,

  sales_person text,

  -- Carried from the supplied CSV. The importer never guesses: a row whose
  -- country was inferred or whose contact details are buried in the address
  -- arrives flagged, and a person clears it.
  review_status text not null default 'Needs review'
                check (review_status in ('Ready', 'Needs review')),
  review_note   text,
  source_ref    text,

  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_branches (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references public.agents(id) on delete cascade,
  label       text,
  address_raw text,
  address_line text,
  city        text,
  state       text,
  country     text,
  postal_code text,
  location_code text,
  working_hours text,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- v2: phone numbers, emails and contact names sit inside address text today;
-- each record gets a Contacts list instead. The address is still kept whole
-- in address_raw, so nothing is lost when a person splits it out.
create table if not exists public.agent_contacts (
  id        uuid primary key default gen_random_uuid(),
  agent_id  uuid not null references public.agents(id) on delete cascade,
  branch_id uuid references public.agent_branches(id) on delete set null,
  name      text,
  role      text,
  email     text,
  phone     text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_documents (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.agents(id) on delete cascade,
  doc_type     text not null,
  storage_path text,
  issued_on    date,
  expires_on   date,
  uploaded_by  text,
  uploaded_at  timestamptz not null default now()
);

create index if not exists agent_branches_agent_idx on public.agent_branches (agent_id);
create index if not exists agent_contacts_agent_idx on public.agent_contacts (agent_id);
create index if not exists agent_documents_agent_idx on public.agent_documents (agent_id);
create index if not exists agents_status_idx on public.agents (status);

-- A used agent is never hard-deleted.
-- v2: a record already used on a booking or CRO cannot be deleted; it is
-- marked Inactive and stays on past records. Enforced here rather than in the
-- app, because the app is not the only thing that can issue a DELETE.
create or replace function public.guard_agent_delete()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if exists (
    select 1 from public.bookings b
     where b.origin_agent_id = old.id::text
        or b.destination_agent_id = old.id::text
  ) then
    raise exception
      'Agent % is used on a booking and cannot be deleted. Mark it Inactive instead.',
      old.name
      using errcode = 'restrict_violation';
  end if;
  return old;
end
$$;

create trigger agents_guard_delete
before delete on public.agents
for each row execute function public.guard_agent_delete();

-- Shared master, same as parties and ports (migration 0060).
-- Identity data is shared by both companies; terms, credit and bookings stay
-- per company and are never visible to the other.
alter table public.agents          enable row level security;
alter table public.agent_branches  enable row level security;
alter table public.agent_contacts  enable row level security;
alter table public.agent_documents enable row level security;

create policy "shared master readable" on public.agents
  for select using (is_member_of_any());
create policy "write agents" on public.agents
  for all using (tenant_id = auth_tenant_id() and can_write_masters())
  with check (tenant_id = auth_tenant_id() and can_write_masters());

create policy "read agent branches" on public.agent_branches
  for select using (is_member_of_any());
create policy "write agent branches" on public.agent_branches
  for all using (can_write_masters()) with check (can_write_masters());

create policy "read agent contacts" on public.agent_contacts
  for select using (is_member_of_any());
create policy "write agent contacts" on public.agent_contacts
  for all using (can_write_masters()) with check (can_write_masters());

create policy "read agent documents" on public.agent_documents
  for select using (is_member_of_any());
create policy "write agent documents" on public.agent_documents
  for all using (can_write_masters()) with check (can_write_masters());

create trigger agents_audit
after insert or update or delete on public.agents
for each row execute function public.audit_row_change();

create trigger agent_branches_audit
after insert or update or delete on public.agent_branches
for each row execute function public.audit_row_change();

create trigger agent_contacts_audit
after insert or update or delete on public.agent_contacts
for each row execute function public.audit_row_change();

create trigger agent_documents_audit
after insert or update or delete on public.agent_documents
for each row execute function public.audit_row_change();
