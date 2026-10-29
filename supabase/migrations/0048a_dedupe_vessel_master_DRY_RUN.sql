-- DRY RUN for 0048. Read-only: SELECTs only, deletes nothing.
--
-- Run this, read the three result sets, then decide whether to run 0048.
--
--   1. Summary       -- how many rows go, how many voyages get repointed
--   2. Merge plan    -- the worst offenders, so the shape is visible
--   3. Skipped names -- the ones 0048 deliberately leaves alone
--
-- Why there are duplicates at all: the whole master was imported on
-- 7 Aug 2026 in batches of 300, and the source file listed a vessel once per
-- voyage. SAFEEN POWER appears 12 times, 11 of them in the same batch, with
-- the call sign V7A5686 present on four rows and missing on the rest.

-- 1 ── Summary ───────────────────────────────────────────────────────────
with v as (
  select id, upper(trim(name)) as nm,
         nullif(nullif(upper(trim(coalesce(code,''))),''),'-') as cd,
         (select count(*) from public.vessel_voyages vv where vv.vessel_id = v.id) as voyages,
         (select count(*) from public.bookings b where b.vessel_id = v.id::text) as bookings
  from public.vessels v
),
groups as (select nm from v group by nm having count(*) > 1 and count(distinct cd) <= 1),
keep as (
  select distinct on (n.nm) n.nm, n.id from v n join groups g using (nm)
  order by n.nm, (n.cd is not null) desc, n.voyages desc, n.id
),
losers as (
  select n.id, n.nm, n.voyages, n.bookings
  from v n join keep k using (nm) where n.id <> k.id
)
select 'vessel rows today'                      as metric, (select count(*)::text from v)              as value
union all select 'names being merged',           (select count(distinct nm)::text from losers)
union all select 'rows deleted',                 (select count(*)::text from losers)
union all select 'rows remaining',               ((select count(*) from v) - (select count(*) from losers))::text
union all select 'voyages repointed to survivor',(select coalesce(sum(voyages),0)::text from losers)
union all select 'bookings repointed to survivor',(select coalesce(sum(bookings),0)::text from losers)
union all select 'names skipped (differing codes)',
  (select count(*)::text from (select nm from v group by nm having count(distinct cd) > 1) s);

-- 2 ── Merge plan, worst first ───────────────────────────────────────────
with v as (
  select name, upper(trim(name)) as nm,
         nullif(nullif(upper(trim(coalesce(code,''))),''),'-') as cd
  from public.vessels
),
groups as (select nm from v group by nm having count(*) > 1 and count(distinct cd) <= 1)
select n.name,
       count(*)                                   as copies_now,
       1                                          as kept_after,
       count(*) - 1                               as deleted,
       coalesce(max(n.cd), '(no call sign)')      as call_sign
from v n join groups g using (nm)
group by n.name
order by copies_now desc, n.name
limit 40;

-- 3 ── Skipped, and whether the skip is justified ────────────────────────
-- The `code` column holds a mix of real call signs and voyage numbers. A
-- voyage number masquerading as a call sign makes a name look ambiguous when
-- it is not: LIBRA carries "0226" and "J8B5553", which is one ship and one
-- voyage, not two ships.
with v as (
  select upper(trim(name)) as nm,
         nullif(nullif(upper(trim(coalesce(code,''))),''),'-') as cd
  from public.vessels
),
classified as (
  select nm, cd,
         case
           when cd is null then null
           when cd in ('NA','N/A','NIL','NILL','TBA') then null
           when cd ~ '^[0-9]+[A-Z]?$' then null          -- 0226, 008, 2525W
           when cd ~ '^[A-Z][A-Z0-9]{3,}$' then cd       -- J8B5553, VTKN
           else null
         end as call_sign
  from v
)
select nm                                              as vessel_name,
       count(*)                                        as rows_now,
       string_agg(distinct cd, ' | ')                  as raw_codes,
       coalesce(string_agg(distinct call_sign, ' | '), '(none)') as real_call_signs,
       case when count(distinct call_sign) > 1
            then 'GENUINELY AMBIGUOUS - needs a human'
            else 'safe to merge - second code is a voyage number'
       end                                             as verdict
from classified
group by nm
having count(distinct cd) > 1
order by count(distinct call_sign) desc, count(*) desc;
