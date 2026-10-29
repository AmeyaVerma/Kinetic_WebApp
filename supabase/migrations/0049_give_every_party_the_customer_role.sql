-- Spec M3/M4: every picker offered all 230 parties because not one carried a
-- commercial role, so nothing could be filtered. Siddharth's instruction is
-- that every existing party counts as a Customer; Agent and Vendor get set on
-- a party the first time someone actually uses it as one.
--
-- Only `roles` is touched. `party_role` is a different vocabulary entirely --
-- Exporter / Importer / Forwarder, i.e. what a party is ON A SHIPMENT, not
-- what it is to us commercially. Writing 'Customer' into it would be a
-- category error, and its check constraint rightly refuses.

update public.parties
set roles = array['Customer']
where roles is null or array_length(roles, 1) is null;
