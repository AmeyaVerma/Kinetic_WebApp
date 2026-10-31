-- The four surveyors and six CFS supplied on 30 Oct 2026, imported exactly
-- as given. Nothing dropped, merged or corrected.
--
-- Three of the four surveyors are SAI MARINE SURVEYORS at Navi Mumbai,
-- Mundra and Gandhidham, and the existing master already holds a row of that
-- name. v2 says possible duplicates are flagged, not merged, so all three
-- arrive as separate rows with a note naming the existing record. A person
-- decides whether that becomes one company with three branches.
--
-- A row marked Ready arrives Active; Needs review arrives Inactive, so a
-- picker offers only what somebody has actually checked. None of these four
-- surveyors is Ready, so all arrive inactive.
--
-- NOTE: this file is the regenerated form of what was applied. The applied
-- version wrote each row as its own CTE; this is the same data written
-- compactly. One row's phone (SAI MARINE SURVEYORS - MUN) was lost to a
-- non-breaking space at import time and is restored by 0082.
--
-- Generated from surveyors_master_clean.csv and cfs_master_clean.csv.

insert into public.surveyors
  (name, address_line1, city, state, country, phone, active,
   review_status, review_note, source_ref, sales_person)
values
  ('SAI MARINE SURVEYORS - NSA', 'Plot no.06, Sec.11, Behind Anchorage Bldg., NMSEZ Commercial Complex, C Wing, 1st Floor, Off.No.102, Township,Navi Mumbai', 'Navi Mumbai', 'Maharashtra', 'India', '+918080970229', false, 'Needs review', 'Same company as the MUN and KAN rows; suggest one surveyor with 3 branches. No GSTIN. Possible duplicate of the existing master record ''Sai Marine Surveyors'' - flagged, not merged; a person decides.', 'surveyors_master_clean.csv row 1', 'SANDESH DAPOLKAR'),
  ('SAI MARINE SURVEYORS - MUN', 'Office No.123 & 124, 1st floor, Sadguru Empire -02,  Near Rashapir Circle, Adani Port Road, Mundra (Kutch – Gujarat)- 370 421  OFFICE NO -99096 38864', 'Mundra', 'Gujarat', 'India', '99096 38864', false, 'Needs review', 'Same company as the NSA and KAN rows; suggest one surveyor with 3 branches. Phone, email or contact name is inside the address; move to contacts. No GSTIN. Possible duplicate of the existing master record ''Sai Marine Surveyors'' - flagged, not merged; a person decides. Phone held a non-breaking space in the source; normalised.', 'surveyors_master_clean.csv row 2', null),
  ('SAI MARINE SURVEYORS - KAN', 'Office No.-02, Plot no.786,  Near, Power House,  Gandhidham,Kutch (370 201),  Cell:9726474403 E-ops.kandla@saimarine.in', 'Gandhidham', 'Gujarat', 'India', null, false, 'Needs review', 'Same company as the NSA and MUN rows; suggest one surveyor with 3 branches. Phone, email or contact name is inside the address; move to contacts. No GSTIN. Possible duplicate of the existing master record ''Sai Marine Surveyors'' - flagged, not merged; a person decides.', 'surveyors_master_clean.csv row 3', null),
  ('M/S UNITED LOGISTICS', '306 D WING, 3RD FLOOR, RELIANCE BUILDING OPP JNPT INDIA', null, null, 'India', '+91 9819187746', false, 'Needs review', 'Looks like a logistics company, not a surveyor. Confirm. Source Sr No = 0 and city blank; confirm if record is incomplete. No GSTIN.', 'surveyors_master_clean.csv row 4', null);


insert into public.surveyor_branches
  (surveyor_id, label, address_raw, city, state, country, is_primary)
select id, 'Office', address_line1, city, state, country, true
  from public.surveyors
 where source_ref like 'surveyors_master_clean.csv row %';

insert into public.surveyor_contacts (surveyor_id, branch_id, phone, is_primary)
select s.id, b.id, s.phone, true
  from public.surveyors s
  join public.surveyor_branches b on b.surveyor_id = s.id
 where s.source_ref like 'surveyors_master_clean.csv row %'
   and s.phone is not null;


insert into public.cfs
  (code, name, pan, status, sales_person, review_status, review_note, source_ref)
values
  ('CFS-00001', 'TRANSWORLD TERMINALS PVT LTD (CFS)', null, 'Inactive', null, 'Needs review', 'Same company as Transworld Unit-2 at a different location; suggest one company with branches. No GSTIN.', 'cfs_master_clean.csv row 1'),
  ('CFS-00002', 'Transworld Terminals Private Limited(Unit-2)', null, 'Inactive', null, 'Needs review', 'Same company as TRANSWORLD TERMINALS PVT LTD (CFS) at a different location; suggest one company with branches. Phone, email or contact name is inside the address; move to contacts. No GSTIN.', 'cfs_master_clean.csv row 2'),
  ('CFS-00003', 'SPEEDY MULTIMODES LIMITED', null, 'Inactive', null, 'Needs review', 'Same company as SPEEDY MULTILODES LTD(CFS) at a different location (JNPT vs Mundra); suggest one company with branches. Country was blank; inferred. No GSTIN.', 'cfs_master_clean.csv row 3'),
  ('CFS-00004', 'SPEEDY MULTILODES LTD(CFS)', null, 'Inactive', null, 'Needs review', 'Name looks misspelled (MULTILODES, other row says MULTIMODES). Confirm. Country was blank; inferred. No GSTIN.', 'cfs_master_clean.csv row 4'),
  ('CFS-00005', 'Navkar Corporation (ICD Tumb)', null, 'Inactive', null, 'Needs review', 'No GSTIN.', 'cfs_master_clean.csv row 5'),
  ('CFS-00006', 'Maharashtra State Warehousing Corporation  (MSWC-CFS)', 'AABCM3988M', 'Inactive', 'SANDESH DAPOLKAR', 'Needs review', 'No GSTIN.', 'cfs_master_clean.csv row 6');


insert into public.cfs_branches
  (cfs_id, label, address_raw, city, state, country, location_code, is_primary)
values ((select id from public.cfs where source_ref = 'cfs_master_clean.csv row 1'), 'Main CFS', 'GAVHANPHATA - CHIRNER RD, VESHVI, MAHARASHTRA 410206', 'Navi Mumbai', 'Maharashtra', 'India', null, true),
  ((select id from public.cfs where source_ref = 'cfs_master_clean.csv row 2'), 'Main CFS', 'Transworld Terminals Private Limited(Unit-2),  Adani Port & SEZ Ltd, Mundra (Kutch) - 370421 Mob. 08866002822/07211198384', 'Mundra', 'Gujarat', 'India', null, true),
  ((select id from public.cfs where source_ref = 'cfs_master_clean.csv row 3'), 'Main CFS', 'JNP-CFS, SONARI VILLAGE, TALUKA URAN, NAVI MUMBAI - 400 707, INDIA.', 'Jnpt', 'Maharashtra', 'India', null, true),
  ((select id from public.cfs where source_ref = 'cfs_master_clean.csv row 4'), 'Main CFS', 'C/o cwc, container freight station (CFS), Bharat CFS Zone -1, APSEZ, Mundra-370421', 'Mundra', 'Gujarat', 'India', null, true),
  ((select id from public.cfs where source_ref = 'cfs_master_clean.csv row 5'), 'Main CFS', 'Survey No. 44/1, 44/1/1, 44/1/2, Village Tumb, Tal- Umbergaon, Dist- Valsad, Gujarat, India', 'Valsad', 'Gujarat', 'India', 'ATU / INSAJ6', true),
  ((select id from public.cfs where source_ref = 'cfs_master_clean.csv row 6'), 'Main CFS', 'Plot No. 89, Sector-1, D Node, NHAVA SHEVA, Navi Mumbai', 'Uran', 'Maharashtra', 'India', 'MSW / INNSA1MSW1', true);


insert into public.cfs_contacts (cfs_id, branch_id, phone, is_primary)
select c.id, b.id, null, true
  from public.cfs c join public.cfs_branches b on b.cfs_id = c.id
 where false;

insert into public.cfs_contacts (cfs_id, branch_id, phone, is_primary)
select c.id, b.id, '9860969890', true from public.cfs c join public.cfs_branches b on b.cfs_id = c.id
 where c.source_ref = 'cfs_master_clean.csv row 1';

insert into public.cfs_contacts (cfs_id, branch_id, phone, is_primary)
select c.id, b.id, '+91-260-2408400', true from public.cfs c join public.cfs_branches b on b.cfs_id = c.id
 where c.source_ref = 'cfs_master_clean.csv row 5';
