-- A booking held the depot twice: empty_yard_id (written by the New booking
-- wizard, read by nothing) and depot_id (read by the CRO and the other
-- generated documents, written by nobody). That is why a CRO could be issued
-- with no depot while the booking plainly had one -- spec F8, and data rule
-- "one record, many views".
--
-- depot_id and surveyor_ref_id are the canonical columns. Carry across what
-- the wizard already stored so existing bookings print a depot.

update public.bookings
set depot_id = empty_yard_id::uuid
where depot_id is null
  and empty_yard_id is not null
  and empty_yard_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

update public.bookings
set surveyor_ref_id = surveyor_id::uuid
where surveyor_ref_id is null
  and surveyor_id is not null
  and surveyor_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
