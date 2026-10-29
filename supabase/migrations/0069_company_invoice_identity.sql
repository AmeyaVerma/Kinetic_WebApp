-- company_settings carried what a Bill of Lading needs -- legal name,
-- addresses, logo, stamps -- but nothing an invoice prints: no GSTIN, PAN,
-- CIN, LUT number or bank details. Their real invoices carry all of those in
-- the Terms block, so an invoice could not be generated without them.
--
-- Every value below is taken from the company's own documents in
-- Kinetic_Docs, not invented:
--   Kinetic -- GST certificate, e-PAN, the Mundra Oil invoice (CIN, LUT, bank)
--   RKS     -- Certificate of Incorporation, GST certificate, KYC form and
--              the NITCO invoice (bank)

alter table public.company_settings
  add column if not exists gstin        text,
  add column if not exists pan          text,
  add column if not exists cin          text,
  add column if not exists tan          text,
  add column if not exists lut_number   text,
  add column if not exists state        text,
  add column if not exists state_code   text,
  add column if not exists bank_name    text,
  add column if not exists bank_account text,
  add column if not exists bank_ifsc    text,
  add column if not exists invoice_series text;

update public.company_settings cs
set gstin = '27AAJCK5409R1ZT',
    pan   = 'AAJCK5409R',
    cin   = 'U63030MH2022PTC383096',
    tan   = 'PNEK20660D',
    lut_number = 'AD271025013720M',
    state = 'Maharashtra',
    state_code = '27',
    bank_name = 'ICICI BANK LTD, VIKHROLI WEST PARK',
    bank_account = '015105019692',
    bank_ifsc = 'ICIC0005401',
    invoice_series = coalesce(invoice_series, 'KLF')
from public.tenants t
where t.id = cs.tenant_id and t.name = 'Kinetic Line';

insert into public.company_settings (
  tenant_id, legal_name, corporate_address, gst_address, tel, email, website,
  gstin, pan, cin, tan, state, state_code,
  bank_name, bank_account, bank_ifsc, invoice_series, tagline
)
select t.id,
  'RKS GLOBAL LOGISTICS PRIVATE LIMITED',
  '2nd Floor, Shop No.221, Ecstasy City of Joy Business Park, Ashok Nagar, Mulund West, Mumbai, Mumbai Suburban, Maharashtra, 400080, India',
  '2nd Floor, Shop No.221, Ecstasy City of Joy Business Park, Ashok Nagar, Mulund West, Mumbai, Mumbai Suburban, Maharashtra, 400080, India',
  '+91 86559 44514',
  'ceo@rks-global.com',
  'www.rks-global.com',
  '27AAOCR7670N1ZE', 'AAOCR7670N', 'U52292MH2025PTC451016', 'PNER38753B',
  'Maharashtra', '27',
  'ICICI BANK', '480705000286', 'ICIC0004807', 'RKSI',
  'Your Cargo. Our Commitment.'
from public.tenants t
where t.name = 'RKS Global Logistics'
  and not exists (select 1 from public.company_settings c where c.tenant_id = t.id);
