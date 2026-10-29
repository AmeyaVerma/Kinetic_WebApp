-- Spec data rule 4: "Numbers come from the server. Booking, HBL, MTD, CRO and
-- invoice numbers use one series per company and financial year, are never
-- reused, and a void leaves a visible gap."
--
-- The old invoice number was "KLI-25-" plus the length of an in-memory array,
-- so two people drafting at once got the same number and a refresh started
-- again from the beginning. This allocates from document_sequences, which is
-- atomic and already scoped to the company and the Indian financial year.
--
-- Format follows the house pattern -- KLNVO2627000001 for bookings,
-- RKSF2627000001 for RKS shipments -- so an invoice reads KLF2627000001.
-- Siddharth said "start with KLF01 as dummies" and will advise the real
-- starting point at go-live, so the series is a parameter and the starting
-- value can be set in document_sequences without touching this function.

create or replace function public.allocate_invoice_number(p_series text)
returns table (seq integer, invoice_no text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_fy  text := public.fy_code();
  v_seq integer;
begin
  if public.auth_tenant_id() is null then
    raise exception 'no company in session';
  end if;
  if p_series is null or length(trim(p_series)) = 0 then
    raise exception 'an invoice series is required';
  end if;

  v_seq := public.next_document_number(p_series, v_fy);

  seq := v_seq;
  invoice_no := upper(trim(p_series)) || v_fy || lpad(v_seq::text, 6, '0');
  return next;
end;
$$;

revoke all on function public.allocate_invoice_number(text) from anon;
