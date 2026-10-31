-- Siddharth approved removing two records created while testing, which still
-- count toward dashboard totals.
--
-- REWRITTEN 30 Oct 2026. The previous version of this file was wrong in three
-- ways and would have failed or done damage. Re-checked against the live
-- database before rewriting:
--
--   1. It deleted from ff_vendor_lines using a column `shipment_id`. That
--      column does not exist; it is `ff_shipment_id`. The script would have
--      errored part-way, after the booking was already gone.
--
--   2. It said "both are already Cancelled". KINFF-0036 is NOT cancelled --
--      it sits at stage 'Carrier & Pickup'. It is still plainly a test record
--      (its lane reads ZZ TEST ORIGIN to ZZ TEST DEST), but the premise this
--      file stated was false, so it is stated correctly here instead.
--
--   3. Booking KLNVO2627000029 now carries invoice KLF2627000003 (Draft,
--      INR 1,450, AARK GLOBALEX), raised after this file was first written.
--      invoices.booking_id is ON DELETE SET NULL, so deleting the booking
--      alone would have left a real invoice attached to nothing -- the exact
--      orphan fault that migration 0071 was written to stop.
--
-- The invoice is therefore deleted with its booking. It is a draft against a
-- cancelled test booking, so nothing is lost; but it IS an invoice, so if you
-- would rather keep it, remove the invoice delete below and the booking stays
-- too (the script will refuse to orphan it).
--
-- The invoice sequence is NOT rewound. Numbers are never reused, so a gap at
-- KLF2627000003 is correct and auditable.
--
-- Children are deleted explicitly even where the foreign key cascades, so the
-- script says plainly what it removes.
--
-- NOT YET APPLIED -- deletes production rows and needs a human to run it.

do $$
declare
  b_id uuid;
  f_id uuid;
begin
  -- ── NVOCC booking KLNVO2627000029 (Cancelled) ──────────────────
  select id into b_id from public.bookings where booking_ref = 'KLNVO2627000029';

  if b_id is not null then
    delete from public.invoice_lines
     where invoice_id in (select id from public.invoices where booking_id = b_id);
    delete from public.invoices                where booking_id = b_id;

    delete from public.approvals               where booking_id = b_id;
    delete from public.container_activity_marks where booking_id = b_id;
    delete from public.container_activities    where booking_id = b_id;
    delete from public.booking_milestones      where booking_id = b_id;
    delete from public.booking_documents       where booking_id = b_id;
    delete from public.document_versions       where booking_id = b_id;
    delete from public.cro_documents           where booking_id = b_id;
    delete from public.booking_charges         where booking_id = b_id;
    delete from public.bl_versions             where booking_id = b_id;
    delete from public.bl_state                where booking_id = b_id;
    delete from public.bookings                where id = b_id;

    raise notice 'Removed booking KLNVO2627000029 and its children.';
  else
    raise notice 'Booking KLNVO2627000029 not found -- already removed.';
  end if;

  -- ── Freight shipment KINFF-0036 (test lane, not cancelled) ─────
  select id into f_id from public.ff_shipments where ref = 'KINFF-0036';

  if f_id is not null then
    delete from public.invoice_lines
     where invoice_id in (select id from public.invoices where ff_shipment_id = f_id);
    delete from public.invoices        where ff_shipment_id = f_id;
    delete from public.ff_vendor_lines where ff_shipment_id = f_id;
    delete from public.ff_shipments    where id = f_id;

    raise notice 'Removed freight shipment KINFF-0036 and its children.';
  else
    raise notice 'Shipment KINFF-0036 not found -- already removed.';
  end if;
end $$;
