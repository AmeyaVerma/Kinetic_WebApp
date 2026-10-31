-- The Vendors group (spec v2): CFS, Empty Container Yard and Surveyor, each
-- its own master, all sharing the shape the Agents master established in
-- 0076 -- company, branches, contacts, documents.
--
-- empty_depots and surveyors already exist and are REFERENCED BY BOOKINGS
-- (6 and 4 respectively), so they are extended in place. v2 says the yard
-- master "replaces the hard-coded list of 13 depots"; those 13 are already
-- real rows since 0045, so there is nothing to replace, only to add to.
-- Dropping and recreating would break live bookings.
--
-- CFS is genuinely new.

create table if not exists public.cfs (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null default default_tenant_id() references public.tenants(id) on delete cascade,
  code       text unique,
  name       text not null,
  tax_id     text,
  status     text not null default 'Inactive' check (status in ('Active', 'Inactive')),
  sales_person text,
  review_status text not null default 'Needs review'
                check (review_status in ('Ready', 'Needs review')),
  review_note text,
  source_ref  text,
  created_at timestamptz not null default now(),
  created_by text
);

-- The columns v2 adds to every master in this group. Status so a record can
-- be retired rather than deleted; the review pair so an imported row carries
-- the reviewer's judgement instead of the importer pretending the data is
-- clean.
alter table public.empty_depots
  add column if not exists status text not null default 'Active'
      check (status in ('Active', 'Inactive')),
  add column if not exists review_status text not null default 'Ready'
      check (review_status in ('Ready', 'Needs review')),
  add column if not exists review_note text,
  add column if not exists source_ref text,
  add column if not exists sales_person text;

-- surveyors already had `active`; keep it and add the review pair beside it
-- rather than inventing a second status that could disagree with the first.
alter table public.surveyors
  add column if not exists review_status text not null default 'Ready'
      check (review_status in ('Ready', 'Needs review')),
  add column if not exists review_note text,
  add column if not exists source_ref text,
  add column if not exists sales_person text,
  add column if not exists state text,
  add column if not exists country text,
  add column if not exists tax_id text;

-- Branches, contacts, documents for all three. Several supplied rows are one
-- company at many sites: SAI Marine Container Services at four yards,
-- Transworld Terminals at two, Speedy Multimodes at two. v2 wants one company
-- record with branches, so the shape has to exist before the import, even
-- though the import loads rows flat and leaves merging to a person.

create table if not exists public.cfs_branches (
  id uuid primary key default gen_random_uuid(),
  cfs_id uuid not null references public.cfs(id) on delete cascade,
  label text, address_raw text, address_line text, city text, state text,
  country text, postal_code text, location_code text, working_hours text,
  gate_timings text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.empty_depot_branches (
  id uuid primary key default gen_random_uuid(),
  depot_id uuid not null references public.empty_depots(id) on delete cascade,
  label text, address_raw text, address_line text, city text, state text,
  country text, postal_code text, location_code text, working_hours text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.surveyor_branches (
  id uuid primary key default gen_random_uuid(),
  surveyor_id uuid not null references public.surveyors(id) on delete cascade,
  label text, address_raw text, address_line text, city text, state text,
  country text, postal_code text, location_code text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.cfs_contacts (
  id uuid primary key default gen_random_uuid(),
  cfs_id uuid not null references public.cfs(id) on delete cascade,
  branch_id uuid references public.cfs_branches(id) on delete set null,
  name text, role text, email text, phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.empty_depot_contacts (
  id uuid primary key default gen_random_uuid(),
  depot_id uuid not null references public.empty_depots(id) on delete cascade,
  branch_id uuid references public.empty_depot_branches(id) on delete set null,
  name text, role text, email text, phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.surveyor_contacts (
  id uuid primary key default gen_random_uuid(),
  surveyor_id uuid not null references public.surveyors(id) on delete cascade,
  branch_id uuid references public.surveyor_branches(id) on delete set null,
  name text, role text, email text, phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.cfs_documents (
  id uuid primary key default gen_random_uuid(),
  cfs_id uuid not null references public.cfs(id) on delete cascade,
  doc_type text not null, storage_path text, issued_on date, expires_on date,
  uploaded_by text, uploaded_at timestamptz not null default now()
);

create table if not exists public.empty_depot_documents (
  id uuid primary key default gen_random_uuid(),
  depot_id uuid not null references public.empty_depots(id) on delete cascade,
  doc_type text not null, storage_path text, issued_on date, expires_on date,
  uploaded_by text, uploaded_at timestamptz not null default now()
);

create table if not exists public.surveyor_documents (
  id uuid primary key default gen_random_uuid(),
  surveyor_id uuid not null references public.surveyors(id) on delete cascade,
  doc_type text not null, storage_path text, issued_on date, expires_on date,
  uploaded_by text, uploaded_at timestamptz not null default now()
);

create index if not exists cfs_branches_idx on public.cfs_branches (cfs_id);
create index if not exists depot_branches_idx on public.empty_depot_branches (depot_id);
create index if not exists surveyor_branches_idx on public.surveyor_branches (surveyor_id);

-- A record in use is never hard-deleted. Same rule as agents, same reason for
-- putting it in the database: the app is not the only thing that can issue a
-- DELETE.
create or replace function public.guard_depot_delete()
returns trigger language plpgsql security definer set search_path to 'public'
as $fn$
begin
  if exists (
    select 1 from public.bookings b
     where b.depot_id = old.id or b.return_depot_id = old.id
        or b.empty_yard_id = old.id::text
  ) then
    raise exception
      'Depot % is used on a booking and cannot be deleted. Mark it Inactive instead.',
      old.name using errcode = 'restrict_violation';
  end if;
  return old;
end $fn$;

create trigger empty_depots_guard_delete
before delete on public.empty_depots
for each row execute function public.guard_depot_delete();

create or replace function public.guard_surveyor_delete()
returns trigger language plpgsql security definer set search_path to 'public'
as $fn$
begin
  if exists (
    select 1 from public.bookings b
     where b.surveyor_ref_id = old.id or b.surveyor_id = old.id::text
  ) then
    raise exception
      'Surveyor % is used on a booking and cannot be deleted. Mark it Inactive instead.',
      old.name using errcode = 'restrict_violation';
  end if;
  return old;
end $fn$;

create trigger surveyors_guard_delete
before delete on public.surveyors
for each row execute function public.guard_surveyor_delete();

-- Shared masters, same pattern as parties and agents.
alter table public.cfs                   enable row level security;
alter table public.cfs_branches          enable row level security;
alter table public.cfs_contacts          enable row level security;
alter table public.cfs_documents         enable row level security;
alter table public.empty_depot_branches  enable row level security;
alter table public.empty_depot_contacts  enable row level security;
alter table public.empty_depot_documents enable row level security;
alter table public.surveyor_branches     enable row level security;
alter table public.surveyor_contacts     enable row level security;
alter table public.surveyor_documents    enable row level security;

create policy "shared master readable" on public.cfs
  for select using (is_member_of_any());
create policy "write cfs" on public.cfs
  for all using (tenant_id = auth_tenant_id() and can_write_masters())
  with check (tenant_id = auth_tenant_id() and can_write_masters());

-- The nine child tables all take the same two policies and the same audit
-- trigger, so they are applied in a loop rather than typed out nine times.
do $loop$
declare t text;
begin
  foreach t in array array[
    'cfs_branches','cfs_contacts','cfs_documents',
    'empty_depot_branches','empty_depot_contacts','empty_depot_documents',
    'surveyor_branches','surveyor_contacts','surveyor_documents'
  ] loop
    execute format(
      'create policy "read %1$s" on public.%1$I for select using (is_member_of_any())', t);
    execute format(
      'create policy "write %1$s" on public.%1$I for all using (can_write_masters()) with check (can_write_masters())', t);
    execute format(
      'create trigger %1$s_audit after insert or update or delete on public.%1$I
       for each row execute function public.audit_row_change()', t);
  end loop;
end $loop$;

create trigger cfs_audit
after insert or update or delete on public.cfs
for each row execute function public.audit_row_change();
