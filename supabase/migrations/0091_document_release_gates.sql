-- "No payment, no document" as two rules the database keeps (spec v2).
--
-- Gate 1: the freight and locals invoice must be PAID before a customer can
--         even request a document.
-- Gate 2: the document's own invoice must be PAID before the file is
--         downloadable.
--
-- v2 is unusually firm about this -- "There is no credit and no pay-later for
-- now. Nothing is released without payment and Admin approval, and there is
-- no override." A rule with no override does not belong in a button's
-- disabled state, where the next screen that forgets to check it becomes the
-- way around it.

-- Gate 1.
create or replace function public.freight_invoice_paid(p_booking uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select exists (
    select 1 from public.invoices i
     where i.booking_id = p_booking
       and coalesce(i.kind, 'freight_and_locals') = 'freight_and_locals'
       and i.paid_at is not null
  )
$fn$;

create or replace function public.guard_document_request()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  -- Staff raising a request on a customer's behalf are not gated: the gate
  -- exists to stop a CUSTOMER asking for documents they have not paid for,
  -- and Accounts may legitimately prepare one in advance.
  if public.portal_kind() is null then
    return new;
  end if;

  if not public.freight_invoice_paid(new.booking_id) then
    raise exception
      'The freight and locals invoice for this booking has not been paid yet, so a document cannot be requested.'
      using errcode = 'restrict_violation';
  end if;

  return new;
end
$fn$;

create trigger document_requests_gate_one
before insert on public.document_requests
for each row execute function public.guard_document_request();

-- Gate 2.
-- Called by whatever creates a download link. It answers with a reason
-- rather than a boolean, because every refusal here is something a person
-- has to be told.
create or replace function public.document_release_blocked_reason(p_request uuid)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_req public.document_requests%rowtype;
  v_paid boolean;
begin
  select * into v_req from public.document_requests where id = p_request;
  if not found then
    return 'That document request does not exist.';
  end if;

  if v_req.status = 'Rejected' then
    return coalesce('This request was rejected: ' || v_req.reject_reason, 'This request was rejected.');
  end if;

  if v_req.status in ('Submitted', 'Under review') then
    return 'This request has not been approved yet.';
  end if;

  -- Gate 2: the document's OWN invoice.
  select exists (
    select 1 from public.invoices i
     where i.document_request_id = v_req.id
       and i.paid_at is not null
  ) into v_paid;

  if not v_paid then
    return 'The invoice for this document has not been paid yet.';
  end if;

  if v_req.document_version_id is null then
    return 'The document has not been generated yet.';
  end if;

  -- Null means nothing is blocking it.
  return null;
end
$fn$;
