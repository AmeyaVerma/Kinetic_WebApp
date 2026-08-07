-- Two changes to the Parties master:
-- 1. New "Party Role" dropdown (Exporter/Importer/Forwarder) -- separate
--    from the existing KYC "Exporter / Importer Class" field (Both/etc),
--    which is untouched.
-- 2. party_type's option set changes from Company/Individual/Control to
--    Local/Overseas/Control -- geographic classification instead of
--    entity type. Control is kept (still flags BL phrases like "TO ORDER").
--    Existing rows are auto-classified from country: India/blank -> Local,
--    else -> Overseas. Existing Control rows are untouched.

alter table public.parties
  add column if not exists party_role text check (party_role in ('Exporter', 'Importer', 'Forwarder'));

alter table public.parties drop constraint if exists parties_party_type_check;

update public.parties
set party_type = case
  when country is null or country ilike 'india%' then 'Local'
  else 'Overseas'
end
where party_type <> 'Control';

alter table public.parties
  alter column party_type set default 'Local';

alter table public.parties
  add constraint parties_party_type_check check (party_type in ('Local', 'Overseas', 'Control'));
