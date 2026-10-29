-- Spec M10, the larger half: 3,794 vessel rows hold only ~2,250 distinct
-- names, so the picker shows the same ship many times over (ZOI eight times,
-- OXIN nine, MAJD six).
--
-- This collapses a name to one row, but ONLY where nothing distinguishes the
-- copies. A name carrying two or more different call signs may genuinely be
-- two different ships, so those 58 names (308 rows) are left untouched for
-- someone who knows the fleet to judge.
--
-- vessel_voyages cascades on delete, so voyages and bookings are repointed at
-- the survivor BEFORE any row is removed.
--
-- NOT YET APPLIED -- removes ~1,300 rows and needs a human to run it.

create temporary table v_norm on commit drop as
select id,
       upper(trim(name)) as nm,
       nullif(nullif(upper(trim(coalesce(code, ''))), ''), '-') as cd,
       (select count(*) from public.vessel_voyages vv where vv.vessel_id = v.id) as voyages
from public.vessels v;

-- Names safe to collapse: at most one real code among the copies.
create temporary table v_group on commit drop as
select nm from v_norm group by nm having count(*) > 1 and count(distinct cd) <= 1;

-- One survivor per name: prefer a row that carries a code, then the one
-- holding the most voyages, then oldest id for a stable, repeatable choice.
create temporary table v_keep on commit drop as
select distinct on (n.nm) n.nm, n.id
from v_norm n join v_group g using (nm)
order by n.nm, (n.cd is not null) desc, n.voyages desc, n.id;

create temporary table v_drop on commit drop as
select n.id as loser, k.id as winner
from v_norm n join v_keep k using (nm)
where n.id <> k.id;

update public.vessel_voyages vv set vessel_id = d.winner
from v_drop d where vv.vessel_id = d.loser;

update public.bookings b set vessel_id = d.winner::text
from v_drop d where b.vessel_id = d.loser::text;

delete from public.vessels v using v_drop d where v.id = d.loser;
