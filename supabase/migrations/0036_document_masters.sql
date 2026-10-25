-- Masters the six documents print from. Today `empty_depots` holds only
-- name/code/city/country, but the CRO, Delivery Order and Off Loading Letter
-- all print a full depot block (address, PIN, attention contact, phone) and
-- the CRO prints per-depot instruction lines. Surveyor and CHA have no tables
-- at all -- `bookings.surveyor_id` points at nothing.

-- --------------------------------------------------------------------------
-- Depot / CY: extend rather than replace. Existing rows keep working; the new
-- columns are nullable so nothing breaks while they are filled in.
-- --------------------------------------------------------------------------
alter table public.empty_depots
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists pin_code text,
  add column if not exists state text,
  add column if not exists attn_name text,
  add column if not exists email text,
  add column if not exists phone text,
  -- Printed as the CRO instruction bullets, editable per CRO afterwards.
  -- Array so each line is a separate bullet in the rendered document.
  add column if not exists default_instructions text[] not null default array[]::text[];

-- --------------------------------------------------------------------------
-- Surveyor: printed on the CRO above "Yours Faithfully". The blank format
-- runs name, address and phone together on one line; we store them apart so
-- the template can put them on separate lines (brief section 8.4).
-- --------------------------------------------------------------------------
create table public.surveyors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  pin_code text,
  phone text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index surveyors_name_key on public.surveyors (tenant_id, lower(name));

alter table public.surveyors enable row level security;

create policy "read surveyors" on public.surveyors for select
using (tenant_id = public.auth_tenant_id());

create policy "write surveyors" on public.surveyors for all
using (tenant_id = public.auth_tenant_id() and public.can_write_masters())
with check (tenant_id = public.auth_tenant_id() and public.can_write_masters());

create trigger surveyors_audit after insert or update or delete on public.surveyors
for each row execute function public.audit_row_change();

-- --------------------------------------------------------------------------
-- CHA (Customs House Agent): printed on the Delivery Order ("PLEASE DELIVER
-- FOLLOWING CARGO TO CHA M/S ...") and the Off Loading Letter. Required
-- before a DO can be issued -- it is blank in the sample.
-- --------------------------------------------------------------------------
create table public.chas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  name text not null,
  contact_name text,
  address_line1 text,
  address_line2 text,
  city text,
  pin_code text,
  phone text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index chas_name_key on public.chas (tenant_id, lower(name));

alter table public.chas enable row level security;

create policy "read chas" on public.chas for select
using (tenant_id = public.auth_tenant_id());

create policy "write chas" on public.chas for all
using (tenant_id = public.auth_tenant_id() and public.can_write_masters())
with check (tenant_id = public.auth_tenant_id() and public.can_write_masters());

create trigger chas_audit after insert or update or delete on public.chas
for each row execute function public.audit_row_change();
