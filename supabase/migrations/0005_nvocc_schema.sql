-- Phase 2 pilot: the NVOCC data tables, mirroring src/lib/types.ts
-- (Booking, MilestoneEntry, ChargeLine, BlVersion, BlState,
-- ContainerActivity, BookingDocument, CroDocument, Lead, Quote).
-- Every table carries tenant_id (default = caller's own tenant, via
-- auth_tenant_id() from 0004) and RLS mirroring the nvocc column of
-- ROLE_MATRIX in src/lib/rbac.ts:
--   read  = admin, ops, finance, sales, mnr   (finance/mnr are view-only there)
--   write = admin, ops, sales
-- This is the template — FF/MNR/HR etc. each get their own migration
-- later, following the same pattern.

create or replace function public.can_read_nvocc()
returns boolean
language sql security definer stable set search_path = public
as $$
  select public.auth_role() in ('admin', 'ops', 'finance', 'sales', 'mnr')
$$;

create or replace function public.can_write_nvocc()
returns boolean
language sql security definer stable set search_path = public
as $$
  select public.auth_role() in ('admin', 'ops', 'sales')
$$;

-- ── bookings ──────────────────────────────────────────────────
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  booking_ref text not null,
  module text not null default 'nvocc' check (module in ('nvocc', 'ff', 'agency')),
  direction text not null check (direction in ('Export', 'Import')),
  booking_party_id text,
  booking_party_name text,
  booking_date date,
  principal text,
  shipper text,
  consignee text,
  notify_party text,
  origin_agent_id text,
  destination_agent_id text,
  transshipment_agent text,
  empty_container_yard_origin text,
  empty_container_yard_destination text,
  free_days_origin int not null default 0,
  free_days_dest int not null default 0,
  transit_time int not null default 0,
  vessel_id text,
  vessel_name text,
  voyage_no text,
  pol text,
  pod text,
  etd date,
  eta date,
  freight_terms text check (freight_terms in ('Prepaid', 'Collect')),
  surveyor_id text,
  empty_yard_id text,
  terminal text,
  mbl_no text,
  planned_gate_open date,
  planned_gate_close date,
  planned_si_cutoff date,
  planned_vgm_cutoff date,
  planned_cy_cutoff date,
  container_type text,
  container_qty int not null default 0,
  container_nos text[] not null default '{}',
  commodity text,
  hs_code text,
  packages int not null default 0,
  package_type text,
  gross_weight_kg numeric not null default 0,
  seal_no text,
  number_of_containers text,
  size_of_container text,
  custom_seal_no text,
  hazmat_status text default 'Non-Haz' check (hazmat_status in ('Non-Haz', 'Haz')),
  hazmat_details jsonb,
  hbl_no text,
  cancelled boolean not null default false,
  workflow_status text not null default 'Booked',
  created_at timestamptz not null default now(),
  unique (tenant_id, booking_ref)
);

-- ── booking_milestones ───────────────────────────────────────
create table public.booking_milestones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  key text not null,
  completed_at timestamptz,
  completed_by text,
  unique (booking_id, key)
);

-- ── booking_charges ──────────────────────────────────────────
create table public.booking_charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  charge_code_id text,
  charge_name text,
  type text check (type in ('buy', 'sell')),
  amount numeric not null default 0,
  currency text check (currency in ('USD', 'INR')),
  vendor_id text
);

-- ── bl_versions (append-only edit history) ──────────────────
create table public.bl_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  version int not null,
  fields jsonb not null,
  edited_by text,
  edited_by_role text,
  edited_at timestamptz not null default now(),
  amendment boolean not null default false
);

-- ── bl_state (current lifecycle, one row per booking) ────────
create table public.bl_state (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  lifecycle text not null default 'Draft',
  release_type text,
  current_fields jsonb
);

-- ── container_activities ─────────────────────────────────────
create table public.container_activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  key text not null,
  label text,
  section text check (section in ('origin', 'destination')),
  completed_at timestamptz,
  unique (booking_id, key)
);

-- ── booking_documents (metadata row; file itself lives in Storage
--    once the document-storage migration lands — storage_path is the
--    pointer, left null until then) ───────────────────────────
create table public.booking_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  doc_type text not null,
  status text not null default 'pending',
  storage_path text,
  uploaded_by text,
  uploaded_at timestamptz
);

-- ── cro_documents ─────────────────────────────────────────────
create table public.cro_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  status text not null default 'Draft',
  container_no text,
  issued_at timestamptz
);

-- ── leads (pre-booking funnel) ────────────────────────────────
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  customer_id text,
  customer_name text,
  origin text,
  destination text,
  mode text check (mode in ('sea', 'air', 'road')),
  cargo_type text,
  target_date date,
  status text not null default 'New',
  created_at timestamptz not null default now()
);

-- ── quotes ────────────────────────────────────────────────────
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  lead_id uuid references public.leads(id) on delete set null,
  buy_total numeric not null default 0,
  sell_total numeric not null default 0,
  currency text check (currency in ('USD', 'INR')),
  valid_until date,
  status text not null default 'Draft'
);

-- ── RLS: same two-clause fence on every table above ────────────
-- tenant_id = auth_tenant_id()  → can never see another company's rows
-- can_read/write_nvocc()        → mirrors ROLE_MATRIX so the DB enforces
--                                  what the UI only hides today
do $$
declare
  t text;
begin
  foreach t in array array[
    'bookings', 'booking_milestones', 'booking_charges', 'bl_versions',
    'bl_state', 'container_activities', 'booking_documents',
    'cro_documents', 'leads', 'quotes'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format($f$
      create policy "read %1$s" on public.%1$I for select
      using (tenant_id = public.auth_tenant_id() and public.can_read_nvocc())
    $f$, t);

    execute format($f$
      create policy "write %1$s" on public.%1$I for all
      using (tenant_id = public.auth_tenant_id() and public.can_write_nvocc())
      with check (tenant_id = public.auth_tenant_id() and public.can_write_nvocc())
    $f$, t);
  end loop;
end $$;
