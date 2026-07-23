-- Require Admin approval + role assignment for every signup after the
-- first (bootstrap admin). New signups now land as role = NULL,
-- status = 'Pending' and get no app access until an Admin approves them.

alter table public.profiles alter column role drop not null;
alter table public.profiles alter column role drop default;

-- Re-create the trigger function: only the very first signup ever
-- (bootstrap, since there's no admin to approve them yet) becomes
-- admin/Active. Everyone after lands Pending with no role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_count int;
begin
  select count(*) into user_count from public.profiles;

  if user_count = 0 then
    insert into public.profiles (id, name, email, role, status)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email), new.email, 'admin', 'Active');
  else
    insert into public.profiles (id, name, email, role, status)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email), new.email, null, 'Pending');
  end if;

  return new;
end;
$$;

-- Security-definer helper so RLS policies can check "is this caller an
-- admin?" without recursively querying profiles under its own RLS
-- (which would either infinite-loop or silently deny).
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'Active'
  );
$$;

-- Admins can see and manage every profile (needed to review Pending
-- signups and assign roles); everyone else still only sees their own row.
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Admins can update all profiles"
  on public.profiles for update
  using (public.is_admin());
