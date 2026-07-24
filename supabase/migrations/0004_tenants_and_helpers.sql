-- Phase 2 foundation: introduce tenants, and two helper functions every
-- future table's RLS policy will reuse. Nothing here touches business data
-- yet — this just gives every later table a wall to check against.

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Single default tenant for now — Kinetic is the only customer today.
-- Selling this to a second logistics company later = inserting one more
-- row here, not a schema change.
insert into public.tenants (name)
  select 'Kinetic Line'
  where not exists (select 1 from public.tenants);

alter table public.profiles
  add column if not exists tenant_id uuid references public.tenants(id);

-- Backfill every existing account into the one tenant that exists so far.
update public.profiles
  set tenant_id = (select id from public.tenants order by created_at limit 1)
  where tenant_id is null;

-- Column DEFAULTs can't hold a raw subquery in Postgres, so route it
-- through a small function instead.
create or replace function public.default_tenant_id()
returns uuid
language sql stable set search_path = public
as $$
  select id from public.tenants order by created_at limit 1
$$;

-- New signups land in the same default tenant until there's an actual
-- second tenant to choose between (see handle_new_user below).
alter table public.profiles
  alter column tenant_id set default public.default_tenant_id();

-- Re-create the signup trigger to also stamp tenant_id (everything else
-- unchanged from 0002/0003 — bootstrap admin, Pending gate, 10-account cap).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_count int;
  default_tenant uuid;
begin
  select count(*) into user_count from public.profiles;

  if user_count >= 10 then
    raise exception 'account_limit_reached: maximum of 10 accounts allowed';
  end if;

  select id into default_tenant from public.tenants order by created_at limit 1;

  if user_count = 0 then
    insert into public.profiles (id, name, email, role, status, tenant_id)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email), new.email, 'admin', 'Active', default_tenant);
  else
    insert into public.profiles (id, name, email, role, status, tenant_id)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email), new.email, null, 'Pending', default_tenant);
  end if;

  return new;
end;
$$;

-- ── Helper functions every RLS policy (this migration onward) reuses ──
-- security definer + stable: safe to call inside a policy without
-- recursively re-triggering RLS on profiles.

create or replace function public.auth_tenant_id()
returns uuid
language sql security definer stable set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

create or replace function public.auth_role()
returns text
language sql security definer stable set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Tighten the existing admin-wide policies from 0002 so an Admin only sees
-- their OWN tenant's users, not every tenant's — closes a gap that would
-- otherwise open the moment a second tenant exists.
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;

create policy "Admins can view own-tenant profiles"
  on public.profiles for select
  using (public.is_admin() and tenant_id = public.auth_tenant_id());

create policy "Admins can update own-tenant profiles"
  on public.profiles for update
  using (public.is_admin() and tenant_id = public.auth_tenant_id());

-- Lock down tenants itself: a signed-in user can see their own company's
-- row and nothing else. No insert/update/delete policy is added — with
-- RLS on and no write policy, writes are backend-only (dashboard/service
-- role), which is correct: company records aren't something the app
-- should let any user edit directly.
alter table public.tenants enable row level security;

create policy "Users can view own tenant"
  on public.tenants for select
  using (id = public.auth_tenant_id());
