-- The version store every generated document writes to, the per-financial-year
-- counter that issues BL numbers, and the signing PIN table.
--
-- Versioning principle: a document version is a FROZEN SNAPSHOT of every
-- printed value, not a pointer to live booking data. Reprinting version 2 of a
-- CRO a year later must produce exactly what was sent then, even if the
-- booking, the depot master or the company address has changed since.

-- --------------------------------------------------------------------------
-- document_versions
-- --------------------------------------------------------------------------
create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  booking_id uuid not null references public.bookings(id) on delete cascade,

  doc_type text not null check (doc_type in (
    'bl', 'backside', 'container_sheet',
    'cro', 'onboard', 'can', 'do', 'offloading'
  )),

  -- CRO only: one CRO per equipment group, so a booking with 2x20 and 1x40
  -- produces two CRO chains, each with its own version numbering.
  -- Stored as the printed form, e.g. '2X20'. Empty string for every other
  -- doc_type so the unique index below behaves (nulls would not collide).
  equipment_group text not null default '',

  version int not null,

  -- Every printed value, resolved. The renderer reads ONLY from here.
  snapshot jsonb not null,
  -- { "scan": bool, "signed": bool, "surrender_stamp": bool }
  options jsonb not null default '{}'::jsonb,

  storage_path text,
  file_name text,

  generated_by uuid references auth.users(id),
  generated_at timestamptz not null default now()
);

create unique index document_versions_chain_key
  on public.document_versions (booking_id, doc_type, equipment_group, version);

create index document_versions_booking_idx
  on public.document_versions (booking_id, doc_type);

alter table public.document_versions enable row level security;

create policy "read document versions" on public.document_versions for select
using (tenant_id = public.auth_tenant_id() and public.can_read_nvocc());

create policy "write document versions" on public.document_versions for insert
with check (tenant_id = public.auth_tenant_id() and public.can_write_nvocc());

-- No update, no delete: issued documents are an audit trail. Superseding one
-- means inserting the next version.

create trigger document_versions_audit after insert or update or delete on public.document_versions
for each row execute function public.audit_row_change();

-- --------------------------------------------------------------------------
-- document_sequences: per tenant, per financial year.
--
-- The BL number is KLNVO + FY code + 6-digit sequence (KLNVO2627000531) and
-- the sequence restarts on 1 April. A plain max()+1 would hand the same
-- number to two concurrent bookings, so allocation goes through the function
-- below, which takes a row lock for the duration of the transaction.
-- --------------------------------------------------------------------------
create table public.document_sequences (
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  -- 'nvocc_bl', kept generic so FF or another series can share the mechanism.
  series text not null,
  -- Financial-year code: FY 2026-27 is '2627'.
  fy_code text not null,
  last_value int not null default 0,
  primary key (tenant_id, series, fy_code)
);

alter table public.document_sequences enable row level security;

create policy "read document sequences" on public.document_sequences for select
using (tenant_id = public.auth_tenant_id());

-- Allocation happens through next_document_number() only, never by direct write.

-- Financial year runs 1 April to 31 March. 15 Aug 2026 -> '2627'.
create or replace function public.fy_code(at timestamptz default now())
returns text
language sql
immutable
as $$
  select case
    when extract(month from at) >= 4
      then to_char(at, 'YY') || to_char(at + interval '1 year', 'YY')
    else to_char(at - interval '1 year', 'YY') || to_char(at, 'YY')
  end;
$$;

-- Returns the next sequence value for the series, creating the year's row on
-- first use. The INSERT .. ON CONFLICT DO UPDATE is atomic: concurrent callers
-- serialise on the primary key and each gets a distinct number.
create or replace function public.next_document_number(p_series text, p_fy_code text default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fy text := coalesce(p_fy_code, public.fy_code());
  v_next int;
begin
  if public.auth_tenant_id() is null then
    raise exception 'no tenant in session';
  end if;

  insert into public.document_sequences (tenant_id, series, fy_code, last_value)
  values (public.auth_tenant_id(), p_series, v_fy, 1)
  on conflict (tenant_id, series, fy_code)
    do update set last_value = public.document_sequences.last_value + 1
  returning last_value into v_next;

  return v_next;
end;
$$;

revoke execute on function public.next_document_number(text, text) from anon;

-- --------------------------------------------------------------------------
-- signing_pins
--
-- Siddharth asked for "a password" on Signed and Surrender stamp. A single
-- shared password cannot answer "who signed this BL", and anyone who learns it
-- can sign. So: one PIN per admin, hashed, verified server-side only.
--
-- SECURITY: this table has NO client-readable policy. The hash, the attempt
-- counter and the lockout are reachable only by the service role inside the
-- server-side verify function. A client cannot read a hash to attack offline,
-- and cannot reset its own failed_attempts to dodge the lockout.
-- --------------------------------------------------------------------------
create table public.signing_pins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.signing_pins enable row level security;

-- Deliberately no select / insert / update / delete policy: RLS denies by
-- default, so every path goes through the server-side function.

-- NOTE: deliberately NO audit_row_change() trigger here. That trigger copies
-- the whole row into audit_log.old_data / new_data, which would write
-- `pin_hash` into a table admins can read -- handing out the hashes and
-- undoing the point of hashing them. PIN events (set, verified, failed,
-- locked out) are instead written to audit_log explicitly by the server-side
-- function, recording who/when/which BL and never the hash itself.
