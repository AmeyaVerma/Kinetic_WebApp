-- Record an invoice that was raised in Zoho (spec v2: Zoho is the books).
--
-- The ERP does no GST calculation here and never writes to Zoho. Staff raise
-- the invoice in Zoho by hand and enter its number, amount, currency, bill-to
-- and PDF; this keeps that as a record against the booking, under the ERP's
-- own atomically allocated number. The Zoho number goes in zoho_invoice_id and
-- the same Zoho number cannot be recorded twice. total_inr is NOT NULL, and no
-- exchange rate is invented, so it holds the amount for an INR invoice and 0
-- for a USD one; the real USD amount is in subtotal with currency = 'USD'.
-- USD and INR are therefore never summed together.

create or replace function public.create_invoice_record(
  p_booking uuid, p_kind text, p_zoho_no text, p_amount numeric,
  p_currency text, p_bill_to text, p_pdf_path text default null
)
returns text
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_b      public.bookings%rowtype;
  v_series text;
  v_seq    int;
  v_no     text;
  v_me     text;
begin
  if not public.is_staff() then
    raise exception 'Only staff can add an invoice record.' using errcode = 'insufficient_privilege';
  end if;
  if p_kind not in ('freight_and_locals', 'document') then
    raise exception 'Choose freight and locals, or document.' using errcode = 'restrict_violation';
  end if;
  if coalesce(trim(p_zoho_no), '') = '' then
    raise exception 'Enter the Zoho invoice number. The invoice is raised in Zoho; this is only its record.'
      using errcode = 'restrict_violation';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'Enter the invoice amount.' using errcode = 'restrict_violation';
  end if;
  if p_currency not in ('INR', 'USD') then
    raise exception 'Currency must be INR or USD.' using errcode = 'restrict_violation';
  end if;

  select * into v_b from public.bookings where id = p_booking and tenant_id = public.auth_tenant_id();
  if not found then
    raise exception 'That booking does not exist.' using errcode = 'no_data_found';
  end if;

  -- The same Zoho invoice recorded twice would make one real invoice look like
  -- two receivables.
  if exists (select 1 from public.invoices
              where tenant_id = public.auth_tenant_id() and zoho_invoice_id = trim(p_zoho_no)) then
    raise exception 'Zoho invoice % is already recorded.', trim(p_zoho_no)
      using errcode = 'restrict_violation';
  end if;

  select coalesce(invoice_series, 'KLF') into v_series
    from public.company_settings where tenant_id = public.auth_tenant_id();
  select a.seq, a.invoice_no into v_seq, v_no from public.allocate_invoice_number(coalesce(v_series, 'KLF')) a;
  select name into v_me from public.profiles where id = auth.uid();

  insert into public.invoices
    (invoice_no, series, fy_code, seq, type, doc_kind, status, booking_id, party_id, party_name,
     invoice_date, currency, subtotal, total_inr, kind, zoho_invoice_id, pdf_path,
     published_to_portal, created_by, prepared_by)
  values
    (v_no, coalesce(v_series, 'KLF'), public.fy_code(), v_seq, 'AR', 'Tax Invoice', 'Draft',
     p_booking,
     case when v_b.booking_party_id ~ '^[0-9a-f-]{36}$' then v_b.booking_party_id::uuid end,
     coalesce(nullif(trim(p_bill_to), ''), v_b.booking_party_name),
     current_date, p_currency, p_amount,
     case when p_currency = 'INR' then p_amount else 0 end,
     p_kind, trim(p_zoho_no), p_pdf_path, false, v_me, v_me);

  return v_no;
end
$fn$;
