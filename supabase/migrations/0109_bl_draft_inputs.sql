-- Customer and agent BL draft inputs (spec v2, portal).
--
-- A customer fills in the BL fields for a House BL on their own booking. It is
-- an INPUT, not a BL: no MTD number is allocated, nothing is signed, and it
-- changes nothing on the booking until Kinetic approves it. Approving applies
-- the inputs to the booking (shipper, consignee, notify party, cargo, packages,
-- weight, container numbers); staff then generate the draft BL as usual and
-- attach the PDF, which the customer downloads through the same short-lived
-- link as any released document.
--
-- Only House BL inputs. The Master BL and a Surrender BL are Kinetic's.
-- Once a BL has been issued the inputs are refused: changing an issued BL is an
-- amendment, not a draft.

create table if not exists public.bl_draft_inputs (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null default public.default_tenant_id() references public.tenants(id),
  booking_id        uuid not null references public.bookings(id) on delete cascade,
  requested_by_user uuid not null,
  status            text not null default 'Submitted' check (status in ('Submitted', 'Approved', 'Rejected')),
  inputs            jsonb not null,
  reject_reason     text,
  decided_by        text,
  decided_at        timestamptz,
  file_path         text,
  file_name         text,
  released_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists bl_draft_inputs_booking_idx on public.bl_draft_inputs (booking_id);

alter table public.bl_draft_inputs enable row level security;

drop policy if exists "portal raises bl_draft_inputs" on public.bl_draft_inputs;
create policy "portal raises bl_draft_inputs" on public.bl_draft_inputs for insert to authenticated
  with check (
    requested_by_user = auth.uid()
    and status = 'Submitted'
    and public.portal_kind() is not null
    and public.portal_can_see_booking(booking_id)
    and file_path is null
  );

drop policy if exists "portal reads own bl_draft_inputs" on public.bl_draft_inputs;
create policy "portal reads own bl_draft_inputs" on public.bl_draft_inputs for select to authenticated
  using (requested_by_user = auth.uid());

drop policy if exists "staff read bl_draft_inputs" on public.bl_draft_inputs;
create policy "staff read bl_draft_inputs" on public.bl_draft_inputs for select to authenticated
  using (tenant_id = public.auth_tenant_id() and public.is_staff());

-- A portal user cannot raise inputs on a booking whose BL is already issued.
create or replace function public.guard_bl_draft_inputs()
returns trigger
language plpgsql security definer set search_path to 'public'
as $fn$
begin
  if exists (select 1 from public.bls b
              where b.booking_id = new.booking_id and b.status in ('Issued', 'Released')) then
    raise exception 'A BL on this booking is already issued. Ask Kinetic for an amendment instead.'
      using errcode = 'restrict_violation';
  end if;
  return new;
end
$fn$;

drop trigger if exists bl_draft_inputs_guard on public.bl_draft_inputs;
create trigger bl_draft_inputs_guard
before insert on public.bl_draft_inputs
for each row execute function public.guard_bl_draft_inputs();

-- Staff decide. Approving applies the inputs to the booking.
create or replace function public.decide_bl_draft_inputs(p_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_row public.bl_draft_inputs%rowtype;
  v_in  jsonb;
  v_me  text;
  v_nos text[];
begin
  if not public.is_approver() then
    raise exception 'Only an Admin or an Approver can decide BL draft inputs.'
      using errcode = 'insufficient_privilege';
  end if;
  if not p_approve and coalesce(trim(p_reason), '') = '' then
    raise exception 'A rejection needs a reason, which the customer sees.' using errcode = 'restrict_violation';
  end if;

  select * into v_row from public.bl_draft_inputs
   where id = p_id and tenant_id = public.auth_tenant_id() for update;
  if not found then
    raise exception 'That submission does not exist.' using errcode = 'no_data_found';
  end if;
  if v_row.status <> 'Submitted' then
    raise exception 'That submission was already %.', lower(v_row.status) using errcode = 'restrict_violation';
  end if;

  select name into v_me from public.profiles where id = auth.uid();

  if p_approve then
    if exists (select 1 from public.bls b
                where b.booking_id = v_row.booking_id and b.status in ('Issued', 'Released')) then
      raise exception 'A BL on this booking is already issued, so these inputs cannot be applied.'
        using errcode = 'restrict_violation';
    end if;
    v_in := v_row.inputs;
    v_nos := case when nullif(trim(coalesce(v_in ->> 'containers', '')), '') is null then '{}'::text[]
                  else regexp_split_to_array(upper(trim(v_in ->> 'containers')), '[\s,;]+') end;

    update public.bookings
       set shipper          = coalesce(nullif(trim(v_in ->> 'shipper'), ''), shipper),
           consignee        = coalesce(nullif(trim(v_in ->> 'consignee'), ''), consignee),
           notify_party     = coalesce(nullif(trim(v_in ->> 'notifyParty'), ''), notify_party),
           cargo_description = coalesce(nullif(trim(v_in ->> 'cargoDescription'), ''), cargo_description),
           package_type     = coalesce(nullif(trim(v_in ->> 'packageType'), ''), package_type),
           packages         = coalesce(nullif(v_in ->> 'packages', '')::int, packages),
           gross_weight_kg  = coalesce(nullif(v_in ->> 'grossWeightKg', '')::numeric, gross_weight_kg),
           -- Container numbers go in through the list; the database folds them
           -- into the per-container table, the one place they live.
           container_nos    = case when array_length(v_nos, 1) > 0
                                   then (select array_agg(distinct x) from unnest(container_nos || v_nos) x)
                                   else container_nos end
     where id = v_row.booking_id;
  end if;

  update public.bl_draft_inputs
     set status = case when p_approve then 'Approved' else 'Rejected' end,
         reject_reason = case when p_approve then null else trim(p_reason) end,
         decided_by = coalesce(v_me, 'staff'), decided_at = now()
   where id = p_id;
end
$fn$;

-- Staff attach the draft BL PDF to an approved submission.
create or replace function public.attach_bl_draft_file(p_id uuid, p_path text, p_file_name text)
returns void
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_row public.bl_draft_inputs%rowtype;
begin
  if not public.is_staff() then
    raise exception 'Only staff can attach a draft BL.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_row from public.bl_draft_inputs
   where id = p_id and tenant_id = public.auth_tenant_id() for update;
  if not found then
    raise exception 'That submission does not exist.' using errcode = 'no_data_found';
  end if;
  if v_row.status <> 'Approved' then
    raise exception 'The submission is %; attach a draft once it is approved.', lower(v_row.status)
      using errcode = 'restrict_violation';
  end if;
  if (storage.foldername(p_path))[1] is distinct from v_row.booking_id::text then
    raise exception 'The file must be stored under this booking.' using errcode = 'restrict_violation';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'generated-documents' and name = p_path) then
    raise exception 'That file has not been uploaded.' using errcode = 'restrict_violation';
  end if;
  update public.bl_draft_inputs
     set file_path = p_path, file_name = nullif(trim(p_file_name), ''), released_at = now()
   where id = p_id;
end
$fn$;

-- Tell the person who submitted when it is decided or the draft is ready.
create or replace function public.notify_bl_draft_inputs()
returns trigger
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_ref text;
  v_msg text;
begin
  select booking_ref into v_ref from public.bookings where id = new.booking_id;
  if new.status is distinct from old.status then
    v_msg := case new.status
      when 'Approved' then 'was approved. Your draft BL will be shared once it is prepared.'
      when 'Rejected' then 'was rejected' || coalesce(': ' || new.reject_reason, '.')
      else null end;
  elsif new.file_path is not null and old.file_path is null then
    v_msg := 'Your draft BL is ready to download.';
  end if;
  if v_msg is not null then
    perform public.enqueue_notification(
      new.tenant_id, 'bl_draft.' || lower(new.status), new.requested_by_user,
      'Your BL draft for ' || coalesce(v_ref, 'your booking'),
      case when v_msg like 'Your%' then v_msg else 'Your BL draft inputs for ' || coalesce(v_ref, 'your booking') || ' ' || v_msg end,
      'bl_draft_inputs', new.id::text);
  end if;
  return new;
end
$fn$;

drop trigger if exists bl_draft_inputs_notify on public.bl_draft_inputs;
create trigger bl_draft_inputs_notify
after update on public.bl_draft_inputs
for each row execute function public.notify_bl_draft_inputs();
