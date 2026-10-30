-- Two things, both about who may read what.
--
-- 1. The invoices policy had no role check -- `tenant_id = auth_tenant_id()`
--    and nothing else. Every other operational table gates on a role; this
--    one did not, so any authenticated user with a profile in the company
--    could read every invoice in it, other customers' included. Nobody has
--    exploited it because no portal account exists yet, which is precisely
--    why it should be closed before the first one does.
--
-- 2. The portal needs more than the booking row: tracking needs milestones
--    and container activities, the documents list needs booking_documents,
--    and a statement of account needs that customer's own invoices. Each is
--    scoped the same way -- through the booking the portal user is already
--    allowed to see -- so there is one rule, not five.

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.auth_role() in ('admin', 'ops', 'finance', 'sales', 'mnr', 'hr')
$$;

-- A booking this user is allowed to see. Written once and reused, so a
-- portal user can never reach a child row whose parent booking they could
-- not have opened.
create or replace function public.portal_can_see_booking(b_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
      from public.bookings b
     where b.id = b_id
       and b.tenant_id = public.auth_tenant_id()
       and (
         (public.portal_kind() = 'customer'
            and b.booking_party_id = public.portal_party_id()::text)
         or (public.portal_kind() = 'agent'
            and (b.origin_agent_id = public.portal_party_id()::text
                 or b.destination_agent_id = public.portal_party_id()::text))
       )
  )
$$;

-- Invoices: staff, or the portal user's own.
drop policy if exists "read invoices" on public.invoices;
create policy "read invoices" on public.invoices
  for select using (
    tenant_id = auth_tenant_id()
    and (
      is_staff()
      -- A customer sees invoices raised to them. An agent does not: an
      -- agent handles the shipment, they are not the billed party, and the
      -- spec gives agents a statement of account of their own rather than
      -- the customer's invoices.
      or (portal_kind() = 'customer' and party_id = portal_party_id())
    )
  );

drop policy if exists "write invoices" on public.invoices;
create policy "write invoices" on public.invoices
  for all using (tenant_id = auth_tenant_id() and is_staff())
  with check (tenant_id = auth_tenant_id() and is_staff());

-- Child rows of a booking the portal user may already read.
create policy "portal reads its booking milestones" on public.booking_milestones
  for select using (portal_can_see_booking(booking_id));

create policy "portal reads its container activities" on public.container_activities
  for select using (portal_can_see_booking(booking_id));

create policy "portal reads its booking documents" on public.booking_documents
  for select using (portal_can_see_booking(booking_id));

create policy "portal reads its bl state" on public.bl_state
  for select using (portal_can_see_booking(booking_id));
