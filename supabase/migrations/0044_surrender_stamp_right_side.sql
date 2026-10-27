-- Surrender stamp moved to the right-hand side of the BL.
--
-- It was landing mid-page, above the Number of Original MTD(s) column.
-- Siddharth's correction: it belongs on the right, over the Place and Date
-- of issue column. Checked by compositing onto the real blank form before
-- changing anything.
--
-- Coordinates are PDF points from the bottom-left of an A4 page
-- (595.28 x 841.89). x 424 + width 145 = 569, which keeps it inside the
-- form's right rule at 577.

update public.company_settings
set asset_placement = jsonb_set(
      asset_placement,
      '{surrender}',
      '{"x": 424, "y": 188, "width": 145, "height": 35}'::jsonb
    ),
    updated_at = now();

alter table public.company_settings
  alter column asset_placement set default '{
    "signature": { "x": 452, "y": 44,  "width": 78,  "height": 101 },
    "stamp":     { "x": 452, "y": 44,  "width": 78,  "height": 101 },
    "surrender": { "x": 424, "y": 188, "width": 145, "height": 35 }
  }'::jsonb;
