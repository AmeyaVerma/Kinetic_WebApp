-- "Opp Gundecha Onclave" removed from the printed corporate address at
-- Ameya's request.
--
-- This is one settings value shared by the BL and all five operational
-- documents, so the change lands on every document at once. That is the
-- intent: the same shipment's BL and CRO printing two different company
-- addresses would look like an error to a customer or a customs officer.
--
-- The column default is changed too, so a future tenant seeded from this
-- schema does not reintroduce the line.

update public.company_settings
set corporate_address = replace(corporate_address, 'Opp Gundecha Onclave, ', ''),
    updated_at = now()
where corporate_address like '%Opp Gundecha Onclave%';

alter table public.company_settings
  alter column corporate_address set default
    'Crescent Business Square, Office 1009, 10th Floor, Kherani Road, Saki Naka, Andheri East, Mumbai 400072, Maharashtra, India';
