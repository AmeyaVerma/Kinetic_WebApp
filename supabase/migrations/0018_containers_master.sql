-- Containers master (Pass 1 -- "Container" subfield only). Physical fleet
-- of containers Kinetic owns/operates, imported from the legacy app's
-- container register. Two more subfields planned but not yet built:
-- CMC and Container Items/Damage Codes -- scaffolded as placeholder tabs
-- in the UI until that data lands, following the same one-piece-at-a-time
-- approach used for Parties.

create table public.containers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  container_no text not null,
  status text,
  last_activity_date date,
  port text,
  depot text,
  principal text,
  owner text,
  size text,
  container_type text,
  iso_type text,
  max_gross_wt numeric,
  tare_weight numeric,
  capacity numeric,
  hire_status text,
  remarks text,
  free_days int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, container_no)
);

create index containers_status_idx on public.containers (status);
create index containers_no_idx on public.containers (lower(container_no));

alter table public.containers enable row level security;

create policy "read containers" on public.containers for select
  using (tenant_id = public.auth_tenant_id());

create policy "write containers" on public.containers for all
  using (tenant_id = public.auth_tenant_id() and public.can_write_masters())
  with check (tenant_id = public.auth_tenant_id() and public.can_write_masters());

drop trigger if exists containers_audit on public.containers;
create trigger containers_audit after insert or update or delete on public.containers
  for each row execute function public.audit_row_change();
