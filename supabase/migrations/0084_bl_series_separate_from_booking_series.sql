-- BL numbers were being minted in the BOOKING namespace.
--
-- There is a proper `nvocc_bl` sequence, separate from bookings, but
-- formatBlNumber hard-coded the booking prefix:
--
--     return `KLNVO${fyCode}${String(sequence).padStart(6, '0')}`
--
-- So generating a BL on booking KLNVO2627000025 produced the BL number
-- KLNVO2627000014 -- a string indistinguishable from a booking reference,
-- drawn from a different counter. Search cannot tell the two apart, and
-- KLNVO2627000014 is a reference a booking will also carry. Spec v2 says
-- each BL takes its number "from the BL series", and under v2 one booking
-- carries several BLs, so the collision would multiply.
--
-- The prefix becomes a setting rather than a constant, beside invoice_series
-- which already works this way. KLMTD is a placeholder default chosen only
-- because it is clearly distinct from KLNVO and matches the "MTD NUMBER"
-- label the BL screen already uses -- SIDDHARTH SHOULD CONFIRM THE REAL
-- PREFIX, as it appears on an issued transport document.
--
-- Existing BL numbers are NOT rewritten. All three are drafts, but a number
-- once allocated is not silently changed; whoever reviews them can regenerate
-- if they want the new format.

alter table public.company_settings
  add column if not exists bl_series text;

update public.company_settings
   set bl_series = coalesce(bl_series, 'KLMTD');
