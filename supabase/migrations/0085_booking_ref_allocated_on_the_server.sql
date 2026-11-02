-- Booking references were minted in the browser.
--
-- createBooking scanned the bookings already loaded in the store, took the
-- highest sequence it could see, and added one:
--
--     const maxSeq = existing.reduce(...)              // whatever is loaded
--     const bookingRef = `KLNVO2627${pad(maxSeq + 1)}` // FY hard-coded
--
-- Three problems. Two people creating a booking at the same moment both read
-- the same maximum and both mint the same reference. A browser that has not
-- finished fetching sees a lower maximum and reuses a number already issued.
-- And the financial year is the literal '2627', so every booking created
-- after 31 March 2027 would carry the wrong year for ever.
--
-- This is spec M9's "allocated on the server", and the same machinery that
-- already numbers invoices and BLs does it: next_document_number() upserts
-- atomically per tenant, per series, per financial year, so two callers at
-- the same instant get different numbers.
--
-- The sequence is seeded from the highest reference that actually exists, so
-- the next booking continues the series rather than restarting it.

alter table public.company_settings
  add column if not exists booking_series text;

update public.company_settings
   set booking_series = coalesce(booking_series, 'KLNVO');

-- Seed from live data, per tenant, for the current financial year.
insert into public.document_sequences (tenant_id, series, fy_code, last_value)
select b.tenant_id,
       'nvocc_booking',
       public.fy_code(),
       max((regexp_match(b.booking_ref, '^[A-Z]+\d{4}(\d{6})$'))[1]::int)
  from public.bookings b
 where b.booking_ref ~ '^[A-Z]+\d{4}\d{6}$'
 group by b.tenant_id
on conflict (tenant_id, series, fy_code) do nothing;

-- Returns the whole reference, so the browser never assembles one. The
-- series comes from company settings and the year from fy_code(), which is
-- the same April-to-March rule the invoice numbering uses.
create or replace function public.allocate_booking_ref()
returns text
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_series text;
  v_fy     text := public.fy_code();
  v_seq    int;
begin
  if public.auth_tenant_id() is null then
    raise exception 'no tenant in session';
  end if;

  select booking_series into v_series
    from public.company_settings
   where tenant_id = public.auth_tenant_id();

  v_series := coalesce(v_series, 'KLNVO');
  v_seq := public.next_document_number('nvocc_booking', v_fy);

  return v_series || v_fy || lpad(v_seq::text, 6, '0');
end;
$fn$;
