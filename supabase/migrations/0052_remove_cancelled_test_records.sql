-- Siddharth approved removing the two records created while testing, which
-- still count toward dashboard totals: NVOCC booking KLNVO2627000029 (with the
-- CRO issued against it and the gate-out logged for container KLCU4001234)
-- and freight shipment KINFF-0036. Both are already Cancelled.
--
-- Children go first: booking_documents, cro_documents, container_activities,
-- container_activity_marks, booking_milestones and booking_charges are keyed
-- to the booking, and not all of them cascade.
--
-- NOT YET APPLIED -- deletes production rows and needs a human to run it.

do $$
declare
  b_id uuid;
begin
  select id into b_id from public.bookings where booking_ref = 'KLNVO2627000029';

  if b_id is not null then
    delete from public.container_activity_marks where booking_id = b_id;
    delete from public.container_activities    where booking_id = b_id;
    delete from public.booking_milestones      where booking_id = b_id;
    delete from public.booking_documents       where booking_id = b_id;
    delete from public.cro_documents           where booking_id = b_id;
    delete from public.booking_charges         where booking_id = b_id;
    delete from public.bl_versions             where booking_id = b_id;
    delete from public.bl_state                where booking_id = b_id;
    delete from public.bookings                where id = b_id;
  end if;
end $$;

delete from public.ff_vendor_lines
where shipment_id in (select id from public.ff_shipments where ref = 'KINFF-0036');

delete from public.ff_shipments where ref = 'KINFF-0036';
