-- The supplied files carry PAN and GSTIN in separate columns, and at least
-- one row has a PAN but no GSTIN (Maharashtra State Warehousing Corporation,
-- PAN AABCM3988M). Mapping both into a single tax_id would have silently
-- dropped it, so each master keeps them apart, as the source does.

alter table public.agents       add column if not exists pan text;
alter table public.cfs          add column if not exists pan text;
alter table public.empty_depots add column if not exists pan text;
alter table public.surveyors    add column if not exists pan text;
