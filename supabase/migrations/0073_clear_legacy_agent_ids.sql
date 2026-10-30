-- Mock id leakage, fifth occurrence. Before the Agents picker read the real
-- Parties master it offered a seeded list whose ids were 'a1'..'a6', and
-- those strings were written into bookings.origin_agent_id and
-- destination_agent_id. Three bookings still carry them.
--
-- Cleared rather than repointed: all six seeded names (Gulf Star Shipping,
-- Mombasa Freight Kenya, Lion City Logistics and the rest) were invented for
-- the demo and have no counterpart in the real Parties master, so there is
-- nothing to point at. A dangling reference is worse than none -- it renders
-- blank while looking like data, which is how this went unnoticed four times
-- before.
--
-- This matters now because the customer and agent portals are about to scope
-- what a person can read by exactly these columns. A dangling agent id would
-- mean an agent sees nothing and nobody could tell whether that was the
-- security working or the data being broken.

update public.bookings b
   set origin_agent_id = null
 where origin_agent_id is not null
   and not exists (select 1 from public.parties p where p.id::text = b.origin_agent_id);

update public.bookings b
   set destination_agent_id = null
 where destination_agent_id is not null
   and not exists (select 1 from public.parties p where p.id::text = b.destination_agent_id);
