-- Vessel section on Shipment details: a booking can have multiple vessel
-- legs (transhipment) rather than the single vesselName/voyageNo/etd/eta
-- pair captured at booking creation. Stored as a single jsonb array, same
-- pattern as container_details -- one row per leg, no separate table.

alter table public.bookings add column vessel_legs jsonb;
