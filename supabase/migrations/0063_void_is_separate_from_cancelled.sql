-- Spec F5: "Void booking cancelled the booking at once with no confirmation
-- and a fixed reason, 'Ops request'." The fix asks for a confirm dialog, a
-- mandatory reason, a restricted role, and Void kept separate from Cancelled.
--
-- They are different events. A booking is CANCELLED when it was real and the
-- customer called it off. It is VOID when it should never have existed -- a
-- mis-key, a duplicate -- and the spec's numbering rule says a void "leaves a
-- visible gap", which only makes sense if the two are distinguishable.
--
-- `cancelled` stays as the flag that stops a booking either way, so nothing
-- that reads it changes behaviour. These columns record which of the two it
-- was, why, and who decided.

alter table public.bookings
  add column if not exists voided    boolean not null default false,
  add column if not exists void_reason text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by text,
  add column if not exists cancel_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text;

alter table public.bookings
  drop constraint if exists bookings_void_needs_reason;
alter table public.bookings
  add constraint bookings_void_needs_reason
  check (not voided or (void_reason is not null and length(trim(void_reason)) >= 3));
