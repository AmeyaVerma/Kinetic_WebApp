-- A customer sees an invoice only once staff have published it.
--
-- The portal policy matched on party alone, so "Publish to portal" did nothing:
-- every invoice raised to a customer, including a draft record staff had only
-- just entered, was already visible to them. Found by signing in as a real
-- customer, which the database-level tests had not covered because they never
-- tried an unpublished invoice.
--
-- Staff still see everything. Document release is unaffected: its gates read
-- the invoices through security-definer functions.

drop policy if exists "read invoices" on public.invoices;
create policy "read invoices" on public.invoices for select
  using (
    tenant_id = public.auth_tenant_id()
    and (
      public.is_staff()
      or (
        public.portal_kind() = 'customer'
        and party_id = public.portal_party_id()
        and published_to_portal
      )
    )
  );
