-- ETD/ETA and the five planned-cutoff fields were `date` (no time-of-day
-- storage at all) — widen to `timestamptz` on both bookings and
-- ff_shipments so the UI can start capturing a time alongside the date.
-- `using col::timestamptz` casts existing date-only values to midnight
-- UTC on that date — no data loss, just adds a (currently zero) time part.

do $$
declare
  t text;
  col text;
begin
  foreach t in array array['bookings', 'ff_shipments']
  loop
    foreach col in array array[
      'etd', 'eta', 'planned_gate_open', 'planned_gate_close',
      'planned_si_cutoff', 'planned_vgm_cutoff', 'planned_cy_cutoff'
    ]
    loop
      execute format(
        'alter table public.%I alter column %I type timestamptz using %I::timestamptz',
        t, col, col
      );
    end loop;
  end loop;
end $$;
