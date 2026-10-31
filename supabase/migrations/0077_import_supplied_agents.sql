-- The seven agents supplied on 30 Oct 2026, imported exactly as given.
--
-- Nothing is dropped, merged or corrected. Every row keeps its supplied
-- review status and the reviewer's note, so an Admin clears them in the app
-- rather than the importer guessing. Six of the seven had a phone number in
-- the phone column clean enough to become a contact; the seventh (ZARNEGAR)
-- has its phone, mobile, email and registration numbers all inside the
-- address string, so the address is kept whole and the row stays flagged for
-- a person to split.
--
-- The supplied file holds SEVEN agents. Spec v2 says eight and describes a
-- Kinetic row among them to be flagged and moved. There is no such row in
-- the file, so this imports what exists and the discrepancy is a question
-- for Siddharth, not something to invent a row for.
--
-- Every agent arrives Inactive and Not screened. v2 requires documents before
-- Active, and four of these seven are Iranian or Iran-connected, so screening
-- is a deliberate decision a person records, never an import default.
--
-- Generated from agents_master_clean.csv; see scratchpad/import_agents.sql.


-- row 1: ZARNEGAR TARABAR ASIA INTL TPT CO.
with a as (
  insert into public.agents
    (code, name, country, tax_id, sales_person, review_status, review_note, source_ref)
  values ('AGT-00001', 'ZARNEGAR TARABAR ASIA INTL TPT CO.', 'Iran', null,
          null, 'Needs review', 'Country was blank; inferred. Source Sr No = 0 and city blank; confirm if record is incomplete. Phone, email or contact name is inside the address; move to contacts.',
          'agents_master_clean.csv row 1')
  returning id
), b as (
  insert into public.agent_branches
    (agent_id, label, address_raw, city, state, country, location_code, is_primary)
  select a.id, 'Head office', 'BANDAR ABBAS-IRAN POSTAL CODE:7913774138 REGISTRATION NUMBER: 17714 NATIONAL ID: 14006957927 ECONOMIC CODE:411557967315 MOBILE: +989158020414 TEL: +982143859437 EMAIL:MAHBOOBEH.YOUSEFFI1@GMAIL.COM', null, null,
         'Iran', null, true
  from a returning id, agent_id
)
insert into public.agent_contacts (agent_id, branch_id, phone, is_primary)
select b.agent_id, b.id, null, true
from b where false;

-- row 2: Star Marine Services Ltd.
with a as (
  insert into public.agents
    (code, name, country, tax_id, sales_person, review_status, review_note, source_ref)
  values ('AGT-00002', 'Star Marine Services Ltd.', 'Iran', null,
          null, 'Needs review', 'Country was blank; inferred.',
          'agents_master_clean.csv row 2')
  returning id
), b as (
  insert into public.agent_branches
    (agent_id, label, address_raw, city, state, country, location_code, is_primary)
  select a.id, 'Head office', 'Unit 12, 3rd Floor, No. 436 (Parseh Building) Shahid Beheshti Avenue, Tehran, Iran', 'Tehran', 'Tehran',
         'Iran', null, true
  from a returning id, agent_id
)
insert into public.agent_contacts (agent_id, branch_id, phone, is_primary)
select b.agent_id, b.id, '+98 912 4262887 / +98 912 1051601', true
from b where true;

-- row 3: MOJ MADD SHIPPING SERVICES CO., LTD.
with a as (
  insert into public.agents
    (code, name, country, tax_id, sales_person, review_status, review_note, source_ref)
  values ('AGT-00003', 'MOJ MADD SHIPPING SERVICES CO., LTD.', 'Iran', null,
          'CAPT KHURANA', 'Ready', null,
          'agents_master_clean.csv row 3')
  returning id
), b as (
  insert into public.agent_branches
    (agent_id, label, address_raw, city, state, country, location_code, is_primary)
  select a.id, 'Head office', 'APT., 3, 11TH FLOOR, 265 PEM TOWER, WEST DASTGERDI ST., NELSON MANDELLA BLVD., TEHRAN, IRAN', 'Tehran', 'Tehran',
         'Iran', null, true
  from a returning id, agent_id
)
insert into public.agent_contacts (agent_id, branch_id, phone, is_primary)
select b.agent_id, b.id, '+98 912 221 1084', true
from b where true;

-- row 4: Lotus Container Shipping Services LLC
with a as (
  insert into public.agents
    (code, name, country, tax_id, sales_person, review_status, review_note, source_ref)
  values ('AGT-00004', 'Lotus Container Shipping Services LLC', 'Oman', null,
          null, 'Needs review', 'Country was blank; inferred.',
          'agents_master_clean.csv row 4')
  returning id
), b as (
  insert into public.agent_branches
    (agent_id, label, address_raw, city, state, country, location_code, is_primary)
  select a.id, 'Head office', 'Jasmine Complex, 3rd Floor, Office No. (305) Postal Code: 112, P.O.Box 4216, Bldg no. 2996 Way no. 3933, Al Khuwair- Sultanate Of Oman', 'Oman', null,
         'Oman', null, true
  from a returning id, agent_id
)
insert into public.agent_contacts (agent_id, branch_id, phone, is_primary)
select b.agent_id, b.id, '+968 935 544 56', true
from b where true;

-- row 5: ASTROGULF FREIGHT SERVICES LLC
with a as (
  insert into public.agents
    (code, name, country, tax_id, sales_person, review_status, review_note, source_ref)
  values ('AGT-00005', 'ASTROGULF FREIGHT SERVICES LLC', 'United Arab Emirates', null,
          null, 'Ready', null,
          'agents_master_clean.csv row 5')
  returning id
), b as (
  insert into public.agent_branches
    (agent_id, label, address_raw, city, state, country, location_code, is_primary)
  select a.id, 'Head office', '312 BLOCK C AI HUDAIBA AWARDS BUILDING, AL MINA ROAD, DUBAI, U.A.E.', 'Al Mina Road', 'Dubai',
         'United Arab Emirates', null, true
  from a returning id, agent_id
)
insert into public.agent_contacts (agent_id, branch_id, phone, is_primary)
select b.agent_id, b.id, '+971589747509', true
from b where true;

-- row 6: ALPHABETA GLOBAL SHIPPING LLC
with a as (
  insert into public.agents
    (code, name, country, tax_id, sales_person, review_status, review_note, source_ref)
  values ('AGT-00006', 'ALPHABETA GLOBAL SHIPPING LLC', 'United Arab Emirates', null,
          'CAPT KHURANA', 'Ready', null,
          'agents_master_clean.csv row 6')
  returning id
), b as (
  insert into public.agent_branches
    (agent_id, label, address_raw, city, state, country, location_code, is_primary)
  select a.id, 'Head office', '208, Al Reyami Building, Zabeel Road, PO Box: 120423', 'Dubai', 'Dubai',
         'United Arab Emirates', null, true
  from a returning id, agent_id
)
insert into public.agent_contacts (agent_id, branch_id, phone, is_primary)
select b.agent_id, b.id, '+971 56 466 2218', true
from b where true;

-- row 7: AL MARSA INTERNATIONAL SHIPPING SERVICES (L.L.C.)
with a as (
  insert into public.agents
    (code, name, country, tax_id, sales_person, review_status, review_note, source_ref)
  values ('AGT-00007', 'AL MARSA INTERNATIONAL SHIPPING SERVICES (L.L.C.)', 'Oman', null,
          'SIDDHARTH', 'Needs review', 'Country was blank; inferred. Source Sr No = 0 and city blank; confirm if record is incomplete. Phone, email or contact name is inside the address; move to contacts.',
          'agents_master_clean.csv row 7')
  returning id
), b as (
  insert into public.agent_branches
    (agent_id, label, address_raw, city, state, country, location_code, is_primary)
  select a.id, 'Head office', 'AL MARSA INTERNATIONAL SHIPPING SERVICES (L.L.C.)  OFFICE NO. 303, DARCOM TOWER, SOUTH AZAIBA BOUSHER, MUSCAT, BLOCK 250, WAY 5027 SULTANATE OF OMAN  CUSTOM CODE: C00206619  VAT: OM1100515566', null, null,
         'Oman', null, true
  from a returning id, agent_id
)
insert into public.agent_contacts (agent_id, branch_id, phone, is_primary)
select b.agent_id, b.id, '+968-77892289', true
from b where true;