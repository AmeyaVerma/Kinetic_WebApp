-- The document fee table (spec v2).
--
-- v2: "A fee for each document type (scan copy, surrender, original, delivery
-- order and so on) is kept in Master Data. Staff can change a price, but the
-- change takes effect only after Admin approval, and each change records the
-- old and new price. The fee is used when a document invoice is created."
--
-- NO PRICES ARE INVENTED. Siddharth has not given any, and the user's
-- instruction is that anywhere a price is unknown it reads "Test Data". A
-- placeholder number would be worse than none, because the whole point of
-- this table is that a document invoice is raised from it -- a made-up figure
-- would eventually be charged to a real customer.
--
-- So `amount` is NULL and `status` is 'Test data' on every row, and the guard
-- below makes it impossible for a placeholder to become a charge: raising a
-- document invoice against a fee that is still 'Test data' is refused by the
-- database, not merely discouraged in the UI.
--
-- The old and new price on every change come from the existing audit trigger,
-- which already records old_data and new_data per row, so no separate history
-- table is needed.

create table if not exists public.document_fees (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null default default_tenant_id() references public.tenants(id) on delete cascade,

  -- Matches the documents the app actually issues, plus the portal-requestable
  -- ones v2 names.
  doc_type   text not null,
  label      text not null,

  amount     numeric,
  currency   text not null default 'INR',

  -- 'Test data' means nobody has set a price. It is not a default price.
  status     text not null default 'Test data'
             check (status in ('Test data', 'Set', 'Free')),

  notes      text,
  updated_at timestamptz not null default now(),
  updated_by text,

  unique (tenant_id, doc_type)
);

alter table public.document_fees enable row level security;

create policy "read document_fees" on public.document_fees
  for select using (tenant_id = auth_tenant_id());
-- Staff may propose a change; v2 routes it through Admin approval, which is
-- the app's job. The database restricts writing to those who may write
-- masters at all.
create policy "write document_fees" on public.document_fees
  for all using (tenant_id = auth_tenant_id() and can_write_masters())
  with check (tenant_id = auth_tenant_id() and can_write_masters());

create trigger document_fees_audit
after insert or update or delete on public.document_fees
for each row execute function public.audit_row_change();

-- Keep updated_at honest without the app having to remember.
create or replace function public.touch_document_fee()
returns trigger language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end
$fn$;

create trigger document_fees_touch
before update on public.document_fees
for each row execute function public.touch_document_fee();

-- A placeholder can never become a charge.
-- Returns the fee only when somebody has actually set one. Anything that
-- raises a document invoice calls this and gets a refusal, with the reason,
-- rather than a zero or a guess.
create or replace function public.document_fee_for(p_doc_type text)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_row public.document_fees%rowtype;
begin
  select * into v_row
    from public.document_fees
   where tenant_id = public.auth_tenant_id()
     and doc_type = p_doc_type;

  if not found then
    raise exception 'No fee is configured for document type %.', p_doc_type
      using errcode = 'no_data_found';
  end if;

  if v_row.status = 'Test data' then
    raise exception
      'The fee for % has not been set yet (it reads "Test Data"), so no invoice can be raised for it.',
      v_row.label
      using errcode = 'restrict_violation';
  end if;

  if v_row.status = 'Free' then
    return 0;
  end if;

  return v_row.amount;
end
$fn$;

-- The document types, with no prices. Every row says Test data.
insert into public.document_fees (doc_type, label, notes)
values
  ('obl_scan',    'OBL scan copy',        'Black and white scan copy. Portal-requestable.'),
  ('surrender',   'Surrender BL',         'Surrender stamp and signature together. Issued by Kinetic, never from the portal.'),
  ('obl_original','OBL original copy',    'Signature only. Portal-requestable.'),
  ('cro',         'Container Release Order', 'Issued from the empty pickup depot.'),
  ('do',          'Delivery Order',       'Import only, after cargo arrival and payment.'),
  ('can',         'Cargo Arrival Notice', 'Import only, on vessel arrival.'),
  ('onboard',     'Onboard Confirmation', null),
  ('offloading',  'Off Loading Letter',   null),
  ('other',       'Other document',       'Anything requested that is not listed.')
on conflict (tenant_id, doc_type) do nothing;
