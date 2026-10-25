-- Company settings: the static text and assets that print on every document
-- (BL, CRO, Onboard, CAN, DO, Off Loading Letter). One row per tenant.
--
-- These are deliberately NOT hard-coded in the PDF layouts: the MTO licence
-- number is dated (MTO/DGS/3605/JUL/2027) and will change without any layout
-- change, and the principal name differs between the letterhead ("PVT. LTD.")
-- and the CRO/Off Loading samples ("PRIVATE LIMITED") -- one settings value
-- resolves that rather than two spellings drifting across templates.
--
-- Asset paths point into the private `documents` bucket (0035). Nothing here
-- stores an image; only its path. Greyscale variants exist because Scan Copy
-- mode renders the whole PDF black and white, stamps included.

create table public.company_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique default public.default_tenant_id() references public.tenants(id),

  legal_name text not null default 'KINETIC INTERNATIONAL LOGISTICS PVT. LTD.',
  -- Printed on CRO and Off Loading Letter as "Principal". Defaults to the
  -- letterhead form; open item in the brief (section 2) pending confirmation.
  principal_name text not null default 'KINETIC INTERNATIONAL LOGISTICS PVT. LTD.',
  tagline text not null default 'Your Cargo, Our Responsibility',

  corporate_address text not null default 'Crescent Business Square, Office 1009, 10th Floor, Opp Gundecha Onclave, Kherani Road, Saki Naka, Andheri East, Mumbai 400072, Maharashtra, India',
  -- Printed on operational documents together with "MUMBAI 400072".
  gst_address text not null default 'A/304, Pratik Harmony, Plot No 35, Sector 20, Kalamboli, Navi Mumbai, Raigad, Maharashtra, 410218',

  tel text not null default '+91 86559 44515',
  email text not null default 'doc@kintlog.com',
  website text not null default 'www.kintlog.com',
  -- Dated licence -- changes without touching layout code.
  mto_registration text not null default 'MTO/DGS/3605/JUL/2027',
  place_of_issue text not null default 'Mumbai',

  -- Paths into the private bucket. Null until the asset is uploaded.
  logo_path text,
  stamp_path text,
  stamp_grey_path text,
  signature_path text,
  signature_grey_path text,
  surrender_stamp_path text,
  surrender_stamp_grey_path text,
  -- BL backside terms artwork. Until this is set, Print BL and Backside are
  -- blocked for non-Draft BL types (open item O5).
  bl_backside_path text,

  -- Stamp/signature placement in PDF points from the page corner.
  -- A4 = 595.28 x 841.89 pt. Server-side compositor reads these so the image
  -- lands in the identical spot on every front sheet.
  asset_placement jsonb not null default '{
    "signature": { "x": 330, "y": 120, "width": 120, "height": 45 },
    "stamp":     { "x": 460, "y": 110, "width": 110, "height": 110 },
    "surrender": { "x": 200, "y": 420, "width": 180, "height": 90 }
  }'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_settings enable row level security;

create policy "read company settings" on public.company_settings for select
using (tenant_id = public.auth_tenant_id());

-- Admin-only: these values print on legal transport documents.
create policy "write company settings" on public.company_settings for all
using (tenant_id = public.auth_tenant_id() and public.is_admin())
with check (tenant_id = public.auth_tenant_id() and public.is_admin());

create trigger company_settings_audit after insert or update or delete on public.company_settings
for each row execute function public.audit_row_change();

-- Seed the single row for the existing tenant, using the defaults above.
insert into public.company_settings (tenant_id) select id from public.tenants
on conflict (tenant_id) do nothing;
