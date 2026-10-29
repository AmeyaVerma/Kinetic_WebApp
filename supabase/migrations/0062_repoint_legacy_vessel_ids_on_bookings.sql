-- Three bookings carry a mock vessel id ('v1', 'v2', 'v4') from before the
-- vessel master was real -- the same class of leftover as the 'd1' / 'vn2'
-- depot and surveyor ids fixed in 0045. Not caused by the de-duplication;
-- they were already dangling.
--
-- ONE HENRY HUDSON exists in the master, so that booking is repointed at it.
-- CMA CGM TAIGE and MAERSK NALAF do not exist at all -- they were invented
-- names -- so their id is cleared rather than left pointing at nothing. The
-- vessel_name column still shows what it always showed; only the broken
-- reference goes.

update public.bookings b
set vessel_id = v.id::text
from public.vessels v
where b.vessel_id !~ '^[0-9a-f]{8}-'
  and upper(trim(v.name)) = upper(trim(b.vessel_name))
  and (select count(*) from public.vessels x
        where upper(trim(x.name)) = upper(trim(b.vessel_name))) = 1;

update public.bookings
set vessel_id = null
where vessel_id is not null
  and vessel_id !~ '^[0-9a-f]{8}-';
