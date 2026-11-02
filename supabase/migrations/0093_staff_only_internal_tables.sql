-- Internal tables were readable by anyone in the company, portal users included.
--
-- Found by running the H12 isolation test as a REAL portal session (RLS
-- applied, role 'customer') rather than evaluating a predicate by hand. The
-- bookings, milestones and invoices checks held. These did not:
--
--   parties            235 visible -- every other customer's name, address, GSTIN
--   approvals            4 visible -- the internal queue, and its WRITE policy
--                        too: a portal user could have approved their own request
--
-- and the policy audit behind it found the same shape on more tables. Each
-- policy said only "tenant_id = auth_tenant_id()": it checked which COMPANY you
-- are in and never WHAT you are in it. That is the same fault migration 0075
-- closed on invoices; closing it on one table at a time is how it kept
-- recurring. Nothing exploited it -- no portal account existed -- which is
-- exactly why it is worth closing before the first one does.
--
-- Gated to staff here:
--   approvals, customer_accounts (credit limits and terms), party_documents
--   (every customer's KYC), party_authorized_persons, party_branches,
--   document_sequences, document_fees (pricing), hs_product_pairs,
--   company_settings (bank details, artwork paths), containers (the fleet),
--   empty_depots, surveyors, chas, invoice_lines.
--
-- Deliberately LEFT readable: ports, terminals, ICDs, air ports, vessels,
-- voyages, currencies, units, package types, container types. That is plain
-- reference data a portal booking form legitimately needs, and none of it
-- identifies another customer.
--
-- parties gets one exception: a portal user can read THEIR OWN party row,
-- because the portal shows who they speak for.

do $loop$
declare t text;
begin
  foreach t in array array[
    'customer_accounts','party_documents','party_authorized_persons','party_branches',
    'document_sequences','document_fees','hs_product_pairs','company_settings',
    'containers','empty_depots','surveyors','chas'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'read ' || t, t);
    execute format(
      'create policy %I on public.%I for select using (tenant_id = auth_tenant_id() and is_staff())',
      'staff read ' || t, t);
  end loop;
end $loop$;

-- company_settings and document_sequences were named differently.
drop policy if exists "read company settings" on public.company_settings;
drop policy if exists "read document sequences" on public.document_sequences;

drop policy if exists "read parties" on public.parties;
create policy "staff read parties" on public.parties
  for select using (tenant_id = auth_tenant_id() and is_staff());
create policy "portal reads its own party" on public.parties
  for select using (id = portal_party_id());

-- approvals: read AND write.
drop policy if exists "read approvals"  on public.approvals;
drop policy if exists "write approvals" on public.approvals;
create policy "staff read approvals" on public.approvals
  for select using (tenant_id = auth_tenant_id() and is_staff());
create policy "staff write approvals" on public.approvals
  for all using (tenant_id = auth_tenant_id() and is_staff())
  with check (tenant_id = auth_tenant_id() and is_staff());

-- invoice_lines: staff, or the lines of an invoice the portal user may read.
drop policy if exists "read invoice_lines"  on public.invoice_lines;
drop policy if exists "write invoice_lines" on public.invoice_lines;
create policy "read invoice_lines" on public.invoice_lines
  for select using (
    exists (
      select 1 from public.invoices i
       where i.id = invoice_lines.invoice_id
         and i.tenant_id = auth_tenant_id()
         and (is_staff() or (portal_kind() = 'customer' and i.party_id = portal_party_id()))
    )
  );
create policy "write invoice_lines" on public.invoice_lines
  for all using (
    is_staff() and exists (
      select 1 from public.invoices i
       where i.id = invoice_lines.invoice_id and i.tenant_id = auth_tenant_id()
    )
  ) with check (
    is_staff() and exists (
      select 1 from public.invoices i
       where i.id = invoice_lines.invoice_id and i.tenant_id = auth_tenant_id()
    )
  );
