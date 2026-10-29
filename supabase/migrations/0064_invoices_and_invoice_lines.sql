-- Phase 5, the foundation: invoices become real.
--
-- Until now the Invoicing tab looked finished but held everything in browser
-- memory -- no `invoices` table existed, the number was "KLI-25-" plus the
-- length of an array, and there were no tax fields at all. Nothing survived a
-- refresh, so financial closure and GP had nothing to stand on.
--
-- The shape is taken from the company's OWN invoices rather than invented:
-- NITCO 4X20 OCEAN FREIGHT (RKS) and MUNDRA OIL 12X20 (Kinetic). Between them
-- they settle: SAC per line, IGST driven by the customer's state code, LUT
-- zero-rating with the amount in a non-taxable column, the FX rate struck per
-- invoice in an EX RT column, and an explicit R/off line.
--
-- Built to work whichever way the accounting lands. Siddharth has confirmed
-- Zoho, so `zoho_invoice_id` holds the reference once synced; the ERP records
-- what was billed either way, because GP and closure must be able to read it.

create table if not exists public.invoices (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null default default_tenant_id() references public.tenants(id) on delete cascade,

  invoice_no        text,
  series            text not null,
  fy_code           text not null default fy_code(),
  seq               integer,

  type              text not null check (type in ('AR','AP')),
  doc_kind          text not null default 'Proforma'
                    check (doc_kind in ('Proforma','Tax Invoice','Credit Note','Vendor Bill')),
  status            text not null default 'Draft',

  booking_id        uuid references public.bookings(id) on delete set null,
  ff_shipment_id    uuid references public.ff_shipments(id) on delete set null,

  -- The party is linked, but name/GSTIN/state are also snapshotted: an
  -- invoice must keep saying what it said when it was issued, even if the
  -- party record is corrected afterwards.
  party_id          uuid references public.parties(id),
  party_name        text,
  party_address     text,
  party_gstin       text,
  party_state       text,
  party_state_code  text,

  invoice_date      date not null default current_date,
  due_date          date,

  currency          text not null default 'INR',
  fx_rate           numeric(12,5) not null default 1,

  place_of_supply       text,
  place_of_supply_code  text,
  tax_treatment     text not null default 'IGST'
                    check (tax_treatment in ('IGST','CGST_SGST','ZERO_RATED_LUT','EXEMPT','NON_GST')),
  lut_number        text,

  subtotal          numeric(14,2) not null default 0,
  tax_total         numeric(14,2) not null default 0,
  round_off         numeric(8,2)  not null default 0,
  total_inr         numeric(14,2) not null default 0,
  amount_in_words   text,

  terms             text,
  notes             text,
  prepared_by       text,

  zoho_invoice_id   text,
  zoho_synced_at    timestamptz,

  created_at        timestamptz not null default now(),
  created_by        text,
  unique (tenant_id, series, fy_code, seq)
);

create index if not exists invoices_booking_idx  on public.invoices (booking_id);
create index if not exists invoices_shipment_idx on public.invoices (ff_shipment_id);
create index if not exists invoices_party_idx    on public.invoices (party_id);

create table if not exists public.invoice_lines (
  id                  uuid primary key default gen_random_uuid(),
  invoice_id          uuid not null references public.invoices(id) on delete cascade,
  line_no             integer not null,

  particulars         text not null,
  sac_code            text,
  qty                 numeric(12,3) not null default 1,
  uom                 text,
  rate                numeric(14,2) not null default 0,
  currency            text not null default 'INR',
  ex_rate             numeric(12,5) not null default 1,

  -- Which of these two is filled is the whole point: an LUT export puts the
  -- amount in non_taxable and leaves taxable empty, which is what makes it
  -- zero-rated rather than untaxed by accident.
  non_taxable_amount  numeric(14,2) not null default 0,
  taxable_amount      numeric(14,2) not null default 0,

  igst_rate           numeric(5,2) not null default 0,
  igst_amount         numeric(14,2) not null default 0,
  cgst_rate           numeric(5,2) not null default 0,
  cgst_amount         numeric(14,2) not null default 0,
  sgst_rate           numeric(5,2) not null default 0,
  sgst_amount         numeric(14,2) not null default 0,

  charge_line_id      text,
  created_at          timestamptz not null default now(),
  unique (invoice_id, line_no)
);

create index if not exists invoice_lines_invoice_idx on public.invoice_lines (invoice_id);

alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;

-- Per company. Hard separation: an RKS invoice is a different legal entity's
-- document and must not be visible from Kinetic.
create policy "read invoices" on public.invoices
  for select using (tenant_id = auth_tenant_id());

create policy "write invoices" on public.invoices
  for all using (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

create policy "read invoice_lines" on public.invoice_lines
  for select using (exists (
    select 1 from public.invoices i
    where i.id = invoice_lines.invoice_id and i.tenant_id = auth_tenant_id()));

create policy "write invoice_lines" on public.invoice_lines
  for all using (exists (
    select 1 from public.invoices i
    where i.id = invoice_lines.invoice_id and i.tenant_id = auth_tenant_id()))
  with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_lines.invoice_id and i.tenant_id = auth_tenant_id()));

create trigger invoices_audit
after insert or update or delete on public.invoices
for each row execute function public.audit_row_change();

create trigger invoice_lines_audit
after insert or update or delete on public.invoice_lines
for each row execute function public.audit_row_change();
