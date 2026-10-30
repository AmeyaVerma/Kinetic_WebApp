-- A raised invoice saved its header and NONE of its lines.
--
-- invoice_lines has no tenant_id -- it is scoped through its invoice -- but
-- 0064 put the generic audit trigger on it, and that trigger reads tenant_id
-- off the row to write into audit_log.tenant_id, which is NOT NULL. So every
-- line insert failed with 23502 while the header, on a table that does have
-- the column, succeeded. The result was an invoice with a number, a total and
-- no lines: worse than no invoice at all, because it looks complete.
--
-- Two fixes, because either alone leaves the trap set:
--
-- 1. invoice_lines gets a tenant_id like every other table, so it is
--    consistent and the trigger has something to read.
-- 2. The trigger stops depending on the row having one. Any future child
--    table would hit exactly this, and failing a write because the AUDIT of
--    it cannot be recorded is a bad trade -- but writing an unattributed
--    audit row is worse, so it falls back to the session's company and only
--    then to the default.

alter table public.invoice_lines
  add column if not exists tenant_id uuid not null default default_tenant_id()
  references public.tenants(id) on delete cascade;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  rec_id uuid;
  ten_id uuid;
begin
  rec_id := coalesce(
    (to_jsonb(new) ->> 'id')::uuid,
    (to_jsonb(old) ->> 'id')::uuid,
    (to_jsonb(new) ->> 'booking_id')::uuid,
    (to_jsonb(old) ->> 'booking_id')::uuid
  );

  -- A child table carries no tenant of its own; fall back to the session's
  -- company rather than failing the write it is meant to be recording.
  ten_id := coalesce(
    (to_jsonb(new) ->> 'tenant_id')::uuid,
    (to_jsonb(old) ->> 'tenant_id')::uuid,
    public.auth_tenant_id(),
    public.default_tenant_id()
  );

  insert into public.audit_log (tenant_id, table_name, record_id, action, actor_id, actor_role, old_data, new_data)
  values (
    ten_id, TG_TABLE_NAME, rec_id, TG_OP, auth.uid(), public.auth_role(),
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$function$;
