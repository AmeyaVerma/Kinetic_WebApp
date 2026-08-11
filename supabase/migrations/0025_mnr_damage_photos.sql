-- Damage survey photos (flow 2 — min 2 per damage point: wide + close-up).
-- Same pattern as mnr_gate_in_photos: job_id/damage_point_id are the
-- local mock ids (plain text, no FK) since MNR jobs aren't a real table
-- yet. Shares the mnr-photos bucket -- its RLS only checks the tenant_id
-- path segment, so no bucket policy changes are needed.

create table public.mnr_damage_photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  job_id text not null,
  damage_point_id text not null,
  storage_path text not null,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

create index mnr_damage_photos_point_idx on public.mnr_damage_photos (damage_point_id);

alter table public.mnr_damage_photos enable row level security;

create policy "read mnr_damage_photos" on public.mnr_damage_photos for select
using (tenant_id = public.auth_tenant_id() and public.can_read_mnr());

create policy "write mnr_damage_photos" on public.mnr_damage_photos for all
using (tenant_id = public.auth_tenant_id() and public.can_write_mnr())
with check (tenant_id = public.auth_tenant_id() and public.can_write_mnr());

create trigger mnr_damage_photos_audit after insert or update or delete on public.mnr_damage_photos
for each row execute function public.audit_row_change();
