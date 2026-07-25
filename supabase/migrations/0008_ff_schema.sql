-- Freight Forwarding schema — same pattern as NVOCC (0005): tenant_id on
-- every table, RLS mirroring the `freight` column of ROLE_MATRIX in
-- src/lib/rbac.ts (read: admin/ops/finance/sales; write: admin/ops/sales
-- — note mnr has NO freight access, unlike its nvocc:V), and hooked into
-- the same audit_log trigger from 0006. FF is a structurally separate
-- type from Booking (FfShipment in src/lib/types.ts), so it gets its own
-- tables rather than reusing `bookings`.

create or replace function public.can_read_ff()
returns boolean
language sql security definer stable set search_path = public
as $$
  select public.auth_role() in ('admin', 'ops', 'finance', 'sales')
$$;

create or replace function public.can_write_ff()
returns boolean
language sql security definer stable set search_path = public
as $$
  select public.auth_role() in ('admin', 'ops', 'sales')
$$;

-- ── ff_shipments ──────────────────────────────────────────────
create table if not exists public.ff_shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  ref text not null,
  mode text not null check (mode in ('Sea FCL', 'Sea LCL', 'Air', 'Road', 'Multimodal')),
  customer_id text,
  customer_name text,
  origin text,
  destination text,
  incoterm text,
  stage text not null default 'Booking',
  credit_hold boolean not null default false,
  is_consol_parent boolean not null default false,
  parent_id uuid references public.ff_shipments(id) on delete set null,
  consol_closed boolean not null default false,
  carrier_name text,
  linked_nvocc_ref text,
  rate_reconfirmed boolean not null default false,
  agent_id text,
  special_handling text,
  pickup_proof boolean not null default false,
  si_received boolean not null default false,
  weight_variance_flagged boolean not null default false,
  mbl_uploaded boolean not null default false,
  house_doc_status text not null default 'None' check (house_doc_status in ('None', 'Draft', 'Awaiting approval', 'Released')),
  house_doc_version int not null default 0,
  house_release_type text,
  broker_assigned boolean not null default false,
  export_hold boolean not null default false,
  let_export_received boolean not null default false,
  gate_in_done boolean not null default false,
  vgm_done boolean not null default false,
  cutoff_met boolean,
  departed boolean not null default false,
  transhipment_legs int not null default 0,
  arrival_notice_sent boolean not null default false,
  import_hold boolean not null default false,
  out_of_charge boolean not null default false,
  dd_outcome text check (dd_outcome in ('None', 'Customer-billed', 'Absorbed')),
  do_issued boolean not null default false,
  pod_captured boolean not null default false,
  sell_amount numeric not null default 0,
  client_invoiced boolean not null default false,
  paid boolean not null default false,
  -- Booking-detail parity fields — mirror the same-named Booking columns
  -- so the shared NVOCC-style tabbed detail view works for FF too.
  workflow_status text,
  container_type text,
  number_of_containers text,
  size_of_container text,
  seal_no text,
  custom_seal_no text,
  commodity text,
  hs_code text,
  packages text,
  package_type text,
  gross_weight_kg text,
  freight_terms text,
  hazmat_status text,
  hazmat_details jsonb,
  vessel_name text,
  voyage_no text,
  etd date,
  eta date,
  terminal text,
  mbl_no text,
  planned_gate_open date,
  planned_gate_close date,
  planned_si_cutoff date,
  planned_vgm_cutoff date,
  planned_cy_cutoff date,
  shipper text,
  consignee text,
  notify_party text,
  origin_agent_name text,
  destination_agent_name text,
  transshipment_agent text,
  surveyor_name text,
  empty_container_yard_origin text,
  empty_container_yard_destination text,
  created_at timestamptz not null default now(),
  unique (tenant_id, ref)
);

-- ── ff_vendor_lines ───────────────────────────────────────────
create table if not exists public.ff_vendor_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  ff_shipment_id uuid not null references public.ff_shipments(id) on delete cascade,
  role text not null check (role in ('Carrier', 'Customs', 'Trucking', 'Warehousing', 'Insurance')),
  vendor_id text,
  vendor_name text,
  buy_amount numeric not null default 0,
  billed_amount numeric,
  variance_flag boolean not null default false
);

-- ── RLS: same two-clause fence as NVOCC ────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['ff_shipments', 'ff_vendor_lines']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', 'read ' || t, t);
    execute format($f$
      create policy "read %1$s" on public.%1$I for select
      using (tenant_id = public.auth_tenant_id() and public.can_read_ff())
    $f$, t);

    execute format('drop policy if exists %I on public.%I', 'write ' || t, t);
    execute format($f$
      create policy "write %1$s" on public.%1$I for all
      using (tenant_id = public.auth_tenant_id() and public.can_write_ff())
      with check (tenant_id = public.auth_tenant_id() and public.can_write_ff())
    $f$, t);

    -- Reuse the exact same accountability trail from 0006 — same
    -- generic trigger, no new audit code needed.
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
       for each row execute function public.audit_row_change()',
      t || '_audit', t
    );
  end loop;
end $$;
