-- Days of Credit — payment terms extended to the customer on a new FF
-- booking, capped at 75 days in the wizard. Any nonzero value holds the
-- booking for Admin approval (see createFfShipment's creditHold logic —
-- same mechanism as the existing sell-amount credit gate).

alter table public.ff_shipments
  add column if not exists days_of_credit int not null default 0;
