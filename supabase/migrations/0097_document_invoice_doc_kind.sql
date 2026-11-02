-- raise_document_invoice wrote doc_kind = 'Document', which the existing check
-- on invoices.doc_kind (Proforma / Tax Invoice / Credit Note / Vendor Bill)
-- rejects. Found by running the workflow end to end.
--
-- doc_kind is the ACCOUNTING kind of the document; whether an invoice is for
-- freight or for a released document is what the new `kind` column says. A
-- document invoice starts life as a Proforma, which is also what it is: the GST
-- invoice is raised in Zoho by hand (v2), and the ERP keeps only the record.
-- The existing constraint is left alone rather than widened to carry a second
-- meaning.

create or replace function public.raise_document_invoice(p_request uuid)
returns text
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_req    public.document_requests%rowtype;
  v_b      public.bookings%rowtype;
  v_fee    numeric;
  v_series text;
  v_seq    int;
  v_no     text;
  v_me     text;
begin
  if not public.is_staff() then
    raise exception 'Only staff can raise an invoice.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_req from public.document_requests
   where id = p_request and tenant_id = public.auth_tenant_id() for update;
  if not found then
    raise exception 'That document request does not exist.' using errcode = 'no_data_found';
  end if;
  if v_req.status <> 'Approved' then
    raise exception 'The request is %; an invoice is raised only once it is Approved.', v_req.status
      using errcode = 'restrict_violation';
  end if;
  if exists (select 1 from public.invoices where document_request_id = p_request) then
    raise exception 'An invoice has already been raised for this request.'
      using errcode = 'restrict_violation';
  end if;

  -- The refusal, with its reason, for a fee nobody has priced.
  v_fee := public.document_fee_for(v_req.doc_type);

  select * into v_b from public.bookings where id = v_req.booking_id;
  select coalesce(invoice_series, 'KLF') into v_series
    from public.company_settings where tenant_id = public.auth_tenant_id();
  select a.seq, a.invoice_no into v_seq, v_no from public.allocate_invoice_number(coalesce(v_series, 'KLF')) a;
  select name into v_me from public.profiles where id = auth.uid();

  insert into public.invoices
    (invoice_no, series, fy_code, seq, type, doc_kind, status, booking_id, party_id, party_name,
     invoice_date, currency, total_inr, subtotal, kind, document_request_id,
     published_to_portal, created_by, prepared_by)
  values
    (v_no, coalesce(v_series, 'KLF'), public.fy_code(), v_seq, 'AR', 'Proforma', 'Draft',
     v_req.booking_id,
     case when v_b.booking_party_id ~ '^[0-9a-f-]{36}$' then v_b.booking_party_id::uuid end,
     v_b.booking_party_name, current_date, 'INR', v_fee, v_fee, 'document', p_request,
     false, v_me, v_me);

  return v_no;
end
$fn$;
