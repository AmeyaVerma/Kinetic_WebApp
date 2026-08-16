-- Miscellaneous → Units of Measurement. Becomes the only place UOM codes
-- can be added or removed; cargo/charge/rate entry reads from here rather
-- than free text. Admin-only writes via can_write_masters(), same as the
-- rest of Master Data.
--
-- Seeded with the standard set used across NVOCC / freight forwarding:
-- UN/ECE Rec 20 units plus the shipping-specific ones (TEU/FEU, revenue
-- ton, W/M) and the time units detention & demurrage are billed in.

create table public.units_of_measurement (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  code text not null,
  name text not null,
  category text,
  created_at timestamptz not null default now()
);

create unique index units_of_measurement_code_key on public.units_of_measurement (tenant_id, upper(code));

alter table public.units_of_measurement enable row level security;

create policy "read units_of_measurement" on public.units_of_measurement for select
using (tenant_id = public.auth_tenant_id());

create policy "write units_of_measurement" on public.units_of_measurement for all
using (tenant_id = public.auth_tenant_id() and public.can_write_masters())
with check (tenant_id = public.auth_tenant_id() and public.can_write_masters());

create trigger units_of_measurement_audit after insert or update or delete on public.units_of_measurement
for each row execute function public.audit_row_change();

insert into public.units_of_measurement (code, name, category) values
  -- Weight
  ('KGS', 'Kilograms', 'Weight'),
  ('GMS', 'Grams', 'Weight'),
  ('MTS', 'Metric Tonnes', 'Weight'),
  ('LBS', 'Pounds', 'Weight'),
  ('QTL', 'Quintals', 'Weight'),
  ('OZS', 'Ounces', 'Weight'),
  -- Volume
  ('CBM', 'Cubic Metres', 'Volume'),
  ('CFT', 'Cubic Feet', 'Volume'),
  ('LTR', 'Litres', 'Volume'),
  ('MLT', 'Millilitres', 'Volume'),
  ('GAL', 'Gallons', 'Volume'),
  ('BBL', 'Barrels', 'Volume'),
  -- Length
  ('MTR', 'Metres', 'Length'),
  ('CMS', 'Centimetres', 'Length'),
  ('MMS', 'Millimetres', 'Length'),
  ('KMS', 'Kilometres', 'Length'),
  ('FTS', 'Feet', 'Length'),
  ('INS', 'Inches', 'Length'),
  ('YDS', 'Yards', 'Length'),
  -- Area
  ('SQM', 'Square Metres', 'Area'),
  ('SQF', 'Square Feet', 'Area'),
  ('SQY', 'Square Yards', 'Area'),
  -- Quantity
  ('NOS', 'Numbers', 'Quantity'),
  ('PCS', 'Pieces', 'Quantity'),
  ('UNT', 'Units', 'Quantity'),
  ('DOZ', 'Dozens', 'Quantity'),
  ('GRS', 'Gross', 'Quantity'),
  ('SET', 'Sets', 'Quantity'),
  ('PRS', 'Pairs', 'Quantity'),
  ('ROL', 'Rolls', 'Quantity'),
  ('BDL', 'Bundles', 'Quantity'),
  -- Container / shipping
  ('TEU', 'Twenty-foot Equivalent Unit', 'Container'),
  ('FEU', 'Forty-foot Equivalent Unit', 'Container'),
  ('CNT', 'Containers', 'Container'),
  ('PKG', 'Packages', 'Container'),
  ('PLT', 'Pallets', 'Container'),
  ('BOX', 'Boxes', 'Container'),
  ('CTN', 'Cartons', 'Container'),
  ('DRM', 'Drums', 'Container'),
  ('BAG', 'Bags', 'Container'),
  -- Freight basis
  ('RT', 'Revenue Tonne', 'Freight basis'),
  ('WM', 'Weight or Measurement (whichever greater)', 'Freight basis'),
  ('BL', 'Per Bill of Lading', 'Freight basis'),
  ('SHPT', 'Per Shipment', 'Freight basis'),
  ('LS', 'Lumpsum', 'Freight basis'),
  -- Time (detention / demurrage / storage billing)
  ('DAY', 'Days', 'Time'),
  ('HRS', 'Hours', 'Time'),
  ('WK', 'Weeks', 'Time'),
  ('MTH', 'Months', 'Time');
