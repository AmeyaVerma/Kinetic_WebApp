-- Phase 1: real auth. One row per Supabase Auth user, holding the role
-- this app's RBAC matrix (src/lib/rbac.ts) keys off. This is intentionally
-- the ONLY table in Phase 1 — NVOCC/FF/etc. business data stays on the
-- in-memory mock store until the Phase 2 pilot migration.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'ops',
  status text not null default 'Active',
  mfa_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A signed-in user can read and update only their own profile row.
-- (Admin-can-see-everyone comes in the Phase 2/3 migration of the
-- Users & Roles page, via a security-definer helper to avoid recursive RLS.)
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-provision a profile row whenever someone signs up.
-- The very first person to ever sign up becomes admin (bootstrap path,
-- since there's no admin yet to invite them); everyone after defaults to
-- 'ops' pending an admin reassigning their role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_count int;
  assigned_role text;
begin
  select count(*) into user_count from public.profiles;
  assigned_role := case when user_count = 0 then 'admin' else 'ops' end;

  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    new.email,
    assigned_role
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
