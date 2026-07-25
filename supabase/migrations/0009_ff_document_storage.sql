-- Real document storage for Freight Forwarding — the FF half of the
-- original "NVOCC+FF documents" goal (NVOCC's half landed in 0007).
-- FF can't reuse booking_documents (its booking_id FK points strictly at
-- `bookings`, not `ff_shipments`), so this is its own table + bucket,
-- same pattern throughout: tenant-isolated RLS, can_read/write_ff(),
-- audit trail, private Storage with path {ff dbId}/{docType}/{file}.

create table if not exists public.ff_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  ff_shipment_id uuid not null references public.ff_shipments(id) on delete cascade,
  doc_type text not null,
  status text not null default 'pending',
  storage_path text,
  uploaded_by text,
  uploaded_at timestamptz
);

alter table public.ff_documents enable row level security;

drop policy if exists "read ff_documents" on public.ff_documents;
create policy "read ff_documents" on public.ff_documents for select
  using (tenant_id = public.auth_tenant_id() and public.can_read_ff());

drop policy if exists "write ff_documents" on public.ff_documents;
create policy "write ff_documents" on public.ff_documents for all
  using (tenant_id = public.auth_tenant_id() and public.can_write_ff())
  with check (tenant_id = public.auth_tenant_id() and public.can_write_ff());

drop trigger if exists ff_documents_audit on public.ff_documents;
create trigger ff_documents_audit
  after insert or update or delete on public.ff_documents
  for each row execute function public.audit_row_change();

-- ── Storage bucket ────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ff-documents',
  'ff-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = excluded.public;

-- storage.objects RLS is already enabled by default (see 0007's note —
-- we can't toggle it ourselves, only create policies).

drop policy if exists "ff-documents read" on storage.objects;
create policy "ff-documents read"
  on storage.objects for select
  using (
    bucket_id = 'ff-documents'
    and exists (
      select 1 from public.ff_shipments f
      where f.id::text = (storage.foldername(name))[1]
        and f.tenant_id = public.auth_tenant_id()
    )
    and public.can_read_ff()
  );

drop policy if exists "ff-documents insert" on storage.objects;
create policy "ff-documents insert"
  on storage.objects for insert
  with check (
    bucket_id = 'ff-documents'
    and exists (
      select 1 from public.ff_shipments f
      where f.id::text = (storage.foldername(name))[1]
        and f.tenant_id = public.auth_tenant_id()
    )
    and public.can_write_ff()
  );

drop policy if exists "ff-documents update" on storage.objects;
create policy "ff-documents update"
  on storage.objects for update
  using (
    bucket_id = 'ff-documents'
    and exists (
      select 1 from public.ff_shipments f
      where f.id::text = (storage.foldername(name))[1]
        and f.tenant_id = public.auth_tenant_id()
    )
    and public.can_write_ff()
  );

drop policy if exists "ff-documents delete" on storage.objects;
create policy "ff-documents delete"
  on storage.objects for delete
  using (
    bucket_id = 'ff-documents'
    and exists (
      select 1 from public.ff_shipments f
      where f.id::text = (storage.foldername(name))[1]
        and f.tenant_id = public.auth_tenant_id()
    )
    and public.can_write_ff()
  );
