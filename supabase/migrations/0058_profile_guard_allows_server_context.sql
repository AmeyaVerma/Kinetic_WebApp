-- The guard refused a write with no auth.uid(), i.e. a service-role or
-- migration connection. That adds friction without adding safety: reaching
-- Postgres with no authenticated user already means holding the service key,
-- which bypasses RLS entirely. The guard exists to stop a signed-in user
-- escalating themselves, so it only has something to say when there IS a
-- signed-in user.

create or replace function public.guard_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only an Admin can change a role' using errcode = '42501';
  end if;

  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'Only an Admin can move a user between companies' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Only an Admin can change an account status' using errcode = '42501';
  end if;

  if new.active_tenant_id is distinct from old.active_tenant_id
     and new.active_tenant_id is not null
     and not public.is_member_of(new.active_tenant_id) then
    raise exception 'You do not have access to that company' using errcode = '42501';
  end if;

  return new;
end;
$$;
