-- The Approver role (spec v2).
--
-- "Staff can be given an Approver role who can work the approval queue. Only
-- the Admin decides who gets it, per person and per company. An Approver
-- cannot approve their own request, cannot change Users & Roles or settings,
-- and cannot give the role to anyone else."
--
-- It is a FLAG on the membership, not a replacement for the role: an Ops
-- person who is also an Approver is still Ops everywhere else, and the flag is
-- per company because a person can hold different standing in Kinetic and
-- RKS. Nothing about it widens what a person can read or write elsewhere --
-- is_admin() stays false for them, which is exactly what keeps them out of
-- Users & Roles and settings.
--
-- Until now "who may decide an approval" lived in two places: a client check
-- (isAdmin) and the hidden buttons. Neither is a control. The decision itself
-- is now guarded in the database.

alter table public.memberships
  add column if not exists is_approver boolean not null default false;

create or replace function public.is_approver()
returns boolean
language sql stable security definer set search_path to 'public'
as $fn$
  select public.is_admin()
      or exists (
        select 1 from public.memberships m
         where m.user_id = auth.uid()
           and m.tenant_id = public.auth_tenant_id()
           and m.is_approver
      )
$fn$;

-- Only an Admin may grant or revoke the flag. A policy on memberships already
-- restricts writes to admins (an unauthorised UPDATE simply matches zero
-- rows); this trigger additionally stops anyone else from changing
-- is_approver should a policy ever be loosened.
create or replace function public.guard_approver_flag()
returns trigger
language plpgsql security definer set search_path to 'public'
as $fn$
begin
  if (tg_op = 'INSERT' and new.is_approver)
     or (tg_op = 'UPDATE' and new.is_approver is distinct from old.is_approver) then
    -- Server-side maintenance (migrations, service role) has no auth.uid().
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Only an Admin can give or remove the Approver role.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end
$fn$;

drop trigger if exists memberships_guard_approver on public.memberships;
create trigger memberships_guard_approver
before insert or update on public.memberships
for each row execute function public.guard_approver_flag();

-- Deciding an approval.
-- Moving a request out of Pending is a DECISION, and it is checked here:
--   * only an Admin or an Approver may decide;
--   * nobody decides their own request;
--   * decided_by is set from the signed-in person's profile, never taken from
--     what the browser sent, so the audit trail cannot be spoofed.
-- The one exception is the requester WITHDRAWING their own request (a
-- rejection by the same person), which is how cancelling your own leave
-- already works and which is not an approval of anything.
create or replace function public.guard_approval_decision()
returns trigger
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_me   text;
  v_self boolean;
begin
  if old.status = 'Pending' and new.status in ('Approved', 'Rejected') then
    -- Server-side maintenance is exempt; a real person never is.
    if auth.uid() is null then
      return new;
    end if;

    select name into v_me from public.profiles where id = auth.uid();
    v_self := lower(trim(coalesce(v_me, ''))) = lower(trim(old.requested_by));

    if v_self and new.status = 'Rejected' then
      new.decided_by := v_me;
      new.decided_at := coalesce(new.decided_at, now());
      return new;
    end if;

    if not public.is_approver() then
      raise exception 'Only an Admin or an Approver can decide an approval.'
        using errcode = 'insufficient_privilege';
    end if;

    if v_self then
      raise exception 'You cannot decide your own request.'
        using errcode = 'restrict_violation';
    end if;

    new.decided_by := v_me;
    new.decided_at := coalesce(new.decided_at, now());
  end if;
  return new;
end
$fn$;

drop trigger if exists approvals_guard_decision on public.approvals;
create trigger approvals_guard_decision
before update on public.approvals
for each row execute function public.guard_approval_decision();
