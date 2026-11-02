-- Several BLs per booking (spec v2).
--
-- bl_state's PRIMARY KEY is booking_id, so one booking could hold exactly one
-- BL by construction. v2 needs one booking to carry one BL, several House
-- BLs, or House BLs plus a Master BL that covers them.
--
-- Two different axes were previously squashed into bl_type. What the document
-- IS (House or Master) is not the same question as how it PRINTS (Draft,
-- Original, Surrender, Seaway, RFS). A Surrender House BL and a Surrender
-- Master BL are both meaningful, so `role` and `bl_type` are separate columns.
--
-- bl_state is NOT dropped. The app still reads it, and the four existing rows
-- are copied here rather than moved, so nothing breaks while the screens are
-- rebuilt. Removing it is a later, deliberate step once nothing reads it.

create table if not exists public.bls (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null default default_tenant_id() references public.tenants(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,

  role    text not null check (role in ('House', 'Master')),
  bl_type text not null default 'Draft'
          check (bl_type in ('Draft', 'Original', 'Surrender', 'Seaway', 'RFS')),
  print_mode text not null default 'Original' check (print_mode in ('Original', 'Scan')),

  -- Allocated from the BL series and never reused. A cancelled BL KEEPS its
  -- number and is marked Cancelled, which is why this is not cleared on
  -- cancellation.
  bl_number text unique,

  -- The carrier's own references, which v2 asks for so house BLs can be tied
  -- to the master they travel under.
  mbl_number         text,
  carrier_name       text,
  carrier_booking_no text,

  lifecycle text not null default 'Draft',
  status    text not null default 'Draft'
            check (status in ('Draft', 'Issued', 'Released', 'Cancelled')),

  current_fields      jsonb not null default '{}'::jsonb,
  use_container_sheet boolean not null default false,

  -- A House BL may be covered by a Master BL on the same booking. Self
  -- reference rather than a join table: a house travels under at most one
  -- master, so the cardinality is already right.
  master_bl_id uuid references public.bls(id) on delete set null,

  issued_at  timestamptz,
  issued_by  uuid references auth.users(id),
  cancelled_at   timestamptz,
  cancel_reason  text,

  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists bls_booking_idx on public.bls (booking_id);
create index if not exists bls_master_idx  on public.bls (master_bl_id);
create index if not exists bls_number_idx  on public.bls (bl_number);

-- Containers split across BLs.
-- booking_id and role are copied from the parent BL by the trigger below.
-- They are denormalised on purpose: the one rule v2 states about container
-- allocation needs them in the same row to be expressible as an index.
create table if not exists public.bl_containers (
  id           uuid primary key default gen_random_uuid(),
  bl_id        uuid not null references public.bls(id) on delete cascade,
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  role         text not null check (role in ('House', 'Master')),
  container_no text not null,
  packages     int,
  gross_weight_kg numeric,
  created_at   timestamptz not null default now(),
  unique (bl_id, container_no)
);

create index if not exists bl_containers_bl_idx on public.bl_containers (bl_id);

-- "A container can sit on one House BL and also on the Master BL, but not on
-- two House BLs." Enforced here rather than in the app, because splitting
-- containers wrongly is the kind of mistake that is only noticed when two
-- documents claim the same box.
create unique index if not exists bl_containers_one_house_per_container
  on public.bl_containers (booking_id, container_no)
  where role = 'House';

-- The denormalised columns are filled from the parent, never passed in, so
-- they cannot disagree with it.
create or replace function public.bl_container_inherit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_booking uuid;
  v_role    text;
begin
  select booking_id, role into v_booking, v_role from public.bls where id = new.bl_id;
  if v_booking is null then
    raise exception 'BL % does not exist', new.bl_id;
  end if;
  new.booking_id := v_booking;
  new.role := v_role;
  return new;
end
$fn$;

create trigger bl_containers_inherit
before insert or update of bl_id on public.bl_containers
for each row execute function public.bl_container_inherit();

-- A Master BL needs something to cover.
-- v2: "Opening an MBL requires at least one House BL."
create or replace function public.guard_master_bl()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if new.role = 'Master' and not exists (
    select 1 from public.bls b
     where b.booking_id = new.booking_id
       and b.role = 'House'
       and b.id <> new.id
  ) then
    raise exception
      'A Master BL covers House BLs, and this booking has none yet. Create a House BL first.'
      using errcode = 'restrict_violation';
  end if;
  return new;
end
$fn$;

create trigger bls_guard_master
before insert on public.bls
for each row execute function public.guard_master_bl();

-- Row level security, matching the rest of the booking.
alter table public.bls           enable row level security;
alter table public.bl_containers enable row level security;

create policy "read bls" on public.bls
  for select using (tenant_id = auth_tenant_id() and can_read_nvocc());
create policy "write bls" on public.bls
  for all using (tenant_id = auth_tenant_id() and can_write_nvocc())
  with check (tenant_id = auth_tenant_id() and can_write_nvocc());

-- A portal user reads the BLs of a booking they may already read. Customers
-- see House BLs only -- v2 is explicit that the Master BL is internal.
create policy "portal reads its house bls" on public.bls
  for select using (
    role = 'House' and portal_can_see_booking(booking_id)
  );

create policy "read bl_containers" on public.bl_containers
  for select using (
    exists (select 1 from public.bls b where b.id = bl_containers.bl_id)
  );
create policy "write bl_containers" on public.bl_containers
  for all using (can_write_nvocc()) with check (can_write_nvocc());

create trigger bls_audit
after insert or update or delete on public.bls
for each row execute function public.audit_row_change();

create trigger bl_containers_audit
after insert or update or delete on public.bl_containers
for each row execute function public.audit_row_change();

-- Carry the four existing BLs across as House BLs.
-- Copied, not moved. Everything that reads bl_state keeps working.
insert into public.bls
  (tenant_id, booking_id, role, bl_type, print_mode, bl_number, mbl_number,
   lifecycle, status, current_fields, use_container_sheet, issued_at, issued_by,
   created_by)
select s.tenant_id, s.booking_id, 'House', s.bl_type, s.print_mode, s.bl_number,
       s.mbl_number, s.lifecycle, s.status, coalesce(s.current_fields, '{}'::jsonb),
       coalesce(s.use_container_sheet, false), s.issued_at, s.issued_by,
       'migrated from bl_state'
  from public.bl_state s
 where not exists (select 1 from public.bls b where b.booking_id = s.booking_id);
