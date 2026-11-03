-- Three more events for the notification outbox (spec v2 lists: approval,
-- rejection, invoice sent, payment confirmed, document ready).
--
--   * an invoice is published to the portal  -> tell the customer it is there
--   * a payment on a published invoice is confirmed -> tell the customer
--   * a document request becomes Ready to download -> tell who asked
--
-- As before, these only write rows to notification_outbox. Nothing is sent: no
-- provider is connected, and the Admin outbox screen says so.

-- Document ready: extend the existing document-request notifier.
create or replace function public.notify_document_request()
returns trigger
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_ref text;
  v_msg text;
begin
  if new.status is distinct from old.status and new.requested_by_user is not null then
    select booking_ref into v_ref from public.bookings where id = new.booking_id;
    v_msg := case new.status
      when 'Approved'           then 'was approved. An invoice for it will follow.'
      when 'Rejected'           then 'was rejected' || coalesce(': ' || new.reject_reason, '.')
      when 'Invoice sent'       then 'has an invoice waiting for payment.'
      when 'Paid'               then 'is paid and will be released.'
      when 'Ready to download'  then 'is ready. You can download it from your portal.'
      else null
    end;
    if v_msg is not null then
      perform public.enqueue_notification(
        new.tenant_id, 'document_request.' || lower(replace(new.status, ' ', '_')), new.requested_by_user,
        'Your ' || new.doc_type || ' request for ' || coalesce(v_ref, 'your booking'),
        'Your request for the ' || new.doc_type || ' on ' || coalesce(v_ref, 'your booking') || ' ' || v_msg,
        'document_request', new.id::text);
    end if;
  end if;
  return new;
end
$fn$;

-- Invoice published, and payment confirmed on a published invoice. Goes to every
-- portal login for the invoice's party.
create or replace function public.notify_invoice_events()
returns trigger
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_ref  text;
  v_user uuid;
  v_event text;
  v_subject text;
  v_body text;
begin
  if new.party_id is null then
    return new;
  end if;

  if new.published_to_portal and not coalesce(old.published_to_portal, false) then
    v_event := 'invoice.published';
    v_subject := 'Invoice ' || coalesce(new.zoho_invoice_id, new.invoice_no) || ' is available';
    v_body := 'An invoice for ' || coalesce((select booking_ref from public.bookings where id = new.booking_id), 'your shipment')
              || ' has been added to your portal.';
  elsif new.paid_at is not null and old.paid_at is null and new.published_to_portal then
    v_event := 'invoice.paid';
    v_subject := 'Payment received for invoice ' || coalesce(new.zoho_invoice_id, new.invoice_no);
    v_body := 'We have confirmed your payment for invoice ' || coalesce(new.zoho_invoice_id, new.invoice_no) || '. Thank you.';
  else
    return new;
  end if;

  for v_user in
    select pa.user_id from public.portal_accounts pa
     where pa.party_id = new.party_id and pa.tenant_id = new.tenant_id
  loop
    perform public.enqueue_notification(new.tenant_id, v_event, v_user, v_subject, v_body, 'invoice', new.id::text);
  end loop;
  return new;
end
$fn$;

drop trigger if exists invoices_notify on public.invoices;
create trigger invoices_notify
after update on public.invoices
for each row execute function public.notify_invoice_events();
