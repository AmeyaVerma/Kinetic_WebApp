-- Multi-BL rules, enforced where the data is written (spec v2).
--
-- 1. A booking cannot reach its closing milestone while any of its BLs is still
--    a Draft. Every BL must be issued, released or cancelled first. The closing
--    milestone is surrender_released on an export and documents_received on an
--    import, which is what the status ladder in src/lib/milestones.ts turns
--    into "Closed".
-- 2. A House BL cannot be issued if the House BLs of the booking would then
--    carry more packages or more weight than the booking declares. The booking's
--    own figure is only enforced when it was actually entered (> 0), so a
--    booking with no declared total is not blocked by a guess.

create or replace function public.guard_booking_close()
returns trigger
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_open int;
begin
  if new.key in ('surrender_released', 'documents_received') and new.completed_at is not null then
    select count(*) into v_open from public.bls
     where booking_id = new.booking_id and status = 'Draft';
    if v_open > 0 then
      raise exception
        '% BL(s) on this booking are still Draft. Issue, release or cancel every BL before the booking closes.', v_open
        using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end
$fn$;

drop trigger if exists booking_milestones_guard_close on public.booking_milestones;
create trigger booking_milestones_guard_close
before insert or update on public.booking_milestones
for each row execute function public.guard_booking_close();

create or replace function public.guard_bl_issue_allocation()
returns trigger
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_pk_total  numeric;
  v_wt_total  numeric;
  v_pk_alloc  numeric;
  v_wt_alloc  numeric;
begin
  if new.status = 'Issued' and old.status is distinct from 'Issued' and new.role = 'House' then
    select packages, gross_weight_kg into v_pk_total, v_wt_total
      from public.bookings where id = new.booking_id;

    select coalesce(sum(c.packages), 0), coalesce(sum(c.gross_weight_kg), 0)
      into v_pk_alloc, v_wt_alloc
      from public.bl_containers c
      join public.bls b on b.id = c.bl_id
     where c.booking_id = new.booking_id
       and b.role = 'House'
       and b.status <> 'Cancelled';

    if coalesce(v_pk_total, 0) > 0 and v_pk_alloc > v_pk_total then
      raise exception 'The House BLs carry % packages but the booking declares %. Fix the split before issuing.',
        v_pk_alloc, v_pk_total using errcode = 'restrict_violation';
    end if;
    if coalesce(v_wt_total, 0) > 0 and v_wt_alloc > v_wt_total then
      raise exception 'The House BLs carry % kg but the booking declares % kg. Fix the split before issuing.',
        v_wt_alloc, v_wt_total using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end
$fn$;

drop trigger if exists bls_guard_issue_allocation on public.bls;
create trigger bls_guard_issue_allocation
before update on public.bls
for each row execute function public.guard_bl_issue_allocation();
