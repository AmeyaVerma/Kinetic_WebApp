-- Phase 3: two companies behind one login.
--
-- Until now a profile carried ONE tenant_id, so a person belonged to exactly
-- one company. The spec needs a user in several, with a separate role in each
-- ("an Admin at Kinetic can be Finance at RKS"), a chooser after login, and
-- row-level security that holds when they switch.
--
-- Three pieces:
--   memberships            -- the authority on who may see which company
--   profiles.active_tenant -- which company is currently chosen
--   auth_tenant_id()       -- resolves the two, and trusts only membership
--
-- The important property: `active_tenant_id` is something the client can set,
-- so it is never trusted on its own. auth_tenant_id() returns it ONLY when a
-- membership backs it. Someone pointing their profile at RKS without being a
-- member of RKS therefore sees nothing, rather than everything.

insert into public.tenants (name)
select 'RKS Global Logistics'
where not exists (select 1 from public.tenants where name = 'RKS Global Logistics');

create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  role       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);

create index if not exists memberships_user_idx on public.memberships (user_id);

insert into public.memberships (user_id, tenant_id, role)
select p.id, p.tenant_id, p.role
from public.profiles p
where p.tenant_id is not null
  and not exists (
    select 1 from public.memberships m where m.user_id = p.id and m.tenant_id = p.tenant_id
  );

alter table public.profiles
  add column if not exists active_tenant_id uuid references public.tenants(id);

update public.profiles set active_tenant_id = tenant_id where active_tenant_id is null;

create or replace function public.is_member_of(t uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.tenant_id = t)
$$;

create or replace function public.auth_tenant_id()
returns uuid language sql stable security definer set search_path to 'public'
as $$
  select coalesce(
    (select p.active_tenant_id from public.profiles p
      where p.id = auth.uid()
        and exists (select 1 from public.memberships m
                     where m.user_id = p.id and m.tenant_id = p.active_tenant_id)),
    (select m.tenant_id from public.memberships m
      where m.user_id = auth.uid() order by m.created_at limit 1),
    (select p.tenant_id from public.profiles p where p.id = auth.uid())
  )
$$;

create or replace function public.auth_role()
returns text language sql stable security definer set search_path to 'public'
as $$
  select coalesce(
    (select m.role from public.memberships m
      where m.user_id = auth.uid() and m.tenant_id = public.auth_tenant_id()),
    (select p.role from public.profiles p where p.id = auth.uid())
  )
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select public.auth_role() = 'admin'
     and exists (select 1 from public.profiles where id = auth.uid() and status = 'Active')
$$;

alter table public.memberships enable row level security;

create policy "read own memberships" on public.memberships
  for select using (user_id = auth.uid() or is_admin());

create policy "admins manage memberships" on public.memberships
  for all using (is_admin() and tenant_id = auth_tenant_id())
  with check (is_admin() and tenant_id = auth_tenant_id());

create trigger memberships_audit
after insert or update or delete on public.memberships
for each row execute function public.audit_row_change();
