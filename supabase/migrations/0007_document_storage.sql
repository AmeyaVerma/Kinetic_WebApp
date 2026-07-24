-- Real document storage for NVOCC (Phase 2 pilot). Private bucket + RLS
-- mirroring the same tenant-isolation + role pattern as every table so
-- far. Path convention: {booking dbId}/{docType}/{timestamp}_{filename}
-- — the RLS policies below check the first path segment against the
-- caller's own tenant via a join back to `bookings`, so no tenant_id
-- needs to be embedded client-side.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'booking-documents',
  'booking-documents',
  false,
  20971520, -- 20 MB per file — well under the 50 MB free-tier cap, sane app default
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

alter table storage.objects enable row level security;

drop policy if exists "booking-documents read" on storage.objects;
create policy "booking-documents read"
  on storage.objects for select
  using (
    bucket_id = 'booking-documents'
    and exists (
      select 1 from public.bookings b
      where b.id::text = (storage.foldername(name))[1]
        and b.tenant_id = public.auth_tenant_id()
    )
    and public.can_read_nvocc()
  );

drop policy if exists "booking-documents insert" on storage.objects;
create policy "booking-documents insert"
  on storage.objects for insert
  with check (
    bucket_id = 'booking-documents'
    and exists (
      select 1 from public.bookings b
      where b.id::text = (storage.foldername(name))[1]
        and b.tenant_id = public.auth_tenant_id()
    )
    and public.can_write_nvocc()
  );

drop policy if exists "booking-documents update" on storage.objects;
create policy "booking-documents update"
  on storage.objects for update
  using (
    bucket_id = 'booking-documents'
    and exists (
      select 1 from public.bookings b
      where b.id::text = (storage.foldername(name))[1]
        and b.tenant_id = public.auth_tenant_id()
    )
    and public.can_write_nvocc()
  );

drop policy if exists "booking-documents delete" on storage.objects;
create policy "booking-documents delete"
  on storage.objects for delete
  using (
    bucket_id = 'booking-documents'
    and exists (
      select 1 from public.bookings b
      where b.id::text = (storage.foldername(name))[1]
        and b.tenant_id = public.auth_tenant_id()
    )
    and public.can_write_nvocc()
  );
