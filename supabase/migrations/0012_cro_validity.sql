-- CRO validity date — settable when generating a CRO, or editable after.
-- Plain `date` (not timestamptz) since a validity date has no meaningful
-- time-of-day component, unlike ETD/ETA/cutoffs in 0011.

alter table public.cro_documents
  add column if not exists valid_until date;
