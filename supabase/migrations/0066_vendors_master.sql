-- Vendors, built the way Siddharth asked for them: not a master someone fills
-- in up front, but one that grows as bookings are made. A vendor is added
-- from the booking itself, is stored here, and is suggested next time.
--
-- The one hard requirement he gave: "just make sure no duplicate vendors are
-- added inside vendor master." So uniqueness is enforced by the database on a
-- normalised name, not by the form remembering to check.
--
-- Uniqueness is deliberately GLOBAL rather than per company. Vendors are
-- shared master data, so a row created by Kinetic is visible from RKS -- if
-- uniqueness were per company, both could create "CMA CGM" and the picker
-- would show it twice, which is the exact thing this prevents.

create table if not exists public.vendors (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null default default_tenant_id() references public.tenants(id) on delete cascade,
  name        text not null check (length(trim(name)) > 1),
  roles       text[] not null default '{}',
  contact_name text,
  email        text,
  phone        text,
  address      text,
  gstin        text,
  pan          text,
  notes        text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   text
);

create unique index if not exists vendors_unique_name
  on public.vendors (lower(regexp_replace(trim(name), '\s+', ' ', 'g')));

create index if not exists vendors_roles_idx on public.vendors using gin (roles);

alter table public.vendors enable row level security;

create policy "shared master readable" on public.vendors
  for select using (public.is_member_of_any());

create policy "write vendors" on public.vendors
  for all using (can_write_masters()) with check (can_write_masters());

create trigger vendors_audit
after insert or update or delete on public.vendors
for each row execute function public.audit_row_change();

insert into public.vendors (name, roles)
select v.name, v.roles
from (values
  ('CMA CGM Agencies India',        array['Carrier']),
  ('Bureau Veritas Marine',         array['Surveyor']),
  ('JNPT Container Freight Station',array['Warehousing','CFS']),
  ('Coastal Container Repairs',     array['Repair']),
  ('Mumbai Port Truckers',          array['Trucking']),
  ('ClearFast Customs Brokers',     array['Customs','CHA'])
) as v(name, roles)
where not exists (
  select 1 from public.vendors e
  where lower(regexp_replace(trim(e.name), '\s+', ' ', 'g'))
      = lower(regexp_replace(trim(v.name), '\s+', ' ', 'g'))
);
