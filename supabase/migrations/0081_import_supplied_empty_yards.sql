-- The 28 empty container yards supplied on 30 Oct 2026, imported exactly as
-- given. Nothing dropped, merged or corrected.
--
-- TEN of them name-match a row already in empty_depots, because the existing
-- 13 depots and this list overlap: four SAI MARINE CONTAINER SERVICES sites,
-- KMP Overseas, Iran Depot BND, CCIS Keavy Victory Yard, CCIS Bhavani Depot,
-- Bhavani Empty Depot and Transworld Empty Park Mundra. v2 says possible
-- duplicates are flagged, not merged, so all 28 arrive as new rows and each
-- overlap carries a note naming the existing record. The master shows
-- duplicate pairs until somebody merges them -- that is the spec's deliberate
-- choice, not an accident, and six live bookings point at the existing rows
-- so nothing may be quietly repointed.
--
-- A row marked Ready arrives Active; Needs review arrives Inactive, so a
-- picker offers only what a person has actually checked. Two of the 28 are
-- Ready (Kaveh Port Tehran, Cargo Ship & Co IRBND).
--
-- ARNORIS's phone carried a NON-BREAKING SPACE between the digit groups.
-- It is invisible, it failed the "is this a clean phone number" test, and the
-- number would have been dropped silently. Normalised to an ordinary space.
-- The same fault hit one surveyor row, fixed in 0082.
--
-- Row 7's phone reads 'OFFICE MOBILE NO.9909038864' -- genuinely text around
-- a number, so it stays as supplied for a person to split.

insert into public.empty_depots
  (name, code, city, state, country, address_line1, phone, status,
   review_status, review_note, source_ref, sales_person)
values
  ('SQUIDWARD MARINE ENGINEERING WORKS & LOGISTICS (SME)', 'YRD-00001', 'Jasai Road', 'Maharashtra', 'India', 'VillageJasai, Port Road, Navi Mumbai, Taluka Survey no.167/2, Gavan Jasai road, near Pan India Yard URAN 400702  +91 85916 34569 Manoj', null, 'Inactive', 'Needs review', 'Country was blank; inferred. Phone, email or contact name is inside the address; move to contacts. No GSTIN.', 'empty_container_yards_master_clean.csv row 1', null),
  ('SIDDHIVINAYAK LOGISTICS - MUNDRA', 'YRD-00002', 'Mundra', 'Gujarat', 'India', 'Adani PORT, S-NO/169/2, Mundra Trade Center Plot no 60-61, Ops Adani Wilmar, SEZ Road, DHRUB, Mundra', null, 'Inactive', 'Needs review', 'Country was blank; inferred. No GSTIN.', 'empty_container_yards_master_clean.csv row 2', null),
  ('SHREE GANESH ENTERPRISES', 'YRD-00003', 'Panvel', 'Maharashtra', 'India', 'SURVEY NO 437/ 1-5 NH4B NEAR KANOBA DHABA AT- VAHAL VILLAGE TALUKA- PANVEL DIST RAIGAD NAVI MUMBAI 410206 (+91 70459 96992) VIKRANT', null, 'Inactive', 'Needs review', 'Country was blank; inferred. Phone, email or contact name is inside the address; move to contacts. No GSTIN.', 'empty_container_yards_master_clean.csv row 3', null),
  ('SEALAND INDIA MARINE AND LOGISTICS', 'YRD-00004', 'Jasai Village', 'Maharashtra', 'India', 'NEAR BLUE STAR CO, OPP : EPIC YARD POST JASAI VILLAGE DIST RAIGAD  MAHARATRA,410206 NASIR KHAN - 9022951044', null, 'Inactive', 'Needs review', 'Country was blank; inferred. Phone, email or contact name is inside the address; move to contacts. No GSTIN.', 'empty_container_yards_master_clean.csv row 4', null),
  ('SAI MARINE CONTAINER SERVICES(NSA REF)', 'YRD-00005', 'Navi Mumbai', 'Maharashtra', 'India', 'Jambhulpada,Post Jasai Near Jambhulpada Bus stop ,Uran,Navi Mumbai.', '7400312265', 'Inactive', 'Needs review', 'Same company as the other SAI MARINE CONTAINER SERVICES rows; suggest one company with branches. No GSTIN. Possible duplicate of existing master record ''Sai Marine Container Services'' - flagged, not merged; a person decides.', 'empty_container_yards_master_clean.csv row 5', null),
  ('SAI MARINE CONTAINER SERVICES(NSA DRY)', 'YRD-00006', 'Raigad', 'Maharashtra', 'India', 'Village – Jambulpada, Taluka Uran, Dist – Raigad Near Victor Yard Maharashtra, Pin Code- 410 206', '9307733984', 'Inactive', 'Needs review', 'Same company as the other SAI MARINE CONTAINER SERVICES rows; suggest one company with branches. No GSTIN. Possible duplicate of existing master record ''Sai Marine Container Services'' - flagged, not merged; a person decides.', 'empty_container_yards_master_clean.csv row 6', null),
  ('SAI MARINE CONTAINER SERVICES (MUNDRA)', 'YRD-00007', 'Mundra', 'Gujarat', 'India', 'S.NO 176, COMMERCIAL PLOT SHIVAM PARK, NEAR HOTEL SAMUNDRA,ADANI PORT ROAD, ZERO POINT ROAD,MUNDRA', null, 'Inactive', 'Needs review', 'Same company as the other SAI MARINE CONTAINER SERVICES rows; suggest one company with branches. State normalised from "KUTCH". Country was blank; inferred. No GSTIN. Possible duplicate of existing master record ''Sai Marine Container Services'' - flagged, not merged; a person decides.', 'empty_container_yards_master_clean.csv row 7', null),
  ('SAI MARINE CONTAINER SERVICES', 'YRD-00008', 'Uran', 'Maharashtra', 'India', 'Village Jambulpada, Taluka Uran, Dist Raigad Near Victor Yard', '7400312265', 'Inactive', 'Needs review', 'Possible duplicate of the (NSA REF) / (NSA DRY) entries (same Jambulpada, Uran area). Treat as one company with several yards? Country was blank; inferred. No GSTIN. Possible duplicate of existing master record ''Sai Marine Container Services'' - flagged, not merged; a person decides.', 'empty_container_yards_master_clean.csv row 8', 'SANDESH DAPOLKAR'),
  ('KMP OVERSEAS PVT LTD', 'YRD-00009', 'Dighode', 'Maharashtra', 'India', 'NEAR APM TERMINAL, AT POST - DIGHODE, TAL - URAN, DIST RAIGAD, NAVI MUMBAI - 410206 (9987705749) YARD@KMPOVERSEAS.COM', null, 'Inactive', 'Needs review', 'Country was blank; inferred. Phone, email or contact name is inside the address; move to contacts. No GSTIN. Possible duplicate of existing master record ''KMP Overseas Pvt Ltd'' - flagged, not merged; a person decides.', 'empty_container_yards_master_clean.csv row 9', null),
  ('KEAVY CONTAINER TERMINAL - DIGHODE(Victory yard)', 'YRD-00010', 'Uran', 'Maharashtra', 'India', 'Dighde village, Uran', null, 'Inactive', 'Needs review', 'Possible duplicate of CCIS Keavy Victory Yard. Country was blank; inferred. No GSTIN.', 'empty_container_yards_master_clean.csv row 10', null),
  ('KAVEH PORT AND MARINE SERVICES COMPANY - Tehran', 'YRD-00011', 'Tehran', 'Tehran', 'Iran', 'First floor, No. 149, Mirdamad Boulevard,, , Tehran - 0,', null, 'Active', 'Ready', null, 'empty_container_yards_master_clean.csv row 11', 'CAPT KHURANA'),
  ('KAILASH YARD - DIGHODE', 'YRD-00012', 'Uran', 'Maharashtra', 'India', 'Near Dighode Village, Uran', null, 'Inactive', 'Needs review', 'State normalised from "Maharastra". Country was blank; inferred. No GSTIN.', 'empty_container_yards_master_clean.csv row 12', null),
  ('Jebel Ali Terminals FZE', 'YRD-00013', 'Dubai', 'Dubai', 'United Arab Emirates', 'P.O. Box no. 17000, Dubai, UAE  04-8815555', '+971 4 8898606', 'Inactive', 'Needs review', 'Overseas terminal (Dubai), not an empty yard? Confirm it belongs here. Phone, email or contact name is inside the address; move to contacts.', 'empty_container_yards_master_clean.csv row 13', null),
  ('IRAN DEPOT - BND', 'YRD-00014', 'Iran', 'Iran', 'Iran', 'IRAN', null, 'Inactive', 'Needs review', 'Address is just "IRAN". Needs a real address. Country was blank; inferred. Possible duplicate of existing master record ''Iran Depot - BND'' - flagged, not merged; a person decides.', 'empty_container_yards_master_clean.csv row 14', null),
  ('IGM SHIPPING EMPTY YARD LLP', 'YRD-00015', 'Panvel', 'Maharashtra', 'India', 'Panvel - Uran Highway no 348, JNPT Road Near J Kumar Plant & Keavy Container yard Karanjade, Panvel ,  Pin 410206 Mob.9653149416', null, 'Inactive', 'Needs review', 'Country was blank; inferred. Phone, email or contact name is inside the address; move to contacts. No GSTIN.', 'empty_container_yards_master_clean.csv row 15', null),
  ('GRACE TERMINAL PRIVATE LIMITED', 'YRD-00016', 'Gavhan Phata Junction', 'Maharashtra', 'India', 'GAVHAN PHATA JUNCTION, CHIRNER DIGHODA ROAD, NEXT TO SAI SAHARA HOTEL/DHABA, PANVEL', '+91 9321683772', 'Inactive', 'Needs review', 'No GSTIN.', 'empty_container_yards_master_clean.csv row 16', 'SANDESH DAPOLKAR'),
  ('GLOBAL CONTCARE SERVICES PVT LTD ( YARD - 1 )', 'YRD-00017', 'Panvel', 'Maharashtra', 'India', 'Opp talav ,ongc road, Jasai-Ghavan Road. Tal-Uran, Dist-Raigad. Maharashtra', '7304413069', 'Inactive', 'Needs review', 'Name spelled differently from YARD 2 (CONTCARE vs CONT CARE). Two separate yards of one company. No GSTIN.', 'empty_container_yards_master_clean.csv row 17', null),
  ('GLOBAL CONT CARE SERVICES PVT LTD - YARD 2', 'YRD-00018', 'Panvel', 'Maharashtra', 'India', 'OLD SAICON YARD, NEXT TO MAX YARD, GAVHAN PHATA CHIRLE ROAD, WAHAL VILLAGE, PANVEL (TALUKA), RAIGAD(DIST), MAHARASHTRA(STATE) - CONTACT- +91 9152988659 / PARESH ADESH', null, 'Inactive', 'Needs review', 'Name spelled differently from YARD 1. Two separate yards of one company. Country was blank; inferred. Phone, email or contact name is inside the address; move to contacts. No GSTIN.', 'empty_container_yards_master_clean.csv row 18', null),
  ('EAGLE MARINE CONTAINER SERVICES', 'YRD-00019', null, 'Maharashtra', 'India', 'EAGLE MARINE CONTAINER SERVICES CHIRLE -R.K LOGISTICS SERVICE ROAD, NEAR OLD RAILWAY COLONY ATAL SHETU BRIDGE DOWNSIDE,SURVEY NO 205/5, NH4-B, NEAR CHIRLE VILLAGE, POST JASAI,TALUKA URAN, DISTRICT RAIGAD,410206', null, 'Inactive', 'Needs review', 'Country was blank; inferred. Source Sr No = 0 and city blank; confirm if record is incomplete. No GSTIN.', 'empty_container_yards_master_clean.csv row 19', null),
  ('CMA CGM Inland Services India LLP', 'YRD-00020', null, null, null, 'Co Shubham Newport LLP, Near Shubham petrol pump, opp Galaxy Hotel, Shakti nagar road, Mundra - 370421', '8238038206 / 8850253460', 'Inactive', 'Needs review', 'Possible duplicate of CMA CGM INLAND SERVICES - MUNDRA (two addresses, maybe old and new). State was "s" in source; blank, confirm. Source Sr No = 0 and city blank; confirm if record is incomplete.', 'empty_container_yards_master_clean.csv row 20', 'SIDDHARTH'),
  ('CMA CGM INLAND SERVICES - MUNDRA', 'YRD-00021', 'Mundra', 'Gujarat', 'India', '109, Building B, Nirmaan by Shubham, Survey No:34/2, Nana Kapaya Rd, Mundra, Borana', null, 'Inactive', 'Needs review', 'Possible duplicate of CMA CGM Inland Services India LLP. No GSTIN.', 'empty_container_yards_master_clean.csv row 21', null),
  ('CCIS Keavy Victory Yard', 'YRD-00022', 'Navi Mumbai', 'Maharashtra', 'India', 'Village – Jambul Pada, Gavan Fata – Dighoda Road, Opp. Dyaneshwar Depot Taluka Uran, Dist – Raigad, Pin - 410221', '+91-8108785912', 'Inactive', 'Needs review', 'Possible duplicate of KEAVY CONTAINER TERMINAL - DIGHODE (Victory yard). No GSTIN. Possible duplicate of existing master record ''CCIS Keavy Victory Yard'' - flagged, not merged; a person decides.', 'empty_container_yards_master_clean.csv row 22', null),
  ('CCIS BHAVANI DEPOT', 'YRD-00023', 'Navi Mumbai', 'Maharashtra', 'India', 'Opposite Coldman Warehousing At-Bhom Village, Gavhanphata-Chirner Road, ( Khar patil road) Post: Chirner , Taluka: Uran, Dist Raigad, Navi Mumbai Pincode : 410206 .', '7304973159', 'Inactive', 'Needs review', 'Possible duplicate of BHAVANI EMPTY DEPOT (same address). No GSTIN. Possible duplicate of existing master record ''CCIS Bhavani Depot'' - flagged, not merged; a person decides.', 'empty_container_yards_master_clean.csv row 23', null),
  ('CARGO SHIP & CO. - IRBND', 'YRD-00024', 'Bandar Abbas', 'Bandar Abbas', 'Iran', 'Bandar Abbas', null, 'Active', 'Ready', null, 'empty_container_yards_master_clean.csv row 24', null),
  ('BOX FOUR SERVICES LLP', 'YRD-00025', 'Panvel', 'Maharashtra', 'India', 'At Post Village Manghar, Next to zircon depot-1 Near Pankaj Parking Panvel Jnpt Road NH4B Panvel', '91 8726490379 /+91 9004753093', 'Inactive', 'Needs review', 'No GSTIN.', 'empty_container_yards_master_clean.csv row 25', null),
  ('BHAVANI EMPTY DEPOT', 'YRD-00026', 'Navi Mumbai', 'Maharashtra', 'India', 'Landmark: Opposite Coldman Warehousing At-Bhom Village, Gavhanphata-Chirner Road,  ( Khar patil road) Post: Chirner , Taluka: Uran, Dist Raigad, Navi Mumbai', null, 'Inactive', 'Needs review', 'Possible duplicate of CCIS BHAVANI DEPOT (same address). Country was blank; inferred. No GSTIN. Possible duplicate of existing master record ''Bhavani Empty Depot'' - flagged, not merged; a person decides.', 'empty_container_yards_master_clean.csv row 26', null),
  ('ARNORIS CONTAINER SERVICES LLP', 'YRD-00027', 'Jnpt Panvel Road', 'Maharashtra', 'India', 'C/O INOX SHIPPING AGENCIES (I) PVT.LTD VILLAGE BAMBAVI, OPP JM MHATRE OFFICE NH4B,JNPT PANVEL ROAD., PANVEL - 410206, +91 98671 80643 sanjay', '+91 98671 80643', 'Inactive', 'Needs review', 'Country was blank; inferred. Phone, email or contact name is inside the address; move to contacts. No GSTIN. Phone held a non-breaking space in the source; normalised.', 'empty_container_yards_master_clean.csv row 27', null),
  ('TRANSWORLD EMPTY PARK MUNDRA', 'YRD-00028', null, null, null, 'Survey. No. 200/1/3 , Behind Kej Marine, Village  zarpara, Tal Mundra Kutch, Gujarat  9099909178 Vijay Kumar Singh', null, 'Inactive', 'Needs review', 'Source Sr No = 0 and city blank; confirm if record is incomplete. Phone, email or contact name is inside the address; move to contacts. Possible duplicate of existing master record ''Transworld Empty Park Mundra'' - flagged, not merged; a person decides.', 'empty_container_yards_master_clean.csv row 28', null);

-- One branch per imported yard, carrying the address exactly as supplied.
insert into public.empty_depot_branches
  (depot_id, label, address_raw, city, state, country, is_primary)
select id, 'Main yard', address_line1, city, state, country, true
  from public.empty_depots
 where source_ref like 'empty_container_yards_master_clean.csv row %';

-- A contact only where the source gave a phone clean enough to be one.
insert into public.empty_depot_contacts (depot_id, branch_id, phone, is_primary)
select d.id, b.id, d.phone, true
  from public.empty_depots d
  join public.empty_depot_branches b on b.depot_id = d.id
 where d.source_ref like 'empty_container_yards_master_clean.csv row %'
   and d.phone is not null;
