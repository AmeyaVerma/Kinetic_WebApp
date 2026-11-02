-- Notification outbox (spec v2).
--
-- An event that should reach a person is written as a ROW here, in the same
-- transaction as the thing that happened. Nothing is sent from this database:
-- no email or WhatsApp provider is connected, and none is invented. A sender
-- (an Edge Function holding a provider key, added later) reads Queued rows,
-- sends them, and marks each Sent or Failed. Until then rows simply wait, which
-- is the honest state -- the screen says "Queued", never "Sent".
--
-- The slot for a provider is the `provider` column plus the status lifecycle:
--   Queued -> Sending -> Sent | Failed (attempts counted, last_error kept)
--   Skipped is for a recipient with no address.
--
-- Events wired now: a document request is decided / invoiced / paid, and a
-- booking request is decided -- each tells the person who made the request.

create table if not exists public.notification_outbox (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id),
  event_type   text not null,
  channel      text not null default 'email' check (channel in ('email', 'whatsapp')),
  recipient    text,
  recipient_user uuid,
  subject      text not null,
  body         text not null,
  entity_type  text,
  entity_id    text,
  status       text not null default 'Queued' check (status in ('Queued', 'Sending', 'Sent', 'Failed', 'Skipped')),
  attempts     integer not null default 0,
  last_error   text,
  provider     text,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);

create index if not exists notification_outbox_status_idx on public.notification_outbox (status, created_at);

alter table public.notification_outbox enable row level security;

-- Staff can look at the queue; nobody writes it from the browser. Rows arrive
-- through enqueue_notification() and leave through the (future) sender.
drop policy if exists "staff read outbox" on public.notification_outbox;
create policy "staff read outbox" on public.notification_outbox for select
  using (tenant_id = public.auth_tenant_id() and public.is_staff());

create or replace function public.enqueue_notification(
  p_tenant uuid, p_event text, p_user uuid, p_subject text, p_body text,
  p_entity_type text, p_entity_id text
)
returns void
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_email text;
begin
  select email into v_email from public.profiles where id = p_user;
  insert into public.notification_outbox
    (tenant_id, event_type, recipient, recipient_user, subject, body, entity_type, entity_id, status)
  values
    (p_tenant, p_event, nullif(trim(v_email), ''), p_user, p_subject, p_body, p_entity_type, p_entity_id,
     case when coalesce(trim(v_email), '') = '' then 'Skipped' else 'Queued' end);
end
$fn$;

revoke all on function public.enqueue_notification(uuid, text, uuid, text, text, text, text) from public, anon, authenticated;

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
      when 'Approved'     then 'was approved. An invoice for it will follow.'
      when 'Rejected'     then 'was rejected' || coalesce(': ' || new.reject_reason, '.')
      when 'Invoice sent' then 'has an invoice waiting for payment.'
      when 'Paid'         then 'is paid and will be released.'
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

drop trigger if exists document_requests_notify on public.document_requests;
create trigger document_requests_notify
after update on public.document_requests
for each row execute function public.notify_document_request();

create or replace function public.notify_booking_request()
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
      when 'Approved' then 'was approved' || coalesce(' as booking ' || v_ref, '') || '.'
      when 'Rejected' then 'was rejected' || coalesce(': ' || new.reject_reason, '.')
      else null
    end;
    if v_msg is not null then
      perform public.enqueue_notification(
        new.tenant_id, 'booking_request.' || lower(new.status), new.requested_by_user,
        'Your booking request',
        'Your booking request ' || v_msg,
        'booking_request', new.id::text);
    end if;
  end if;
  return new;
end
$fn$;

drop trigger if exists booking_requests_notify on public.booking_requests;
create trigger booking_requests_notify
after update on public.booking_requests
for each row execute function public.notify_booking_request();
