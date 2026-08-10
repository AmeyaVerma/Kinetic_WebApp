-- Per-container marks for container activities. container_activities
-- (0005) stays the booking-level "is this activity done" row -- its
-- completed_at is now derived (set once every container in the booking
-- has a mark for that key) rather than set directly from a single
-- "Mark" click.

create table public.container_activity_marks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id() references public.tenants(id),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  key text not null,
  container_no text not null,
  completed_at timestamptz,
  marked_by text,
  created_at timestamptz not null default now(),
  unique (booking_id, key, container_no)
);

create index container_activity_marks_booking_idx on public.container_activity_marks (booking_id, key);

alter table public.container_activity_marks enable row level security;

create policy "read container_activity_marks" on public.container_activity_marks for select
using (tenant_id = public.auth_tenant_id() and public.can_read_nvocc());

create policy "write container_activity_marks" on public.container_activity_marks for all
using (tenant_id = public.auth_tenant_id() and public.can_write_nvocc())
with check (tenant_id = public.auth_tenant_id() and public.can_write_nvocc());

create trigger container_activity_marks_audit after insert or update or delete on public.container_activity_marks
for each row execute function public.audit_row_change();
