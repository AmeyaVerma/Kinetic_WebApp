-- Accountability trail: who changed what, and when, across every NVOCC
-- table. One shared audit_log table + one generic trigger function,
-- attached to all 10 tables from 0005 — not copy-pasted per table.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id uuid,
  actor_role text,
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);

create index if not exists audit_log_lookup on public.audit_log (tenant_id, table_name, record_id);
create index if not exists audit_log_recent on public.audit_log (tenant_id, changed_at desc);

alter table public.audit_log enable row level security;

-- Oversight trail — Admin-only for now (broaden later if e.g. Finance
-- should see charge-history on their own bookings).
drop policy if exists "Admins can view audit log" on public.audit_log;
create policy "Admins can view audit log"
  on public.audit_log for select
  using (public.is_admin() and tenant_id = public.auth_tenant_id());
-- No write policy: rows are only ever inserted by the trigger below
-- (security definer), never directly by a client.

-- Generic trigger fn. Uses to_jsonb(...)->>'id' / 'booking_id' rather than
-- NEW.id directly, because this same function is shared across tables
-- that don't all have an `id` column (bl_state's key is booking_id).
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  rec_id uuid;
begin
  rec_id := coalesce(
    (to_jsonb(new) ->> 'id')::uuid,
    (to_jsonb(old) ->> 'id')::uuid,
    (to_jsonb(new) ->> 'booking_id')::uuid,
    (to_jsonb(old) ->> 'booking_id')::uuid
  );

  insert into public.audit_log (tenant_id, table_name, record_id, action, actor_id, actor_role, old_data, new_data)
  values (
    coalesce((to_jsonb(new) ->> 'tenant_id')::uuid, (to_jsonb(old) ->> 'tenant_id')::uuid),
    TG_TABLE_NAME,
    rec_id,
    TG_OP,
    auth.uid(),
    public.auth_role(),
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'bookings', 'booking_milestones', 'booking_charges', 'bl_versions',
    'bl_state', 'container_activities', 'booking_documents',
    'cro_documents', 'leads', 'quotes'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
       for each row execute function public.audit_row_change()',
      t || '_audit', t
    );
  end loop;
end $$;
