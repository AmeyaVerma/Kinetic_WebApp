-- Phase 6 hardening.
--
-- 1. Pin search_path on the functions added in this work. A mutable
--    search_path lets a caller shadow a referenced object with one in a
--    schema earlier on their path.
alter function public.fy_code(timestamptz) set search_path = public, pg_temp;
alter function public.sync_bl_release_type() set search_path = public, pg_temp;

-- 2. Trigger functions are invoked by the trigger, never by a client, and
--    run as the trigger owner -- so removing the REST/RPC route costs
--    nothing and closes three endpoints.
revoke execute on function public.audit_row_change() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_bl_release_type() from public, anon, authenticated;

-- 3. BL numbers must not be allocatable by an anonymous caller: each call
--    burns a sequence value, so an unauthenticated loop could run the
--    financial year's numbering away. Signed-in ops/admin still need it.
--
--    NOTE: the can_read_*/can_write_*/auth_*/is_admin helpers are
--    deliberately NOT revoked. They are called inside RLS policy
--    expressions, which Postgres evaluates with the querying role's
--    privileges -- revoking EXECUTE would make every policy that calls them
--    error instead of filtering. The advisor flags them, but acting on it
--    would break row-level security rather than tighten it.
revoke execute on function public.next_document_number(text, text) from public, anon;
grant execute on function public.next_document_number(text, text) to authenticated;
