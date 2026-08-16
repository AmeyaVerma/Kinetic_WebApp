-- Container Master → Empty Depots (Pass 1). Empty container return/pickup
-- yards -- becomes the only place this data can be added or edited; booking
-- flows read from here, never free-text entry. Same flat shape as ICDs/Air
-- Ports.

create table public.empty_depots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  name text not null,
  code text,
  city text,
  country text,
  created_at timestamptz not null default now()
);

create index empty_depots_name_idx on public.empty_depots (lower(name));

alter table public.empty_depots enable row level security;

create policy "read empty_depots" on public.empty_depots for select
using (tenant_id = public.auth_tenant_id());

create policy "write empty_depots" on public.empty_depots for all
using (tenant_id = public.auth_tenant_id() and public.can_write_masters())
with check (tenant_id = public.auth_tenant_id() and public.can_write_masters());

create trigger empty_depots_audit after insert or update or delete on public.empty_depots
for each row execute function public.audit_row_change();
