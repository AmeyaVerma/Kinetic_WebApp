-- The staff half of document release, and Mark as Paid (spec v2).
--
-- Each step is one server function so it cannot be half-done, and none of
-- them trusts the browser for WHO did it: the person is read from the
-- signed-in profile.
--
-- The flow, in v2's words: the customer requests a document; an Admin
-- approves or rejects it with a reason; a separate invoice for that document
-- is sent and paid; only then does the file become downloadable.
--
-- NOTE: raise_document_invoice is redefined in 0097, which corrects the
-- doc_kind it writes. 0097 is the live version.

-- 1. Approve or reject a document request.
create or replace function public.decide_document_request(
  p_request uuid, p_approve boolean, p_reason text default null
)
returns void
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_me text;
begin
  if not public.is_approver() then
    raise exception 'Only an Admin or an Approver can decide a document request.'
      using errcode = 'insufficient_privilege';
  end if;
  if not p_approve and coalesce(trim(p_reason), '') = '' then
    raise exception 'A rejection needs a reason, which the customer sees.'
      using errcode = 'restrict_violation';
  end if;

  select name into v_me from public.profiles where id = auth.uid();

  update public.document_requests
     set status = case when p_approve then 'Approved' else 'Rejected' end,
         reject_reason = case when p_approve then null else p_reason end,
         decided_by = v_me, decided_at = now()
   where id = p_request
     and tenant_id = public.auth_tenant_id()
     and status in ('Submitted', 'Under review');

  if not found then
    raise exception 'That request is not open, so it cannot be decided.'
      using errcode = 'restrict_violation';
  end if;
end
$fn$;

-- 2. Raise the document's own invoice, priced from the fee table.
-- document_fee_for() REFUSES a fee that still reads "Test Data", so this
-- cannot raise an invoice from a placeholder. (Body in 0097.)
create or replace function public.raise_document_invoice(p_request uuid)
returns text
language plpgsql security definer set search_path to 'public'
as $fn$
begin
  raise exception 'superseded by migration 0097';
end
$fn$;

-- 3. Publish an invoice to the portal.
create or replace function public.publish_invoice(p_invoice uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_doc uuid;
begin
  if not public.is_staff() then
    raise exception 'Only staff can publish an invoice.' using errcode = 'insufficient_privilege';
  end if;

  update public.invoices set published_to_portal = true
   where id = p_invoice and tenant_id = public.auth_tenant_id()
  returning document_request_id into v_doc;
  if not found then
    raise exception 'That invoice does not exist.' using errcode = 'no_data_found';
  end if;

  -- v2's tracker: "Invoice sent" is its own state, between Approved and Paid.
  if v_doc is not null then
    update public.document_requests set status = 'Invoice sent'
     where id = v_doc and status = 'Approved';
  end if;
end
$fn$;

-- 4. Mark as Paid, which needs an Admin or Approver to agree.
-- Any staff member records HOW it was paid; that becomes an approval. v2:
-- "marking Paid needs approval from an Admin or an Approver, and is audited",
-- because document release depends on it.
create or replace function public.request_mark_paid(
  p_invoice uuid, p_method text, p_amount numeric, p_reference text,
  p_paid_on date, p_proof_path text default null
)
returns void
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_inv public.invoices%rowtype;
  v_me  text;
begin
  if not public.is_staff() then
    raise exception 'Only staff can record a payment.' using errcode = 'insufficient_privilege';
  end if;
  if p_method not in ('Kinetic bank', 'Payment gateway', 'Other bank') then
    raise exception 'Choose how it was paid: Kinetic bank, Payment gateway or Other bank.'
      using errcode = 'restrict_violation';
  end if;
  if coalesce(trim(p_reference), '') = '' then
    raise exception 'A payment reference (UTR or receipt number) is required.'
      using errcode = 'restrict_violation';
  end if;

  select * into v_inv from public.invoices
   where id = p_invoice and tenant_id = public.auth_tenant_id();
  if not found then
    raise exception 'That invoice does not exist.' using errcode = 'no_data_found';
  end if;
  if v_inv.paid_at is not null then
    raise exception 'That invoice is already marked paid.' using errcode = 'restrict_violation';
  end if;
  if exists (select 1 from public.approvals
              where entity_type = 'mark_as_paid' and entity_id = p_invoice::text and status = 'Pending') then
    raise exception 'A payment for this invoice is already waiting for approval.'
      using errcode = 'restrict_violation';
  end if;

  select name into v_me from public.profiles where id = auth.uid();

  insert into public.approvals
    (tenant_id, entity_type, entity_id, booking_id, entity_ref, summary, requested_by, status, payload)
  values
    (public.auth_tenant_id(), 'mark_as_paid', p_invoice::text, v_inv.booking_id, v_inv.invoice_no,
     'Mark ' || v_inv.invoice_no || ' as paid (' || p_method || ', ref ' || p_reference || ')',
     coalesce(v_me, 'Staff'), 'Pending',
     jsonb_build_object('method', p_method, 'amount', p_amount, 'reference', p_reference,
                        'paidOn', p_paid_on, 'proofPath', p_proof_path));
end
$fn$;

-- Approving that request is what applies the payment. Done in a trigger so the
-- effect follows the decision wherever it is made from, and no screen has to
-- remember to do it.
create or replace function public.apply_approved_payment()
returns trigger
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_inv uuid := new.entity_id::uuid;
  v_doc uuid;
begin
  if new.entity_type = 'mark_as_paid'
     and old.status = 'Pending' and new.status = 'Approved' then

    update public.invoices
       set paid_at          = coalesce((new.payload->>'paidOn')::timestamptz, now()),
           paid_method      = new.payload->>'method',
           paid_amount      = nullif(new.payload->>'amount', '')::numeric,
           paid_reference   = new.payload->>'reference',
           paid_proof_path  = new.payload->>'proofPath',
           paid_marked_by   = new.requested_by,
           paid_approved_by = coalesce(new.decided_by, 'approver'),
           status           = 'Paid'
     where id = v_inv
    returning document_request_id into v_doc;

    -- A paid DOCUMENT invoice moves its request along the tracker.
    if v_doc is not null then
      update public.document_requests set status = 'Paid'
       where id = v_doc and status in ('Approved', 'Invoice sent');
    end if;
  end if;
  return new;
end
$fn$;

drop trigger if exists approvals_apply_payment on public.approvals;
create trigger approvals_apply_payment
after update on public.approvals
for each row execute function public.apply_approved_payment();
