-- Parties master, Pass 2: the full "Add Party" form fields (matching the
-- legacy app's KYC + HO/Branches + Authorized Persons + Documents layout),
-- plus real document storage. A party can have MULTIPLE addresses (Head
-- Office + branches), each with its OWN GST number, contact and bank
-- details -- that's why branches are a child table, not more columns on
-- parties. Same shape for authorized persons and documents.

-- ── parties: KYC + legacy-form columns ──────────────────────────
alter table public.parties
  add column if not exists party_prefix text,
  add column if not exists legacy_username text,
  add column if not exists legacy_password text,
  add column if not exists client_coordinator text,
  add column if not exists exporter_importer_class text,
  add column if not exists exporter_importer_type text,
  add column if not exists type_of_firm text,
  add column if not exists msme_type text,
  add column if not exists msme_no text,
  add column if not exists cin text,
  add column if not exists tin text,
  add column if not exists bin text,
  add column if not exists dob_or_incorporation_date date,
  add column if not exists remarks text;

-- ── party_branches (HO/Branches table) ──────────────────────────
create table public.party_branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  party_id uuid not null references public.parties(id) on delete cascade,
  address_type text not null default 'Head Office' check (address_type in ('Head Office', 'Branch')),
  sr_no int not null default 0,
  city text,
  address text,
  state text,
  country text,
  postal_code text,
  gst_number text,
  contact_person text,
  email text,
  phone text,
  fax text,
  bank_branch text,
  account_type text,
  account_number text,
  ifsc text,
  created_at timestamptz not null default now()
);
create index party_branches_party_idx on public.party_branches (party_id);

-- ── party_authorized_persons (Company Authorized Person table) ──
create table public.party_authorized_persons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  party_id uuid not null references public.parties(id) on delete cascade,
  name text not null,
  designation text,
  contact_number text,
  email text,
  location text,
  created_at timestamptz not null default now()
);
create index party_authorized_persons_party_idx on public.party_authorized_persons (party_id);

-- ── party_documents (Document Space table) ──────────────────────
create table public.party_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  party_id uuid not null references public.parties(id) on delete cascade,
  document_name text not null,
  storage_path text not null,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);
create index party_documents_party_idx on public.party_documents (party_id);

-- ── RLS: same two-clause fence as every table (0005's pattern) ──
do $$
declare
  t text;
begin
  foreach t in array array['party_branches', 'party_authorized_persons', 'party_documents']
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

-- ── party-documents storage bucket ───────────────────────────────
-- Path convention: {party dbId}/{timestamp}_{filename} -- mirrors
-- booking-documents (0007). storage.objects RLS already on by default;
-- we only grant policy creation, never toggle RLS itself.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'party-documents',
  'party-documents',
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

drop policy if exists "party-documents read" on storage.objects;
create policy "party-documents read"
  on storage.objects for select
  using (
    bucket_id = 'party-documents'
    and exists (
      select 1 from public.parties p
      where p.id::text = (storage.foldername(name))[1]
        and p.tenant_id = public.auth_tenant_id()
    )
  );

drop policy if exists "party-documents insert" on storage.objects;
create policy "party-documents insert"
  on storage.objects for insert
  with check (
    bucket_id = 'party-documents'
    and exists (
      select 1 from public.parties p
      where p.id::text = (storage.foldername(name))[1]
        and p.tenant_id = public.auth_tenant_id()
    )
    and public.can_write_masters()
  );

drop policy if exists "party-documents delete" on storage.objects;
create policy "party-documents delete"
  on storage.objects for delete
  using (
    bucket_id = 'party-documents'
    and exists (
      select 1 from public.parties p
      where p.id::text = (storage.foldername(name))[1]
        and p.tenant_id = public.auth_tenant_id()
    )
    and public.can_write_masters()
  );
