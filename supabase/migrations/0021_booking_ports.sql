-- New Ports section on Shipment details: Port of Receipt and Final Place
-- of Discharge are new fields; pol/pod are reused as-is (relabeled to
-- "Port of Loading" / "Port of Destination" in the UI only). transhipment
-- is a simple Yes/No flag, distinct from the existing free-text
-- transshipment_agent field.

alter table public.bookings
  add column port_of_receipt text,
  add column final_place_of_discharge text,
  add column transhipment text check (transhipment in ('Yes', 'No'));
