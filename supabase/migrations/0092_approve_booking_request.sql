-- Turning a portal booking request into a real booking (spec v2).
--
-- "An Admin must approve it, and only then is it saved into the system with a
-- real booking reference."
--
-- This is one server function rather than a sequence of client calls because
-- the reference allocation and the booking insert must not come apart. If the
-- browser allocated a number and then failed to insert, the number would be
-- burned on nothing -- which is the very thing the request table exists to
-- avoid.

create or replace function public.approve_booking_request(
  p_request uuid,
  p_decided_by text
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_req   public.booking_requests%rowtype;
  v_ref   text;
  v_id    uuid;
  v_p     jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only an Admin can approve a booking request.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_req from public.booking_requests where id = p_request for update;
  if not found then
    raise exception 'That booking request does not exist.' using errcode = 'no_data_found';
  end if;
  if v_req.status = 'Approved' then
    raise exception 'That request was already approved as %.',
      coalesce((select booking_ref from public.bookings where id = v_req.booking_id), 'a booking')
      using errcode = 'restrict_violation';
  end if;
  if v_req.status = 'Rejected' then
    raise exception 'That request was rejected and cannot be approved.'
      using errcode = 'restrict_violation';
  end if;

  v_p := coalesce(v_req.payload, '{}'::jsonb);
  v_ref := public.allocate_booking_ref();

  -- Only the fields a portal user can sensibly propose are taken from the
  -- payload. Anything operational -- depots, vessel, agents, costing -- is
  -- left for staff to set on the real booking, because a customer is not in a
  -- position to choose them and a half-filled booking is easier to finish
  -- than one filled with guesses.
  insert into public.bookings (
    booking_ref, module, direction, booking_party_id, booking_party_name,
    booking_date, shipper, consignee, notify_party,
    pol, pod, commodity, container_type, container_qty,
    packages, package_type, gross_weight_kg, customer_reference,
    cancelled, workflow_status
  ) values (
    v_ref, 'nvocc',
    coalesce(v_p->>'direction', 'Export'),
    v_req.party_id::text,
    coalesce(v_p->>'bookingPartyName', (select display_name from public.parties where id = v_req.party_id)),
    coalesce((v_p->>'bookingDate')::date, current_date),
    v_p->>'shipper', v_p->>'consignee',
    coalesce(v_p->>'notifyParty', 'Same as consignee'),
    v_p->>'pol', v_p->>'pod', v_p->>'commodity',
    v_p->>'containerType',
    nullif(v_p->>'containerQty', '')::int,
    nullif(v_p->>'packages', '')::int,
    v_p->>'packageType',
    nullif(v_p->>'grossWeightKg', '')::numeric,
    v_p->>'customerReference',
    false, 'Booked'
  )
  returning id into v_id;

  update public.booking_requests
     set status = 'Approved',
         booking_id = v_id,
         decided_by = p_decided_by,
         decided_at = now()
   where id = p_request;

  return v_ref;
end
$fn$;

-- Rejecting needs a reason the customer sees (v2).
create or replace function public.reject_booking_request(
  p_request uuid,
  p_reason text,
  p_decided_by text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not public.is_admin() then
    raise exception 'Only an Admin can reject a booking request.'
      using errcode = 'insufficient_privilege';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A rejection needs a reason, which the customer sees.'
      using errcode = 'restrict_violation';
  end if;

  update public.booking_requests
     set status = 'Rejected', reject_reason = p_reason,
         decided_by = p_decided_by, decided_at = now()
   where id = p_request
     and status in ('Submitted', 'Under review');

  if not found then
    raise exception 'That request is not open, so it cannot be rejected.'
      using errcode = 'restrict_violation';
  end if;
end
$fn$;
