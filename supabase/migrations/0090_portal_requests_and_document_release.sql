-- The portal's two request flows and the document release gates (spec v2).
--
-- The governing rule: "Nothing a customer or agent enters goes live without
-- Admin approval." So a portal user never writes a booking or a BL -- they
-- write a REQUEST, and an Admin turns it into the real thing. That is why
-- these are separate tables rather than draft rows in `bookings` and `bls`:
-- a request that is rejected should never have consumed a booking reference
-- or a BL number, and v2 says so outright ("This keeps junk requests from
-- burning numbers").

-- The approvals queue learns the new kinds.
-- v2 lists them: portal account, booking request, draft BL inputs, draft to
-- real BL, HS code addition, document request, amendment request, agent or
-- customer master change. Plus mark-as-paid and a document fee change, which
-- v2 describes as needing approval in their own sections.
alter table public.approvals drop constraint if exists approvals_entity_type_check;

alter table public.approvals add constraint approvals_entity_type_check
  check (entity_type in (
    -- already in use
    'bl_edit', 'invoice', 'repair_estimate', 'booking_request', 'credit_note',
    'credit_hold', 'blacklist', 'agent_gate', 'leave_request',
    'booking_field_edit', 'ff_field_edit', 'party_document', 'booking_costing',
    -- added by spec v2
    'portal_account', 'bl_draft_inputs', 'bl_draft_to_real', 'hs_code_addition',
    'document_request', 'amendment_request', 'master_change',
    'mark_as_paid', 'document_fee_change'
  ));

-- A booking a portal user has asked for, not a booking.
create table if not exists public.booking_requests (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null default default_tenant_id() references public.tenants(id) on delete cascade,

  -- Who asked. Scoped by the same portal_accounts identity that scopes
  -- everything else a portal user can see.
  requested_by_user uuid references auth.users(id) on delete set null,
  party_id          uuid references public.parties(id) on delete set null,
  agent_id          uuid references public.agents(id) on delete set null,

  status text not null default 'Submitted'
         check (status in ('Submitted', 'Under review', 'Approved', 'Rejected')),

  -- The proposed booking, kept as submitted. It is not spread across typed
  -- columns because it is a PROPOSAL -- half of it may be wrong, and forcing
  -- it into the booking's own shape would mean validating it as though it
  -- were already real.
  payload jsonb not null default '{}'::jsonb,

  -- Set only once an Admin approves and the real booking exists.
  booking_id uuid references public.bookings(id) on delete set null,

  reject_reason text,
  decided_by    text,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists booking_requests_status_idx on public.booking_requests (status);

-- Document release: no payment, no document.
-- v2's flow, as states: the customer pays the freight invoice (gate 1),
-- requests a document, an Admin approves, a separate invoice is raised and
-- paid (gate 2), and only then does the file become downloadable through a
-- short-lived link.
create table if not exists public.document_requests (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null default default_tenant_id() references public.tenants(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,

  requested_by_user uuid references auth.users(id) on delete set null,
  doc_type text not null,

  -- The tracker v2 asks for, in the order it describes. 'Invoice sent' and
  -- 'Paid' are distinct from 'Approved' because gate 2 sits between them.
  status text not null default 'Submitted'
         check (status in (
           'Submitted', 'Under review', 'Approved', 'Invoice sent',
           'Paid', 'Ready to download', 'Rejected'
         )),

  -- Which document was released, once one is.
  document_version_id uuid references public.document_versions(id) on delete set null,

  reject_reason text,
  decided_by    text,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists document_requests_booking_idx on public.document_requests (booking_id);
create index if not exists document_requests_status_idx  on public.document_requests (status);

-- Every download is recorded. v2 asks for it explicitly, and a release flow
-- whose whole purpose is "no payment, no document" is worthless if nobody can
-- say afterwards who actually took the file.
create table if not exists public.document_downloads (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null default default_tenant_id() references public.tenants(id) on delete cascade,
  document_request_id uuid references public.document_requests(id) on delete set null,
  booking_id          uuid references public.bookings(id) on delete set null,
  doc_type            text,
  downloaded_by       uuid references auth.users(id) on delete set null,
  downloaded_by_name  text,
  downloaded_at       timestamptz not null default now()
);

create index if not exists document_downloads_request_idx on public.document_downloads (document_request_id);

-- The Zoho-shaped invoice record.
-- v2 overrides the ERP's own invoicing: Zoho is the books, and the ERP keeps
-- a RECORD of an invoice raised there. These columns are added to the
-- existing invoices table rather than put in a new one, so there stays a
-- single answer to "what has been invoiced on this booking".
alter table public.invoices
  add column if not exists kind text
      check (kind is null or kind in ('freight_and_locals', 'document')),
  add column if not exists document_request_id uuid
      references public.document_requests(id) on delete set null,
  add column if not exists pdf_path text,
  add column if not exists published_to_portal boolean not null default false,
  -- Mark as PAID, with how. v2: Kinetic bank, payment gateway, or another
  -- bank (an overseas agent paying abroad), with date, amount, reference and
  -- uploaded proof. Marking paid needs Admin or Approver sign-off because
  -- document release depends on it.
  add column if not exists paid_at timestamptz,
  add column if not exists paid_method text
      check (paid_method is null or paid_method in ('Kinetic bank', 'Payment gateway', 'Other bank')),
  add column if not exists paid_amount numeric,
  add column if not exists paid_reference text,
  add column if not exists paid_proof_path text,
  add column if not exists paid_marked_by text,
  add column if not exists paid_approved_by text;

-- Paid status must come from a server-verified gateway callback or from
-- Accounts, never from the browser (v2). The browser cannot satisfy this:
-- marking paid requires who approved it, and that is set by staff action.
alter table public.invoices drop constraint if exists invoices_paid_needs_approval;
alter table public.invoices add constraint invoices_paid_needs_approval
  check (paid_at is null or paid_approved_by is not null);

-- Row level security.
alter table public.booking_requests    enable row level security;
alter table public.document_requests   enable row level security;
alter table public.document_downloads  enable row level security;

-- Staff see their company's queue.
create policy "staff read booking_requests" on public.booking_requests
  for select using (tenant_id = auth_tenant_id() and is_staff());
create policy "staff write booking_requests" on public.booking_requests
  for all using (tenant_id = auth_tenant_id() and is_staff())
  with check (tenant_id = auth_tenant_id() and is_staff());

-- A portal user sees and raises only their own.
create policy "portal reads own booking_requests" on public.booking_requests
  for select using (requested_by_user = auth.uid());
create policy "portal raises booking_requests" on public.booking_requests
  for insert with check (
    requested_by_user = auth.uid() and portal_kind() is not null and status = 'Submitted'
  );

create policy "staff read document_requests" on public.document_requests
  for select using (tenant_id = auth_tenant_id() and is_staff());
create policy "staff write document_requests" on public.document_requests
  for all using (tenant_id = auth_tenant_id() and is_staff())
  with check (tenant_id = auth_tenant_id() and is_staff());

create policy "portal reads own document_requests" on public.document_requests
  for select using (requested_by_user = auth.uid());
create policy "portal raises document_requests" on public.document_requests
  for insert with check (
    requested_by_user = auth.uid()
    and status = 'Submitted'
    and portal_can_see_booking(booking_id)
  );

-- Downloads are written by the server side and read by staff. A portal user
-- does not get to read or edit the record of who downloaded what.
create policy "staff read document_downloads" on public.document_downloads
  for select using (tenant_id = auth_tenant_id() and is_staff());

create trigger booking_requests_audit
after insert or update or delete on public.booking_requests
for each row execute function public.audit_row_change();

create trigger document_requests_audit
after insert or update or delete on public.document_requests
for each row execute function public.audit_row_change();
