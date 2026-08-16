-- Miscellaneous → Package types. Becomes the only place package type codes
-- can be added or removed; NVOCC booking flows (Packages field, Product
-- info) read from here, never free-text/inline-add. Admin-only writes via
-- can_write_masters(), same as the rest of Master Data.

create table public.package_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  code text not null,
  created_at timestamptz not null default now()
);

create unique index package_types_code_key on public.package_types (tenant_id, upper(code));

alter table public.package_types enable row level security;

create policy "read package_types" on public.package_types for select
using (tenant_id = public.auth_tenant_id());

create policy "write package_types" on public.package_types for all
using (tenant_id = public.auth_tenant_id() and public.can_write_masters())
with check (tenant_id = public.auth_tenant_id() and public.can_write_masters());

create trigger package_types_audit after insert or update or delete on public.package_types
for each row execute function public.audit_row_change();

insert into public.package_types (code) values
  ('AMP'), ('AWB'), ('BAG'), ('BAL'), ('BDL'), ('BKL'), ('BL'), ('BOU'), ('BOX'), ('BTL'), ('BUN'),
  ('CAN'), ('CBM'), ('CCM'), ('CMS'), ('CNT'), ('CON'), ('CRT'), ('CTN'),
  ('DOZ'), ('DRM'),
  ('FTS'),
  ('GGR'), ('GMS'), ('GRS'), ('GYD'),
  ('KGA'), ('KGB'), ('KGS'), ('KIT'), ('KLR'), ('KME'),
  ('LBS'), ('LTR'),
  ('MGS'), ('MKU'), ('MLT'), ('MOU'), ('MTR'), ('MTS'), ('MUS'),
  ('NOS'),
  ('PAC'), ('PCS'), ('PKG'), ('PLT'), ('PRS'),
  ('QTL'),
  ('RLS'), ('ROL'),
  ('SET'), ('SQF'), ('SQM'), ('SQY'),
  ('TBS'), ('TGM'), ('THD'), ('TON'), ('TUB'),
  ('UGS'), ('UNT'),
  ('VLS'),
  ('YDS');
