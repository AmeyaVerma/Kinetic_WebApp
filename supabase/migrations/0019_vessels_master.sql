-- Vessels master (Pass 1). Vessel identity is separate from voyage
-- schedule -- a vessel can have many voyages, each with its own
-- ETA/ETD/IGM/terminal -- matching the legacy app's "Add New Vessel" +
-- "Voyage Details" layout. legacy_id preserves the source system's row
-- id so a future re-import/reconciliation can match records exactly.

create table public.vessels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  legacy_id text,
  name text not null,
  code text,
  vessel_type text,
  nationality text,
  build_year int,
  grt numeric,
  nrt numeric,
  dead_weight numeric,
  length_overall numeric,
  beam numeric,
  summer_draft numeric,
  winter_draft numeric,
  no_of_tanks int,
  imo_code text,
  owner text,
  master_name text,
  service_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, legacy_id)
);

create index vessels_name_idx on public.vessels (lower(name));

create table public.vessel_voyages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  vessel_id uuid not null references public.vessels(id) on delete cascade,
  voyage text,
  eta date,
  etd date,
  igm_no text,
  igm_date date,
  terminal text,
  created_at timestamptz not null default now()
);

create index vessel_voyages_vessel_idx on public.vessel_voyages (vessel_id);

do $$
declare
  t text;
begin
  foreach t in array array['vessels', 'vessel_voyages']
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
