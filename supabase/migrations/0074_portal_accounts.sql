-- Who a portal login actually is.
--
-- The external portal scoped a customer's shipments by comparing the booking
-- party's *name* to a `scopeName` field on the signed-in user -- a field
-- nothing ever populated. So the portal matched nothing real; what it showed
-- was the seeded demo bookings held in browser memory. Meanwhile
-- can_read_nvocc() excludes 'customer' and 'agent', so a portal user reading
-- the database directly got zero rows. The portal has never shown a real
-- shipment to anybody.
--
-- This table gives a portal login an identity: the party it speaks for. The
-- spec is explicit that a portal account belongs to one company -- a customer
-- of both Kinetic and RKS gets a separate login for each -- so the row is
-- per tenant, and the unique constraint enforces exactly that.

create table if not exists public.portal_accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  -- A customer sees bookings they placed; an agent sees bookings they handle
  -- at origin or destination. Different question, so the kind is recorded
  -- rather than guessed from the profile role.
  kind       text not null check (kind in ('customer', 'agent')),
  party_id   uuid not null references public.parties(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by text,
  unique (user_id, tenant_id)
);

create index if not exists portal_accounts_user_idx  on public.portal_accounts (user_id);
create index if not exists portal_accounts_party_idx on public.portal_accounts (party_id);

-- The two questions every portal policy asks.
-- SECURITY DEFINER because the policies below are what guard this table's
-- own visibility; a policy that had to read the table through RLS to decide
-- whether you may read the table is a loop.

create or replace function public.portal_party_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select pa.party_id
    from public.portal_accounts pa
   where pa.user_id = auth.uid()
     and pa.tenant_id = public.auth_tenant_id()
$$;

create or replace function public.portal_kind()
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select pa.kind
    from public.portal_accounts pa
   where pa.user_id = auth.uid()
     and pa.tenant_id = public.auth_tenant_id()
$$;

alter table public.portal_accounts enable row level security;

-- A portal user may read their own row -- the portal needs to know who it is
-- speaking for -- and nobody else's. Admins manage them.
create policy "read own portal account" on public.portal_accounts
  for select using (user_id = auth.uid() or is_admin());

create policy "admins manage portal accounts" on public.portal_accounts
  for all using (is_admin()) with check (is_admin());

create trigger portal_accounts_audit
after insert or update or delete on public.portal_accounts
for each row execute function public.audit_row_change();

-- Scoped reads, enforced here rather than in the browser.
-- Postgres ORs permissive policies together, so this sits alongside the
-- staff policy without widening it: staff keep can_read_nvocc(), and a
-- portal user -- who fails that test -- gets exactly their own rows.
--
-- The spec's H12 asks for this to be tested directly against the database,
-- not through the UI, which is the only way to know it is real.

create policy "portal reads its own bookings" on public.bookings
  for select using (
    tenant_id = auth_tenant_id()
    and (
      (portal_kind() = 'customer' and booking_party_id = portal_party_id()::text)
      or (
        portal_kind() = 'agent'
        and (
          origin_agent_id = portal_party_id()::text
          or destination_agent_id = portal_party_id()::text
        )
      )
    )
  );
