-- Container Position Report (MNR) needs two fields that don't exist
-- anywhere in the legacy import: an operational status (MT / Imp Loaded /
-- DO Issue / Exp Pick Up / Intransit / Loaded in CFS / Loaded in Port) and
-- a report location code (NSA / MUN / BND / SOHAR / JEA / BND Star
-- Marine / Al Marsa). Both are new concepts Ops assigns going forward via
-- the Container detail page -- there is no clean source field to derive
-- op_status from, so it starts fully unset for every row.

alter table public.containers
  add column report_location text check (report_location in ('NSA','MUN','BND','SOHAR','JEA','BND_STAR_MARINE','AL_MARSA')),
  add column op_status text check (op_status in ('MT','IMP_LOADED','DO_ISSUE','EXP_PICKUP','INTRANSIT','LOADED_IN_CFS','LOADED_IN_PORT'));

-- Best-effort seed for report_location from the existing port/depot text --
-- only the unambiguous matches (confirmed against Sept 2026 report
-- screenshots); everything else (171 of 344 rows) is left null for Ops to
-- assign by hand.
update public.containers set report_location = 'SOHAR' where port = 'SOHAR';
update public.containers set report_location = 'MUN' where port = 'MUNDRA' or depot ilike '%mundra%';
update public.containers set report_location = 'JEA' where port = 'JEBEL ALI';
update public.containers set report_location = 'BND' where port = 'BANDAR ABBAS' or depot ilike '%- bnd%';
update public.containers set report_location = 'NSA' where depot ilike '%nsa%';
