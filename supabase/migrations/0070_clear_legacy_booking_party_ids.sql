-- Three bookings carry a mock customer id (c1, c2) from before Parties was
-- the master. This is the fourth place the same leftover has turned up:
-- d1/vn2 depots and surveyors (0045), v1/v2/v4 vessels (0062), and now the
-- booking party. Each time a form wrote an id from a seeded list straight
-- into a real column.
--
-- Their names -- "ABC Exports Pvt. Ltd." and "Global Traders" -- do not exist
-- in the Parties master at all; they were demo customers. So there is nothing
-- to repoint them at, and the id is cleared rather than left pointing at
-- nothing. booking_party_name still shows what it always showed.
--
-- Consequence worth knowing: an invoice raised from one of these bookings has
-- no party record behind it, so no GSTIN and no state code, and the tax
-- treatment falls back rather than being derived. That is correct for a
-- booking whose customer was never a real party.

update public.bookings
set booking_party_id = null
where booking_party_id is not null
  and booking_party_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
