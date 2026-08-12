-- Terminal code + operator, needed to import the SMDG sea terminals
-- dataset and to let bookings search by LOCODE / terminal code / port
-- name, not just port/terminal name.

alter table public.sea_port_terminals
  add column code text,
  add column operator_name text;

create index sea_port_terminals_code_idx on public.sea_port_terminals (upper(code));
