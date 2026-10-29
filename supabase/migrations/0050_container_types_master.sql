-- Spec data rule 2, "no hard-coded option lists": container types lived as an
-- eight-item array inside the booking form, and anything a user added through
-- "Add container type" was kept in browser memory only -- it vanished on
-- refresh and no other screen ever saw it.
--
-- Siddharth: "Add all container types universally." So this is the standard
-- ISO 6346 set an NVOCC actually books, plus every name that was selectable
-- before, so nothing a booking already holds stops resolving.

create table if not exists public.container_types (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  iso_code    text,
  size_ft     integer,
  category    text not null default 'Dry',
  high_cube   boolean not null default false,
  teu         numeric(3,2),
  -- Older spellings for the same box, so a booking holding "40HC" still
  -- resolves to the canonical row rather than looking like a stray value.
  aliases     text[] not null default '{}',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (tenant_id, name)
);

alter table public.container_types enable row level security;

create policy "read container_types" on public.container_types
  for select using (tenant_id = auth_tenant_id());

create policy "write container_types" on public.container_types
  for all using (tenant_id = auth_tenant_id() and can_write_masters())
  with check (tenant_id = auth_tenant_id() and can_write_masters());

insert into public.container_types
  (tenant_id, name, iso_code, size_ft, category, high_cube, teu, aliases)
select '346b813c-572d-487a-ba55-e800f04753fd'::uuid, v.name, v.iso, v.ft, v.cat, v.hc, v.teu, v.aliases
from (values
  ('20 ft dry',         '22G1', 20, 'Dry',       false, 1.00, array['20GP','20DV','22G1']),
  ('20 ft HC',          '25G1', 20, 'Dry',       true,  1.00, array['20HC']),
  ('40 ft dry',         '42G1', 40, 'Dry',       false, 2.00, array['40GP','40DV','42G1']),
  ('40 ft HC',          '45G1', 40, 'Dry',       true,  2.00, array['40HC','40HQ','45G1']),
  ('45 ft HC',          'L5G1', 45, 'Dry',       true,  2.25, array['45HC']),
  ('20 ft reefer',      '22R1', 20, 'Reefer',    false, 1.00, array['20RF','20RE']),
  ('40 ft reefer',      '42R1', 40, 'Reefer',    false, 2.00, array['40RF','40RE']),
  ('40 ft HC reefer',   '45R1', 40, 'Reefer',    true,  2.00, array['40RH','40HR']),
  ('20 ft OT',          '22U1', 20, 'Open Top',  false, 1.00, array['20OT']),
  ('40 ft OT',          '42U1', 40, 'Open Top',  false, 2.00, array['40OT']),
  ('40 ft HC OT',       '45U1', 40, 'Open Top',  true,  2.00, array[]::text[]),
  ('20 ft FR',          '22P1', 20, 'Flat Rack', false, 1.00, array['20FR']),
  ('40 ft FR',          '42P1', 40, 'Flat Rack', false, 2.00, array['40FR']),
  ('20 ft tank',        '22T0', 20, 'Tank',      false, 1.00, array['20TK','ISO tank']),
  ('40 ft tank',        '42T0', 40, 'Tank',      false, 2.00, array['40TK']),
  ('20 ft ventilated',  '22V0', 20, 'Ventilated',false, 1.00, array['20VH']),
  -- Carried over from the old hard-coded list so nothing that used to be
  -- selectable disappears. No ISO code: neither is a standard type code.
  ('40 ft ER',          null,   40, 'Dry',       false, 2.00, array[]::text[]),
  ('40 ft ISO',         null,   40, 'Tank',      false, 2.00, array[]::text[])
) as v(name, iso, ft, cat, hc, teu, aliases)
where not exists (
  select 1 from public.container_types ct
  where ct.tenant_id = '346b813c-572d-487a-ba55-e800f04753fd'::uuid and ct.name = v.name
);
