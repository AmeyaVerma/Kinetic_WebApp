-- A company must always have an Admin (spec v2: last-Admin safety).
--
-- Without this, removing or demoting the only Admin of a company leaves it with
-- nobody who can manage users, approve requests or change settings, and no way
-- to get one back from inside the app. The rule is in the database rather than
-- the Users screen because the screen is only one way to reach the row.
--
-- A company that is itself being deleted is exempt: when it cascades, the
-- company row is already gone, so its memberships may go with it.

create or replace function public.guard_last_admin()
returns trigger
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_others int;
begin
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role is distinct from 'admin')
     and exists (select 1 from public.tenants t where t.id = old.tenant_id) then
    select count(*) into v_others
      from public.memberships m
     where m.tenant_id = old.tenant_id and m.role = 'admin' and m.id <> old.id;
    if v_others = 0 then
      raise exception
        'This is the last Admin of the company. Make someone else an Admin first, then change this one.'
        using errcode = 'restrict_violation';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$fn$;

drop trigger if exists memberships_guard_last_admin on public.memberships;
create trigger memberships_guard_last_admin
before update or delete on public.memberships
for each row execute function public.guard_last_admin();
