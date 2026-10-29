-- The "Users can update own profile" policy is UPDATE with
-- USING (auth.uid() = id) and NO WITH CHECK. Postgres then reuses USING as
-- the check, which only pins the row's id -- it says nothing about the other
-- columns. So any signed-in user could set their own `role` to 'admin', and
-- auth_role() / is_admin() read exactly that column.
--
-- RLS cannot express "this column may not change" (WITH CHECK sees only the
-- new row, never the old), so the rule is a trigger instead.
--
-- Superseded in 0058, which adds the server-context exemption.

create trigger profiles_guard_self_update
before update on public.profiles
for each row execute function public.guard_profile_self_update();
