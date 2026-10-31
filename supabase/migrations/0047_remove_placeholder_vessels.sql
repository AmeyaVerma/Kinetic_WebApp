-- Spec M10, the part Siddharth approved: placeholder rows and voyage numbers
-- that were typed into the vessel name field.
--
-- Verified against the live database on 30 Oct 2026: ELEVEN rows, not the
-- twelve this file used to claim. None is referenced by any booking.
--
--   |  004W  NILL (x3)  RT 10  RT-10  RT/10  RT10  TBA  XYZ
--
-- One of them, TBA, carries a vessel_voyages row -- voyage '00', terminal
-- 'TBA', ETA and ETD both 2025-04-01. That is junk of the same kind, and the
-- foreign key cascades, so it goes with the vessel. Nothing else cascades.
--
-- NOT YET APPLIED -- the delete needs a human to run it.

delete from public.vessels
where upper(trim(name)) in ('TBA','XYZ','NILL','004W','RT10','RT 10','RT-10','RT/10')
   or trim(name) = ''
   or name !~ '[A-Za-z]';
