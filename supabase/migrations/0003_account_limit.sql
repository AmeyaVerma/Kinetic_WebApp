-- Cap total accounts at 10 (global cap — no tenant_id yet, see Phase 2 plan).
-- Enforced in the signup trigger itself so it can't be bypassed by calling
-- the Supabase Auth API directly; a rejected signup rolls back the
-- auth.users row too, since it's the same transaction as the trigger.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_count int;
begin
  select count(*) into user_count from public.profiles;

  if user_count >= 10 then
    raise exception 'account_limit_reached: maximum of 10 accounts allowed';
  end if;

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
