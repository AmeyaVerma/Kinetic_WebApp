alter table public.air_ports
  add column locode text;

create unique index air_ports_locode_key on public.air_ports (locode) where locode is not null;
create index air_ports_locode_search_idx on public.air_ports (upper(locode));
