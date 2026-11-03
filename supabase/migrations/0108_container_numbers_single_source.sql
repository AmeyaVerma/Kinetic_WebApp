-- One place for a booking's container numbers.
--
-- They were recorded twice: container_details (the per-container table the
-- Container info tab edits) and container_nos (a flat list the CRO pickup step
-- wrote to). Two live bookings disagreed -- a container picked up at the depot
-- sat in the flat list while the table showed blank rows -- so a number could
-- be on the booking and invisible where people look for it.
--
-- container_details is now the source. container_nos stays as a column because
-- other code reads it, but the database keeps it equal to the numbers in the
-- table:
--   * if a writer changes the table, the list is rebuilt from it;
--   * if a writer changes only the list (the old CRO pickup path), each new
--     number is folded INTO the table first, so nothing is lost and the two
--     still agree.
-- Removing a number from the table removes it from the list, which is why the
-- list is rebuilt rather than merged when the table is what changed.

create or replace function public.fold_container_numbers(p_details jsonb, p_nos text[])
returns jsonb
language plpgsql immutable
as $fn$
declare
  v_details jsonb := coalesce(p_details, '[]'::jsonb);
  v_no      text;
  v_idx     int;
begin
  foreach v_no in array coalesce(p_nos, '{}'::text[]) loop
    v_no := upper(trim(v_no));
    continue when v_no = '';
    -- Already there.
    continue when exists (
      select 1 from jsonb_array_elements(v_details) d
       where upper(trim(coalesce(d ->> 'containerNo', ''))) = v_no
    );
    -- First row with no number yet, else a new row.
    select ord - 1 into v_idx
      from jsonb_array_elements(v_details) with ordinality as t(d, ord)
     where trim(coalesce(d ->> 'containerNo', '')) = ''
     order by ord limit 1;
    if v_idx is not null then
      v_details := jsonb_set(v_details, array[v_idx::text, 'containerNo'], to_jsonb(v_no));
    else
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'sob', null, 'gateIn', null, 'sealNo', '', 'pkgUnit', '', 'noOfPkgs', '',
        'netWeight', '', 'emptyLaden', 'Laden', 'pickupDate', null, 'cargoWeight', '',
        'containerNo', v_no, 'grossWeight', '', 'customSealNo', '', 'containerType', ''));
    end if;
  end loop;
  return v_details;
end
$fn$;

create or replace function public.numbers_in_details(p_details jsonb)
returns text[]
language sql immutable
as $fn$
  select coalesce(array_agg(upper(trim(d ->> 'containerNo')) order by ord), '{}'::text[])
    from jsonb_array_elements(coalesce(p_details, '[]'::jsonb)) with ordinality as t(d, ord)
   where trim(coalesce(d ->> 'containerNo', '')) <> ''
$fn$;

create or replace function public.sync_container_numbers()
returns trigger
language plpgsql
as $fn$
begin
  if tg_op = 'INSERT' then
    new.container_details := public.fold_container_numbers(new.container_details, new.container_nos);
  elsif new.container_nos is distinct from old.container_nos
        and new.container_details is not distinct from old.container_details then
    -- A writer supplied numbers without touching the table: fold them in.
    new.container_details := public.fold_container_numbers(new.container_details, new.container_nos);
  end if;
  new.container_nos := public.numbers_in_details(new.container_details);
  return new;
end
$fn$;

-- Bring the existing rows into agreement before the trigger keeps them there.
update public.bookings
   set container_details = public.fold_container_numbers(container_details, container_nos),
       container_nos = public.numbers_in_details(
         public.fold_container_numbers(container_details, container_nos))
 where container_nos is distinct from public.numbers_in_details(container_details)
    or coalesce(array_length(container_nos, 1), 0) > 0;

drop trigger if exists bookings_sync_container_numbers on public.bookings;
create trigger bookings_sync_container_numbers
before insert or update on public.bookings
for each row execute function public.sync_container_numbers();
