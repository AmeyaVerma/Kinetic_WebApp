-- Replaces the FF "Empty container yard destination" free-text field with a
-- CRO validity date. Plain `date` (not timestamptz), matching 0012's CRO
-- validity date on cro_documents — no meaningful time-of-day component.

alter table public.ff_shipments
  add column if not exists cro_valid_till date;

alter table public.ff_shipments
  drop column if exists empty_container_yard_destination;
