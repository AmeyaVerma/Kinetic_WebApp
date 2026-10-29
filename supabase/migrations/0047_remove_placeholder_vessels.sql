-- Spec M10, the part Siddharth approved: placeholder rows and voyage numbers
-- that were typed into the vessel name field. Twelve rows, none referenced by
-- any booking.
--
-- NOT YET APPLIED -- the delete needs a human to run it.

delete from public.vessels
where upper(trim(name)) in ('TBA','XYZ','NILL','004W','RT10','RT 10','RT-10','RT/10')
   or trim(name) = ''
   or name !~ '[A-Za-z]';
