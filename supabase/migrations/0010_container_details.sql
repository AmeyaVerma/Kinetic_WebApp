-- Per-container detail rows (Empty/Laden, packages, weights, gate-in date,
-- SOB date) on the Container info tab. One row per container, count driven
-- by numberOfContainers. Stored as jsonb on `bookings` (same pattern as
-- hazmat_details) rather than a child table — this is dense per-booking
-- display data, not something queried/joined independently.

alter table public.bookings
  add column if not exists container_details jsonb;
