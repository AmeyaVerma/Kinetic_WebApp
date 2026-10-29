-- Adding a vendor from inside a booking should never interrupt the booking.
--
-- If the firm is already on file, the honest outcome is "here it is" -- not an
-- error about a duplicate, and not a second row. So this returns the existing
-- vendor, adds the requested role to it if missing, and only inserts when it
-- is genuinely new. `out_created` tells the caller which happened.
--
-- Supersedes 0067, whose OUT parameters were named id/name/roles/created --
-- the same names as the columns. Inside the UPDATE, `roles` was ambiguous and
-- Postgres refused. It failed on exactly one path: an existing vendor being
-- given a NEW role, which is the case the feature exists for. Adding a brand
-- new vendor worked, so it was invisible until a vendor was reused.

drop function if exists public.add_vendor(text, text);

create or replace function public.add_vendor(p_name text, p_role text default null)
returns table (out_id uuid, out_name text, out_roles text[], out_created boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_norm text := lower(regexp_replace(trim(p_name), '\s+', ' ', 'g'));
  v_row  public.vendors%rowtype;
begin
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'A vendor name of at least two characters is required';
  end if;
  if not public.can_write_masters() then
    raise exception 'You do not have permission to add a vendor' using errcode = '42501';
  end if;

  select * into v_row from public.vendors v
  where lower(regexp_replace(trim(v.name), '\s+', ' ', 'g')) = v_norm;

  if found then
    if p_role is not null and not (p_role = any(v_row.roles)) then
      update public.vendors as t
         set roles = array_append(t.roles, p_role)
       where t.id = v_row.id
      returning t.* into v_row;
    end if;
    out_id := v_row.id; out_name := v_row.name;
    out_roles := v_row.roles; out_created := false;
    return next;
    return;
  end if;

  insert into public.vendors (name, roles)
  values (regexp_replace(trim(p_name), '\s+', ' ', 'g'),
          case when p_role is null then '{}'::text[] else array[p_role] end)
  returning * into v_row;

  out_id := v_row.id; out_name := v_row.name;
  out_roles := v_row.roles; out_created := true;
  return next;
end;
$$;

revoke all on function public.add_vendor(text, text) from anon;
