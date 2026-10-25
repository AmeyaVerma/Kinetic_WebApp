-- Every value the six documents print now lives on the booking.
--
-- Siddharth's instruction, which reverses rule A6 of the original brief:
-- documents take all their detail from the booking, and anything the booking
-- cannot supply is added to the booking for the user to fill in -- not typed
-- onto the document. One source of truth instead of the same fact living in
-- two places and drifting.
--
-- Consequence worth stating: a field needed by ONE document becomes a column
-- on EVERY booking. The import-only fields (IGM, arrival date, destuffing)
-- will sit empty on export bookings. That is the accepted trade for not
-- having per-document copies of the same data.
--
-- Three of these already exist and only needed resolving against their
-- masters rather than adding: empty_yard_id (depot), surveyor_id (surveyor)
-- and terminal. Wiring those up closes the gap where changing the depot on a
-- booking did not reach the CRO, DO or Off Loading Letter.

alter table public.bookings
  -- Bill of Lading -------------------------------------------------------
  add column if not exists pre_carriage_by text,
  add column if not exists freight_payable_at text,
  add column if not exists measurement_m3 numeric,
  add column if not exists other_particulars text,
  -- The one field Siddharth wants typed by hand on the BL itself.
  add column if not exists cargo_description text,

  -- Shared across several documents --------------------------------------
  -- The customer's own reference, distinct from booking_ref.
  add column if not exists customer_reference text,
  add column if not exists shipping_line text,
  add column if not exists shipment_type text,     -- FCL / LCL
  add column if not exists shipment_terms text,    -- e.g. Port to Port
  add column if not exists cfs text,
  add column if not exists net_weight_kg numeric,
  -- Vessel sailed: printed as POL / SOB on the Onboard Confirmation.
  add column if not exists shipped_on_board date,
  add column if not exists hbl_date date,
  add column if not exists mbl_date date,

  -- Import documents (CAN, Delivery Order, Off Loading) -------------------
  add column if not exists igm_no text,
  add column if not exists igm_date date,
  add column if not exists item_number text,
  add column if not exists arrival_date date,
  add column if not exists cha_id uuid references public.chas(id),
  add column if not exists destuffing_type text,
  add column if not exists place_of_survey text,
  add column if not exists do_number text,
  add column if not exists do_to text,
  add column if not exists do_valid_upto date,
  add column if not exists do_type text,
  -- Where the empties go back. Distinct from empty_yard_id, which is the
  -- yard the empties were picked up from on an export.
  add column if not exists return_depot_id uuid references public.empty_depots(id),

  -- Export documents (CRO, Onboard) ---------------------------------------
  add column if not exists cro_valid_till date,
  add column if not exists sb_number text,
  add column if not exists sb_date date;

-- empty_yard_id and surveyor_id are text today, holding mock ids like 'd10'
-- and 'vn2' rather than master keys. Adding proper uuid links alongside
-- leaves the existing values untouched while the documents read from these.
alter table public.bookings
  add column if not exists depot_id uuid references public.empty_depots(id),
  add column if not exists surveyor_ref_id uuid references public.surveyors(id);

comment on column public.bookings.cargo_description is
  'The only document value Siddharth wants typed by hand. Everything else on a document comes from a structured booking field.';
comment on column public.bookings.depot_id is
  'Depot master link. The legacy empty_yard_id holds mock ids and is left alone.';
