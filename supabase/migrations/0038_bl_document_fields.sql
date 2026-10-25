-- BL Maker (CR-01): extend bl_state rather than introduce a second BL table.
--
-- RECONCILING WITH WHAT EXISTS. bl_state already carries two columns that
-- overlap the brief's single "BL Type" dropdown, and they are not the same
-- axis as each other:
--
--   lifecycle    Draft | Edited | Awaiting approval | Approved | Released
--                -- the approval workflow (ops direct, agent versioned,
--                   customer approval-gated). Untouched here.
--   release_type Original | Telex | Seaway
--                -- how the BL is released to the consignee.
--
-- The brief's five types (Draft, Original, Surrender, Seaway, RFS) span both:
-- Draft is a lifecycle value; Original and Seaway are release types;
-- SURRENDER IS WHAT release_type CALLS "Telex" (telex release and surrender
-- are the same commercial act); and RFS is neither -- Received for Shipment
-- describes cargo status, not release.
--
-- So: `bl_type` is the printed document type -- it decides the red label, the
-- backside and the Number of Originals rule, nothing else. `lifecycle` keeps
-- owning approvals. `release_type` is kept in step by the trigger below so
-- the existing release flow and the printed form cannot disagree.

alter table public.bl_state
  -- KLNVO + FY code + 6-digit sequence. Allocated once, never changes across
  -- versions or type changes.
  add column if not exists bl_number text,
  add column if not exists bl_type text not null default 'Draft'
    check (bl_type in ('Draft', 'Original', 'Surrender', 'Seaway', 'RFS')),
  -- Only meaningful when bl_type = 'Original'.
  add column if not exists print_mode text not null default 'Original'
    check (print_mode in ('Original', 'Scan')),
  -- The Kinetic form is the HBL. An MBL is a data record carrying the
  -- carrier's own number: typed in, never printed on the Kinetic form.
  add column if not exists mbl_number text,
  add column if not exists status text not null default 'Draft'
    check (status in ('Draft', 'Issued')),
  add column if not exists issued_at timestamptz,
  add column if not exists issued_by uuid references auth.users(id),
  -- When on, the BL body prints "AS PER ATTACHED CONTAINER SHEET".
  add column if not exists use_container_sheet boolean not null default false;

-- One BL number per booking, enforced in the database rather than only in
-- the UI: acceptance check 14 requires a second HBL on a booking to be
-- rejected, and bl_state is keyed by booking_id so that holds by construction.
create unique index if not exists bl_state_bl_number_key
  on public.bl_state (tenant_id, bl_number) where bl_number is not null;

-- Keep release_type in step with the printed type so the two cannot drift.
-- Draft and RFS say nothing about release, so they leave it alone.
create or replace function public.sync_bl_release_type()
returns trigger
language plpgsql
as $$
begin
  new.release_type := case new.bl_type
    when 'Original'  then 'Original'
    when 'Surrender' then 'Telex'   -- same act, existing vocabulary
    when 'Seaway'    then 'Seaway'
    else new.release_type
  end;
  return new;
end;
$$;

drop trigger if exists bl_state_sync_release_type on public.bl_state;
create trigger bl_state_sync_release_type
  before insert or update of bl_type on public.bl_state
  for each row execute function public.sync_bl_release_type();
