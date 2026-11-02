-- POD Agent and Freight terms on the booking (spec v2).
--
-- POD AGENT. v2: every Kinetic booking has one, it reads the Agents master
-- and nothing else, and it prints into the BL's Overseas Agent box where the
-- BL maker cannot type over it.
--
-- This is a NEW column rather than a reuse of destination_agent_id, which is
-- an older and looser idea. That column is text and still holds PARTY uuids
-- on two bookings -- AHUJA MARBLE STONEX, AARK GLOBALEX, 7 WORLD STONA, all
-- customers picked from a list of all 230 parties because the agent picker
-- never filtered (defect M4). Pointing a real foreign key at a column that
-- holds the wrong kind of id would either fail or quietly accept nonsense, so
-- the POD Agent gets its own typed column and the legacy ones are dealt with
-- separately.
--
-- FREIGHT TERMS. A constraint already restricted this to 'Prepaid' or
-- 'Collect' but not to NULL: every booking has a value because the
-- new-booking wizard started at 'Prepaid'. That default is the actual fault
-- v2 names -- "no default selected, so nobody issues a BL with the wrong one
-- by accident" -- and four of the five live bookings read Prepaid without
-- anybody necessarily having chosen it.
--
-- The stored spellings are left alone. Renaming them to PREPAID/COLLECT would
-- be churn against existing rows and against whatever the BL already prints;
-- the uppercase in v2 is how the control is LABELLED, not how the value is
-- stored. What changes here is only that NULL becomes legal, so "nobody has
-- chosen yet" can be represented at all -- which it could not before.
--
-- Freight terms are NOT Incoterms. CIF, CFR and FOB stay separate commercial
-- terms; the app may suggest Prepaid for CIF/CFR and Collect for FOB, but the
-- user can always change it.

alter table public.bookings
  add column if not exists pod_agent_id uuid references public.agents(id) on delete set null;

create index if not exists bookings_pod_agent_idx on public.bookings (pod_agent_id);

alter table public.bookings drop constraint if exists bookings_freight_terms_check;

alter table public.bookings add constraint bookings_freight_terms_check
  check (freight_terms is null or freight_terms in ('Prepaid', 'Collect'));
