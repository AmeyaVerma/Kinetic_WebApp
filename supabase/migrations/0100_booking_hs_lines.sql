-- Several HS codes on one booking, each with its own cargo line (spec v2).
--
-- bookings.hs_code held a single free-text code and no booking has one filled
-- in, so nothing is migrated. A line here points at the HS master by code, so a
-- booking cannot carry a code that does not exist; a withdrawn code cannot be
-- newly chosen.
--
-- Read follows the booking: whoever can see the booking (including the portal
-- party or agent that RLS already lets through) sees its lines. Writing is
-- operations staff only, and only on a booking in their own company.

create table if not exists public.booking_hs_lines (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null references public.bookings(id) on delete cascade,
  hs_code          text not null references public.hs_codes(code),
  cargo_description text,
  packages         integer check (packages is null or packages >= 0),
  gross_weight_kg  numeric check (gross_weight_kg is null or gross_weight_kg >= 0),
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  created_by       text
);

create index if not exists booking_hs_lines_booking_idx on public.booking_hs_lines (booking_id);
-- The same code twice on one booking is one line with a bigger cargo, not two.
create unique index if not exists booking_hs_lines_unique_code on public.booking_hs_lines (booking_id, hs_code);

alter table public.booking_hs_lines enable row level security;

drop policy if exists "read booking_hs_lines" on public.booking_hs_lines;
create policy "read booking_hs_lines" on public.booking_hs_lines for select
  using (exists (select 1 from public.bookings b where b.id = booking_hs_lines.booking_id));

drop policy if exists "write booking_hs_lines" on public.booking_hs_lines;
create policy "write booking_hs_lines" on public.booking_hs_lines for all
  using (public.can_write_nvocc()
         and exists (select 1 from public.bookings b
                      where b.id = booking_hs_lines.booking_id and b.tenant_id = public.auth_tenant_id()))
  with check (public.can_write_nvocc()
         and exists (select 1 from public.bookings b
                      where b.id = booking_hs_lines.booking_id and b.tenant_id = public.auth_tenant_id()));

create or replace function public.guard_hs_line()
returns trigger
language plpgsql security definer set search_path to 'public'
as $fn$
begin
  if (tg_op = 'INSERT' or new.hs_code is distinct from old.hs_code)
     and exists (select 1 from public.hs_codes where code = new.hs_code and status <> 'Active') then
    raise exception 'HS code % is withdrawn and cannot be chosen.', new.hs_code
      using errcode = 'restrict_violation';
  end if;
  return new;
end
$fn$;

drop trigger if exists booking_hs_lines_guard on public.booking_hs_lines;
create trigger booking_hs_lines_guard
before insert or update on public.booking_hs_lines
for each row execute function public.guard_hs_line();
