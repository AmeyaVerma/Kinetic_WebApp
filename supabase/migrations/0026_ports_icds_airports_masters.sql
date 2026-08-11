-- Ports/ICDs/Terminals + Miscellaneous masters (Pass 1: Sea Ports +
-- Terminals, ICDs, Air Ports). These become the only place terminal/ICD/
-- air port data can be added or edited -- booking flows read from here,
-- never free-text entry. Sea port -> terminal is a parent/child pair,
-- same shape as vessels -> vessel_voyages.

create table public.sea_ports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  name text not null,
  code text,
  country text,
  created_at timestamptz not null default now()
);

create index sea_ports_name_idx on public.sea_ports (lower(name));

create table public.sea_port_terminals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  port_id uuid not null references public.sea_ports(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index sea_port_terminals_port_idx on public.sea_port_terminals (port_id);

create table public.icds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  name text not null,
  code text,
  city text,
  country text,
  created_at timestamptz not null default now()
);

create index icds_name_idx on public.icds (lower(name));

create table public.air_ports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  name text not null,
  code text,
  city text,
  country text,
  created_at timestamptz not null default now()
);

create index air_ports_name_idx on public.air_ports (lower(name));

do $$
declare
  t text;
begin
  foreach t in array array['sea_ports', 'sea_port_terminals', 'icds', 'air_ports']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format($f$
      create policy "read %1$s" on public.%1$I for select
      using (tenant_id = public.auth_tenant_id())
    $f$, t);

    execute format($f$
      create policy "write %1$s" on public.%1$I for all
      using (tenant_id = public.auth_tenant_id() and public.can_write_masters())
      with check (tenant_id = public.auth_tenant_id() and public.can_write_masters())
    $f$, t);

    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
       for each row execute function public.audit_row_change()',
      t || '_audit', t
    );
  end loop;
end $$;
