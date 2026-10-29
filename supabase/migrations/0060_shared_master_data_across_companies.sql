-- The spec's separation rules divide the world in two:
--
--   "Master data is shared. Customers and other parties, charge codes and
--    invoice items, ports, vessels, container types, currencies, depots,
--    surveyors, CHAs and vendors are set up once and used by both companies."
--
--   "Hard separation. No booking data crosses between them: no shared
--    bookings, no milestone sync, no inter-company invoices."
--
-- Every table was tenant-scoped, which got the second half right and the
-- first half wrong: switching to RKS showed zero parties and zero ports, so
-- the second company would have had to re-key 230 firms and 734 ports that
-- the business already maintains.
--
-- So the masters become readable by any member of any company, while every
-- operational table keeps its existing tenant scope untouched. Writes stay
-- as they were: a master still belongs to the company that created it, and
-- governance over shared edits is a later item (spec H1).

create or replace function public.is_member_of_any()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.memberships where user_id = auth.uid())
$$;

do $$
declare
  t text;
  shared text[] := array[
    'parties', 'party_branches', 'party_authorized_persons',
    'sea_ports', 'sea_port_terminals', 'air_ports', 'icds',
    'vessels', 'vessel_voyages',
    'container_types', 'currencies', 'package_types', 'units_of_measurement',
    'empty_depots', 'surveyors', 'chas'
  ];
begin
  foreach t in array shared loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('drop policy if exists "shared master readable" on public.%I', t);
    execute format(
      'create policy "shared master readable" on public.%I for select using (public.is_member_of_any())',
      t
    );
  end loop;
end $$;
