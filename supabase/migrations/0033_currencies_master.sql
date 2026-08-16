-- Miscellaneous → Currencies. Becomes the only place currency codes can be
-- added or removed; invoicing, charge lines and rate entry read from here
-- rather than the hardcoded USD/INR pair. Admin-only writes via
-- can_write_masters(), same as the rest of Master Data.
--
-- `decimals` matters for invoicing: most currencies are 2dp, but the Gulf
-- dinars/rial are 3dp and JPY/VND are 0dp -- rounding to 2 everywhere
-- produces wrong totals on those.

create table public.currencies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  code text not null,
  name text not null,
  symbol text,
  country text,
  decimals int not null default 2,
  created_at timestamptz not null default now()
);

create unique index currencies_code_key on public.currencies (tenant_id, upper(code));

alter table public.currencies enable row level security;

create policy "read currencies" on public.currencies for select
using (tenant_id = public.auth_tenant_id());

create policy "write currencies" on public.currencies for all
using (tenant_id = public.auth_tenant_id() and public.can_write_masters())
with check (tenant_id = public.auth_tenant_id() and public.can_write_masters());

create trigger currencies_audit after insert or update or delete on public.currencies
for each row execute function public.audit_row_change();

insert into public.currencies (code, name, symbol, country, decimals) values
  -- Primary trading currencies
  ('USD', 'US Dollar', '$', 'United States', 2),
  ('INR', 'Indian Rupee', '₹', 'India', 2),
  -- Gulf / Middle East trade lanes (Jebel Ali, Sohar, Bandar Abbas)
  ('AED', 'UAE Dirham', 'AED', 'United Arab Emirates', 2),
  ('OMR', 'Omani Rial', 'OMR', 'Oman', 3),
  ('SAR', 'Saudi Riyal', 'SR', 'Saudi Arabia', 2),
  ('QAR', 'Qatari Riyal', 'QR', 'Qatar', 2),
  ('KWD', 'Kuwaiti Dinar', 'KD', 'Kuwait', 3),
  ('BHD', 'Bahraini Dinar', 'BD', 'Bahrain', 3),
  ('IRR', 'Iranian Rial', 'IRR', 'Iran', 2),
  -- East Africa (Mombasa)
  ('KES', 'Kenyan Shilling', 'KSh', 'Kenya', 2),
  ('TZS', 'Tanzanian Shilling', 'TSh', 'Tanzania', 2),
  ('ZAR', 'South African Rand', 'R', 'South Africa', 2),
  ('EGP', 'Egyptian Pound', 'E£', 'Egypt', 2),
  -- Major global freight currencies
  ('EUR', 'Euro', '€', 'Eurozone', 2),
  ('GBP', 'Pound Sterling', '£', 'United Kingdom', 2),
  ('CNY', 'Chinese Yuan', '¥', 'China', 2),
  ('JPY', 'Japanese Yen', '¥', 'Japan', 0),
  ('CHF', 'Swiss Franc', 'CHF', 'Switzerland', 2),
  ('AUD', 'Australian Dollar', 'A$', 'Australia', 2),
  ('CAD', 'Canadian Dollar', 'C$', 'Canada', 2),
  -- Asia transhipment hubs / regional
  ('SGD', 'Singapore Dollar', 'S$', 'Singapore', 2),
  ('HKD', 'Hong Kong Dollar', 'HK$', 'Hong Kong', 2),
  ('MYR', 'Malaysian Ringgit', 'RM', 'Malaysia', 2),
  ('THB', 'Thai Baht', '฿', 'Thailand', 2),
  ('IDR', 'Indonesian Rupiah', 'Rp', 'Indonesia', 2),
  ('VND', 'Vietnamese Dong', '₫', 'Vietnam', 0),
  ('KRW', 'South Korean Won', '₩', 'South Korea', 0),
  -- South Asia neighbours
  ('LKR', 'Sri Lankan Rupee', 'Rs', 'Sri Lanka', 2),
  ('BDT', 'Bangladeshi Taka', '৳', 'Bangladesh', 2),
  ('PKR', 'Pakistani Rupee', 'Rs', 'Pakistan', 2);
