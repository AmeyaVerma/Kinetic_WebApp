-- Gate-in inspection photos. MNR jobs aren't a real Supabase table yet
-- (mnrJobs is still mock-only, like fleet) -- job_id is the local mock
-- job id as plain text, not a foreign key. Path convention for the
-- storage bucket: {tenant_id}/{job_id}/{timestamp}_{filename}, so RLS can
-- check the first path segment against the caller's own tenant without
-- needing a join back to a jobs table.

create or replace function public.can_read_mnr()
 returns boolean
 language sql stable security definer
 set search_path to 'public'
as $$
  select public.auth_role() in ('admin', 'ops', 'finance', 'mnr')
$$;

create or replace function public.can_write_mnr()
 returns boolean
 language sql stable security definer
 set search_path to 'public'
as $$
  select public.auth_role() in ('admin', 'mnr')
$$;

create table public.mnr_gate_in_photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  job_id text not null,
  container_no text not null,
  storage_path text not null,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

create index mnr_gate_in_photos_job_idx on public.mnr_gate_in_photos (job_id);

alter table public.mnr_gate_in_photos enable row level security;

create policy "read mnr_gate_in_photos" on public.mnr_gate_in_photos for select
using (tenant_id = public.auth_tenant_id() and public.can_read_mnr());

create policy "write mnr_gate_in_photos" on public.mnr_gate_in_photos for all
using (tenant_id = public.auth_tenant_id() and public.can_write_mnr())
with check (tenant_id = public.auth_tenant_id() and public.can_write_mnr());

create trigger mnr_gate_in_photos_audit after insert or update or delete on public.mnr_gate_in_photos
for each row execute function public.audit_row_change();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mnr-photos',
  'mnr-photos',
  false,
  10485760, -- 10 MB per photo
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = excluded.public;

drop policy if exists "mnr-photos read" on storage.objects;
create policy "mnr-photos read"
  on storage.objects for select
  using (
    bucket_id = 'mnr-photos'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
    and public.can_read_mnr()
  );

drop policy if exists "mnr-photos insert" on storage.objects;
create policy "mnr-photos insert"
  on storage.objects for insert
  with check (
    bucket_id = 'mnr-photos'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
    and public.can_write_mnr()
  );

drop policy if exists "mnr-photos delete" on storage.objects;
create policy "mnr-photos delete"
  on storage.objects for delete
  using (
    bucket_id = 'mnr-photos'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
    and public.can_write_mnr()
  );
