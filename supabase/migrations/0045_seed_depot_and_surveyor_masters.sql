-- The New booking form carried its own hard-coded depot and surveyor lists
-- (13 depots, 1 surveyor) while Master Data held empty tables, so a booking
-- stored an id like 'd1' that nothing could resolve. Spec M2: forms read
-- option lists from masters only.
--
-- Step 1: move those lists into the masters, keeping the legacy id in `code`
-- so bookings already holding it can be joined back.
-- Step 2: rewrite the bookings that point at a legacy id.

insert into public.empty_depots (tenant_id, name, code, city, country)
select '346b813c-572d-487a-ba55-e800f04753fd'::uuid, v.name, v.code, v.city, 'India'
from (values
  ('Nhava Sheva Empty Yard 1',                    'd1',  'Nhava Sheva'),
  ('Mundra Depot A',                              'd2',  'Mundra'),
  ('Panvel Container Yard',                       'd3',  'Panvel'),
  ('Sai Marine Container Services (NSA Dry)',     'd4',  'Nhava Sheva'),
  ('Sai Marine Container Services (NSA Reefer)',  'd5',  'Nhava Sheva'),
  ('Bhavani Empty Depot',                         'd6',  'Nhava Sheva'),
  ('Sai Marine Container Services',               'd7',  'Nhava Sheva'),
  ('Speedy Multilodes Ltd',                       'd8',  'Nhava Sheva'),
  ('CCIS Keavy Victory Yard',                     'd9',  'Nhava Sheva'),
  ('Iran Depot — BND',                            'd10', 'Bandar Abbas'),
  ('CCIS Bhavani Depot',                          'd11', 'Nhava Sheva'),
  ('KMP Overseas Pvt Ltd',                        'd12', 'Mundra'),
  ('Transworld Empty Park Mundra',                'd13', 'Mundra')
) as v(name, code, city)
where not exists (select 1 from public.empty_depots d where d.name = v.name);

insert into public.surveyors (tenant_id, name, city, active)
select '346b813c-572d-487a-ba55-e800f04753fd'::uuid, 'Bureau Veritas Marine', 'Mumbai', true
where not exists (select 1 from public.surveyors s where s.name = 'Bureau Veritas Marine');

-- Bookings created before the masters existed hold 'd1'..'d13' / 'vn2'.
update public.bookings b
set empty_yard_id = d.id::text
from public.empty_depots d
where b.empty_yard_id = d.code;

update public.bookings b
set surveyor_id = s.id::text
from public.surveyors s
where b.surveyor_id = 'vn2' and s.name = 'Bureau Veritas Marine';
