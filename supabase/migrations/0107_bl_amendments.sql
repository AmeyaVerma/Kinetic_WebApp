-- BL amendments after issue (spec v2, H10).
--
-- "After a BL is issued, changing the POD Agent or Freight terms needs an
-- Approval and creates a BL amendment with an audit row." And: "version
-- history, amendment reason, and who approved it."
--
-- The flow, each step a database function so it cannot be half-done:
--   1. Staff REQUEST an amendment on an Issued or Released BL, with a reason and
--      the new POD agent and/or freight terms. This writes a bl_amendments row
--      and an Approvals entry (entity_type amendment_request).
--   2. An Admin or Approver decides it in Approvals. The approvals guard already
--      stops a person deciding their own request. Approving applies the change
--      to the booking; rejecting leaves it as it was.
--   3. Staff RE-ISSUE the BL, which writes the next document version. The
--      amendment then reads Reissued with that version number.
--
-- Until then the issued BL still prints what it printed, because an issued BL
-- reads its frozen snapshot, not the booking.
--
-- The booking's POD agent and freight terms are locked while a BL is Issued or
-- Released. Without that, the approval would be a formality: anyone could
-- change the booking directly and the next re-issue would pick it up.
-- Approving an amendment is the only thing that lifts the lock, for the
-- duration of one statement.
--
-- No charge is attached. v2 says "a charge where one applies" but nobody has
-- given a price, and a placeholder must not become a real charge.

create table if not exists public.bl_amendments (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null default public.default_tenant_id() references public.tenants(id),
  bl_id            uuid not null references public.bls(id) on delete cascade,
  booking_id       uuid not null references public.bookings(id) on delete cascade,
  status           text not null default 'Pending'
                   check (status in ('Pending', 'Approved', 'Rejected', 'Reissued')),
  reason           text not null check (length(trim(reason)) >= 5),
  changes          jsonb not null,
  requested_by     text,
  requested_at     timestamptz not null default now(),
  approval_id      uuid,
  decided_by       text,
  decided_at       timestamptz,
  reject_reason    text,
  reissued_version integer,
  reissued_at      timestamptz,
  reissued_by      text
);

create index if not exists bl_amendments_bl_idx on public.bl_amendments (bl_id);

alter table public.bl_amendments enable row level security;

-- Staff can read; nothing writes this table except the functions below.
drop policy if exists "staff read bl_amendments" on public.bl_amendments;
create policy "staff read bl_amendments" on public.bl_amendments for select
  using (tenant_id = public.auth_tenant_id() and public.can_read_nvocc());

drop trigger if exists bl_amendments_audit on public.bl_amendments;
create trigger bl_amendments_audit
after insert or update or delete on public.bl_amendments
for each row execute function public.audit_row_change();

-- 1. Request.
create or replace function public.request_bl_amendment(
  p_bl uuid, p_reason text, p_pod_agent uuid default null, p_freight_terms text default null
)
returns uuid
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_bl      public.bls%rowtype;
  v_b       public.bookings%rowtype;
  v_changes jsonb := '{}'::jsonb;
  v_new_ag  public.agents%rowtype;
  v_old_ag  text;
  v_id      uuid := gen_random_uuid();
  v_me      text;
begin
  if not public.can_write_nvocc() then
    raise exception 'You cannot request a BL amendment.' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then
    raise exception 'An amendment needs a reason.' using errcode = 'restrict_violation';
  end if;

  select * into v_bl from public.bls where id = p_bl and tenant_id = public.auth_tenant_id();
  if not found then
    raise exception 'That BL does not exist.' using errcode = 'no_data_found';
  end if;
  if v_bl.status not in ('Issued', 'Released') then
    raise exception 'The BL is %; only an issued BL needs an amendment. Edit a draft directly.', v_bl.status
      using errcode = 'restrict_violation';
  end if;
  if exists (select 1 from public.bl_amendments
              where bl_id = p_bl and status in ('Pending', 'Approved')) then
    raise exception 'This BL already has an amendment in progress. Finish or reject it first.'
      using errcode = 'restrict_violation';
  end if;

  select * into v_b from public.bookings where id = v_bl.booking_id;

  if p_pod_agent is not null and p_pod_agent is distinct from v_b.pod_agent_id then
    select * into v_new_ag from public.agents where id = p_pod_agent and tenant_id = public.auth_tenant_id();
    if not found or v_new_ag.status <> 'Active' then
      raise exception 'Choose an Active agent from the Agents master.' using errcode = 'restrict_violation';
    end if;
    if v_new_ag.compliance_status = 'Blocked' then
      raise exception 'That agent is blocked by screening.' using errcode = 'restrict_violation';
    end if;
    select name into v_old_ag from public.agents where id = v_b.pod_agent_id;
    v_changes := v_changes || jsonb_build_object('pod_agent_id', jsonb_build_object(
      'from', v_b.pod_agent_id, 'to', p_pod_agent, 'fromLabel', v_old_ag, 'toLabel', v_new_ag.name));
  end if;

  if p_freight_terms is not null and p_freight_terms is distinct from v_b.freight_terms then
    if p_freight_terms not in ('Prepaid', 'Collect') then
      raise exception 'Freight terms are Prepaid or Collect.' using errcode = 'restrict_violation';
    end if;
    v_changes := v_changes || jsonb_build_object('freight_terms', jsonb_build_object(
      'from', v_b.freight_terms, 'to', p_freight_terms));
  end if;

  if v_changes = '{}'::jsonb then
    raise exception 'Nothing would change. Pick a different POD agent or freight terms.'
      using errcode = 'restrict_violation';
  end if;

  select name into v_me from public.profiles where id = auth.uid();

  insert into public.bl_amendments (id, bl_id, booking_id, reason, changes, requested_by)
  values (v_id, p_bl, v_bl.booking_id, trim(p_reason), v_changes, coalesce(v_me, 'Staff'));

  insert into public.approvals
    (tenant_id, entity_type, entity_id, booking_id, entity_ref, summary, requested_by, status, payload)
  values
    (public.auth_tenant_id(), 'amendment_request', v_id::text, v_bl.booking_id, v_b.booking_ref,
     'Amend BL ' || coalesce(v_bl.bl_number, 'draft') || ' on ' || v_b.booking_ref || ': ' || trim(p_reason),
     coalesce(v_me, 'Staff'), 'Pending',
     jsonb_build_object('amendmentId', v_id, 'blId', p_bl, 'changes', v_changes, 'reason', trim(p_reason)));

  update public.bl_amendments
     set approval_id = (select id from public.approvals
                         where entity_type = 'amendment_request' and entity_id = v_id::text)
   where id = v_id;

  return v_id;
end
$fn$;

-- 2. The decision applies (or does not apply) the change.
create or replace function public.apply_bl_amendment_decision()
returns trigger
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_am public.bl_amendments%rowtype;
begin
  if new.entity_type <> 'amendment_request' or old.status <> 'Pending' or new.status = old.status then
    return new;
  end if;

  select * into v_am from public.bl_amendments where id = new.entity_id::uuid for update;
  if not found or v_am.status <> 'Pending' then
    return new;
  end if;

  if new.status = 'Approved' then
    -- The lock on these two booking fields is lifted for this one statement.
    perform set_config('app.amendment_apply', 'on', true);
    update public.bookings
       set pod_agent_id  = coalesce((v_am.changes -> 'pod_agent_id' ->> 'to')::uuid, pod_agent_id),
           freight_terms = coalesce(v_am.changes -> 'freight_terms' ->> 'to', freight_terms)
     where id = v_am.booking_id;
    perform set_config('app.amendment_apply', '', true);

    update public.bl_amendments
       set status = 'Approved', decided_by = new.decided_by, decided_at = now()
     where id = v_am.id;
  elsif new.status = 'Rejected' then
    update public.bl_amendments
       set status = 'Rejected', decided_by = new.decided_by, decided_at = now(),
           reject_reason = new.reject_reason
     where id = v_am.id;
  end if;

  return new;
end
$fn$;

drop trigger if exists approvals_apply_bl_amendment on public.approvals;
create trigger approvals_apply_bl_amendment
after update on public.approvals
for each row execute function public.apply_bl_amendment_decision();

-- The lock itself.
create or replace function public.guard_issued_bl_booking_fields()
returns trigger
language plpgsql security definer set search_path to 'public'
as $fn$
begin
  if (new.pod_agent_id is distinct from old.pod_agent_id
      or new.freight_terms is distinct from old.freight_terms)
     and coalesce(current_setting('app.amendment_apply', true), '') <> 'on'
     and exists (select 1 from public.bls b
                  where b.booking_id = new.id and b.status in ('Issued', 'Released')) then
    raise exception
      'This booking has an issued BL. Changing the POD agent or freight terms needs an approved BL amendment.'
      using errcode = 'restrict_violation';
  end if;
  return new;
end
$fn$;

drop trigger if exists bookings_guard_issued_bl_fields on public.bookings;
create trigger bookings_guard_issued_bl_fields
before update on public.bookings
for each row execute function public.guard_issued_bl_booking_fields();

-- 3. Re-issue: the new document version has been written; record it.
create or replace function public.record_bl_reissue(p_amendment uuid, p_version integer)
returns void
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_am public.bl_amendments%rowtype;
  v_me text;
begin
  if not public.can_write_nvocc() then
    raise exception 'You cannot re-issue a BL.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_am from public.bl_amendments
   where id = p_amendment and tenant_id = public.auth_tenant_id() for update;
  if not found then
    raise exception 'That amendment does not exist.' using errcode = 'no_data_found';
  end if;
  if v_am.status <> 'Approved' then
    raise exception 'The amendment is %; a BL is re-issued only once it is Approved.', v_am.status
      using errcode = 'restrict_violation';
  end if;
  if not exists (select 1 from public.document_versions
                  where booking_id = v_am.booking_id and doc_type = 'bl' and version = p_version) then
    raise exception 'That document version has not been written.' using errcode = 'restrict_violation';
  end if;

  select name into v_me from public.profiles where id = auth.uid();
  update public.bl_amendments
     set status = 'Reissued', reissued_version = p_version, reissued_at = now(),
         reissued_by = coalesce(v_me, 'Staff')
   where id = p_amendment;
end
$fn$;
