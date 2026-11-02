-- The universal HS code master (spec v2).
--
-- Siddharth supplied 5,612 six-digit WCO HS 2022 codes. The sheet repeats the
-- heading and chapter description on every row -- 1,228 headings and 96
-- chapters spread across 5,612 rows -- so they are stored once each and
-- referenced, rather than copied 5,612 times.
--
-- code_digits, nomenclature and status are uniform across every supplied row
-- ('6', 'HS 2022', 'Active'), so they are column defaults rather than data.
--
-- Shared by both companies, like ports and currencies.
--
-- The two sheets that arrived EMPTY matter as much as the full one, because
-- they say what the structure is for:
--
--   Country Extensions -- the 8-digit Indian ITC-HS code that sits beneath a
--     6-digit international code. India is Kinetic's default and uses 8.
--   Product Pairs -- a product mapped to its Indian code AND its overseas
--     counterpart, because the same cargo carries different codes at each end
--     of a shipment. That is the real operational problem, and the tables are
--     built to hold it even though both sheets came empty.
--
-- The 5,612 rows themselves are NOT in this migration. They are kept at
-- public/reference/hs-2022.json, converted once from the spreadsheet, and
-- loaded by the admin-only button on Master Data -> HS codes. That keeps the
-- master rebuildable from source, and the load is idempotent because every
-- row is upserted on its code.

create table if not exists public.hs_chapters (
  code        text primary key,
  description text not null,
  section     text
);

create table if not exists public.hs_headings (
  code         text primary key,
  description  text not null,
  chapter_code text not null references public.hs_chapters(code) on delete cascade
);

create table if not exists public.hs_codes (
  code          text primary key,
  code_dotted   text,
  description   text not null,
  heading_code  text not null references public.hs_headings(code) on delete cascade,
  code_digits   int  not null default 6,
  nomenclature  text not null default 'HS 2022',
  status        text not null default 'Active' check (status in ('Active', 'Withdrawn')),
  created_at    timestamptz not null default now()
);

create index if not exists hs_headings_chapter_idx on public.hs_headings (chapter_code);
create index if not exists hs_codes_heading_idx on public.hs_codes (heading_code);
-- Customers search this master by words in the description, so the search
-- has to be an index rather than a scan of 5,612 rows.
create index if not exists hs_codes_desc_idx on public.hs_codes using gin (to_tsvector('english', description));

-- The national systems, with how many digits each uses. 'verify_before_use'
-- is carried from the source as a warning, not as decoration: these lengths
-- change and the sheet says to confirm each with the authority named.
create table if not exists public.hs_countries (
  country_code    text primary key,
  country_name    text not null,
  national_system text,
  national_digits int,
  official_source text,
  note            text,
  verify_before_use boolean not null default true
);

-- A national code beneath a 6-digit international one.
create table if not exists public.hs_country_extensions (
  id            uuid primary key default gen_random_uuid(),
  country_code  text not null references public.hs_countries(country_code) on delete cascade,
  hs_code_6     text not null references public.hs_codes(code) on delete cascade,
  national_code text not null,
  description   text,
  code_digits   int,
  valid_from    date,
  valid_to      date,
  status        text not null default 'Active' check (status in ('Active', 'Withdrawn')),
  source        text,
  created_at    timestamptz not null default now(),
  unique (country_code, national_code)
);

-- The same cargo as it is classified at each end.
create table if not exists public.hs_product_pairs (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null default default_tenant_id() references public.tenants(id) on delete cascade,
  product_name          text not null,
  hs_code_6             text references public.hs_codes(code) on delete set null,
  india_code            text,
  overseas_country_code text references public.hs_countries(country_code) on delete set null,
  overseas_code         text,
  notes                 text,
  created_at            timestamptz not null default now(),
  created_by            text
);

create index if not exists hs_extensions_code_idx on public.hs_country_extensions (hs_code_6);

alter table public.hs_chapters           enable row level security;
alter table public.hs_headings           enable row level security;
alter table public.hs_codes              enable row level security;
alter table public.hs_countries          enable row level security;
alter table public.hs_country_extensions enable row level security;
alter table public.hs_product_pairs      enable row level security;

do $loop$
declare t text;
begin
  foreach t in array array[
    'hs_chapters','hs_headings','hs_codes','hs_countries','hs_country_extensions'
  ] loop
    execute format(
      'create policy "read %1$s" on public.%1$I for select using (is_member_of_any())', t);
    execute format(
      'create policy "write %1$s" on public.%1$I for all using (can_write_masters()) with check (can_write_masters())', t);
  end loop;
end $loop$;

-- Product pairs are the one table here that is per company: which product a
-- company ships under which code is commercial, not reference data.
create policy "read hs_product_pairs" on public.hs_product_pairs
  for select using (tenant_id = auth_tenant_id());
create policy "write hs_product_pairs" on public.hs_product_pairs
  for all using (tenant_id = auth_tenant_id() and can_write_masters())
  with check (tenant_id = auth_tenant_id() and can_write_masters());

create trigger hs_country_extensions_audit
after insert or update or delete on public.hs_country_extensions
for each row execute function public.audit_row_change();

create trigger hs_product_pairs_audit
after insert or update or delete on public.hs_product_pairs
for each row execute function public.audit_row_change();

insert into public.hs_countries
  (country_code, country_name, national_system, national_digits, official_source, note)
values
  ('IN','India','ITC-HS (Indian Trade Clarification)',8,'CBIC / DGFT','Kinetic default. Add the 8-digit Indian code under each 6-digit code.'),
  ('AE','United Arab Emirates','GCC Common Customs Tariff',8,'Dubai Customs / Federal Customs Authority',null),
  ('SA','Saudi Arabia','GCC tariff with national extension',12,'ZATCA','Saudi adds extra digits beyond the GCC 8; confirm length with ZATCA.'),
  ('OM','Oman','GCC Common Customs Tariff',8,'Oman Customs',null),
  ('QA','Qatar','GCC Common Customs Tariff',8,'Qatar Customs',null),
  ('KW','Kuwait','GCC Common Customs Tariff',8,'Kuwait Customs',null),
  ('BH','Bahrain','GCC Common Customs Tariff',8,'Bahrain Customs',null),
  ('IR','Iran','Iran Customs Tariff',8,'IRICA','Confirm current schedule and length with the local agent.'),
  ('US','United States','HTS (Harmonized Tariff Schedule)',10,'USITC','First 6 digits are HS, next 4 are US.'),
  (
