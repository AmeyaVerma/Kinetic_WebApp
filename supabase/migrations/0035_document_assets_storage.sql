-- Two private buckets for the document engine.
--
-- `company-assets` holds the signature, company stamp and surrender stamp
-- PNGs (colour + greyscale) and the BL backside artwork. SECURITY: these are
-- deliberately WRITE-ONLY from the client. There is no select policy, so no
-- browser session -- not even an admin's -- can read these objects. Only the
-- server-side compositor, running with the service role (which bypasses RLS),
-- fetches them, and only after a signing PIN has verified. This is what makes
-- "the images are never reachable from the browser" true by construction
-- rather than by convention.
--
-- `generated-documents` holds rendered PDFs, one object per document version,
-- so a reprint is byte-identical to what was issued. Readable by anyone who
-- can read the booking it belongs to.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-assets',
  'company-assets',
  false,
  5242880, -- 5 MB: these are PNG stamps and a single artwork page
  array['image/png', 'image/jpeg', 'application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = excluded.public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-documents',
  'generated-documents',
  false,
  20971520,
  array['application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = excluded.public;

-- company-assets: admin may upload and replace. NOBODY may select.
-- Path convention: {tenant_id}/{asset_name}.png
drop policy if exists "company-assets insert" on storage.objects;
create policy "company-assets insert"
  on storage.objects for insert
  with check (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
    and public.is_admin()
  );

drop policy if exists "company-assets update" on storage.objects;
create policy "company-assets update"
  on storage.objects for update
  using (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
    and public.is_admin()
  );

drop policy if exists "company-assets delete" on storage.objects;
create policy "company-assets delete"
  on storage.objects for delete
  using (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
    and public.is_admin()
  );

-- NOTE: no select policy on company-assets. This omission is the control.

-- generated-documents: readable by anyone who can read the owning booking.
-- Path convention: {booking dbId}/{doc_type}/{version}_{filename}.pdf
drop policy if exists "generated-documents read" on storage.objects;
create policy "generated-documents read"
  on storage.objects for select
  using (
    bucket_id = 'generated-documents'
    and exists (
      select 1 from public.bookings b
      where b.id::text = (storage.foldername(name))[1]
        and b.tenant_id = public.auth_tenant_id()
    )
    and public.can_read_nvocc()
  );

-- Writes come from the server-side renderer (service role). A client-side
-- insert path is still allowed for ops so previews can be cached, gated the
-- same way booking documents are.
drop policy if exists "generated-documents insert" on storage.objects;
create policy "generated-documents insert"
  on storage.objects for insert
  with check (
    bucket_id = 'generated-documents'
    and exists (
      select 1 from public.bookings b
      where b.id::text = (storage.foldername(name))[1]
        and b.tenant_id = public.auth_tenant_id()
    )
    and public.can_write_nvocc()
  );

-- Generated documents are an audit trail: no update, no delete from the
-- client. Superseding a version means generating a new one.
