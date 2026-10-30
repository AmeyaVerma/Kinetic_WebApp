-- Approvals had no table. The queue looked complete -- costing waiting on an
-- Admin, a customer's consignee change, a vendor bill -- and every item lived
-- in browser memory. A refresh wiped the lot, so a request raised on Monday
-- was gone by the time anyone looked, and nothing that routes through this
-- queue could actually be relied on: initial costing, BL edits, credit holds,
-- field changes by non-admins, leave.
--
-- Per company. An RKS approval is not Kinetic's business, and the spec's
-- separation rules put approvals firmly on the per-company side.
--
-- `entity_id` is deliberately text: these point at very different things --
-- a booking ref, 'cust:<id>:credit', 'emp:<id>:leave:<reqId>' -- and forcing
-- them into one foreign key would mean either a column per kind or losing the
-- pointer. booking_id is a real reference where one exists, because that is
-- the join everything actually wants.

create table if not exists public.approvals (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null default default_tenant_id() references public.tenants(id) on delete cascade,

  entity_type  text not null check (entity_type in (
                 'bl_edit','invoice','repair_estimate','booking_request','credit_note',
                 'credit_hold','blacklist','agent_gate','leave_request',
                 'booking_field_edit','ff_field_edit','party_document','booking_costing')),
  entity_id    text not null,
  booking_id   uuid references public.bookings(id) on delete cascade,
  /** The booking ref or shipment ref as the app keys it, for rows whose
      entity is not a real booking row. */
  entity_ref   text,

  summary      text not null,
  requested_by text not null,
  requested_at timestamptz not null default now(),
  status       text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),

  -- Decided-by is recorded because the one rule this queue has to keep is
  -- that nobody approves their own request.
  decided_by   text,
  decided_at   timestamptz,
  reject_reason text,

  -- The kind-specific body: proposed BL fields, a single field change, or
  -- charge lines awaiting sign-off. Shapes differ per entity_type, so this
  -- stays jsonb rather than pretending to a common schema.
  payload        jsonb,
  field_change   jsonb,
  charge_payload jsonb,

  created_at   timestamptz not null default now()
);

create index if not exists approvals_status_idx  on public.approvals (status);
create index if not exists approvals_booking_idx on public.approvals (booking_id);

alter table public.approvals enable row level security;

create policy "read approvals" on public.approvals
  for select using (tenant_id = auth_tenant_id());

create policy "write approvals" on public.approvals
  for all using (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

create trigger approvals_audit
after insert or update or delete on public.approvals
for each row execute function public.audit_row_change();
