-- Parties master (Workflow: Master data, Pass 1 — Parties).
-- One table for every company/individual/BL-control-phrase Kinetic deals
-- with, tagged by role rather than split into separate Customer/Agent/
-- Shipper tables — the same company is often more than one of those at
-- once. `roles` is a plain text[] (not an enum) so a new role is a data
-- change, not a migration — see kinetic-erp-scalability-principles.
--
-- address_raw is preserved verbatim alongside the parsed columns: the
-- seed import (see scratchpad parse) extracts GSTIN/PAN/IEC/email/phone
-- via regex, which is best-effort — never destroy the source text a
-- fix might need to re-parse later.

create or replace function public.can_write_masters()
returns boolean
language sql security definer stable set search_path = public
as $$
  select public.auth_role() in ('admin', 'ops', 'sales')
$$;

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  code text not null,
  legal_name text not null,
  display_name text not null,
  party_type text not null default 'Company' check (party_type in ('Company', 'Individual', 'Control')),
  roles text[] not null default '{}',
  address_line text,
  city text,
  state text,
  postal_code text,
  country text,
  address_raw text,
  pan text,
  gstin text,
  iec text,
  tax_id text,
  email text,
  phone text,
  sales_person text,
  accounting_code text,
  party_code_legacy text,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  is_self boolean not null default false,
  extras jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create index parties_roles_idx on public.parties using gin (roles);
create index parties_name_idx on public.parties (lower(legal_name));

alter table public.parties enable row level security;

-- Read: anyone signed in to the tenant — every module (NVOCC, FF, MNR,
-- Customers, Agents) autofills from this, so it can't be gated like the
-- narrower per-module tables.
create policy "read parties" on public.parties for select
  using (tenant_id = public.auth_tenant_id());

create policy "write parties" on public.parties for all
  using (tenant_id = public.auth_tenant_id() and public.can_write_masters())
  with check (tenant_id = public.auth_tenant_id() and public.can_write_masters());

drop trigger if exists parties_audit on public.parties;
create trigger parties_audit after insert or update or delete on public.parties
  for each row execute function public.audit_row_change();
