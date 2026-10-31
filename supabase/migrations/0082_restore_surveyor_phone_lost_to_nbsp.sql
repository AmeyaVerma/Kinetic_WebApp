-- SAI MARINE SURVEYORS - MUN carried its phone as '99096<NBSP>38864' -- the
-- separator is a NON-BREAKING SPACE, not an ordinary one. It is invisible in
-- every viewer, it failed the "is this a clean phone number" test when 0080
-- imported the surveyors, and the number was dropped.
--
-- Restored here with an ordinary space. The same fault hit one yard row; that
-- one was caught before import and handled in 0081.
--
-- Worth remembering: the supplied files came out of a spreadsheet, and
-- spreadsheets produce non-breaking spaces routinely. Any future importer
-- should normalise them before deciding whether a value is usable.

update public.surveyors
   set phone = '99096 38864',
       review_note = coalesce(review_note, '') ||
         ' Phone held a non-breaking space in the source; restored and normalised.'
 where source_ref = 'surveyors_master_clean.csv row 2'
   and phone is null;

insert into public.surveyor_contacts (surveyor_id, branch_id, phone, is_primary)
select s.id, b.id, s.phone, true
  from public.surveyors s
  join public.surveyor_branches b on b.surveyor_id = s.id
 where s.source_ref = 'surveyors_master_clean.csv row 2'
   and s.phone is not null
   and not exists (
     select 1 from public.surveyor_contacts c
      where c.surveyor_id = s.id and c.phone is not null
   );
