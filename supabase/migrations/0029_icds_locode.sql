alter table public.icds
  add column locode text;

create unique index icds_locode_key on public.icds (locode) where locode is not null;
create index icds_locode_search_idx on public.icds (upper(locode));
