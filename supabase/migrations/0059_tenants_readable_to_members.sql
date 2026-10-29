-- "Users can view own tenant" allowed reading only the company currently
-- active, which makes a chooser impossible: the company you want to switch
-- INTO is by definition not the active one, so it came back invisible and
-- the menu showed a single company.
--
-- A member may see the name of any company they belong to. That is the whole
-- extent of it -- the company's data stays behind every other table's policy,
-- which still keys on auth_tenant_id().

drop policy if exists "Users can view own tenant" on public.tenants;

create policy "Members can view their companies" on public.tenants
  for select using (public.is_member_of(id) or id = public.auth_tenant_id());
