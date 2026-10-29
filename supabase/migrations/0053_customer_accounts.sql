-- Spec M3: "One Parties master with role flags and a customer-account
-- extension."
--
-- There were two customer lists that disagreed: Parties (230 rows, PTY codes,
-- the legal identity of a firm) and a separate Customers screen (8 rows, CUST
-- codes, the commercial relationship). A firm appeared in one and not the
-- other, and nothing reconciled them.
--
-- A firm is one record -- the party. What differs per company is the
-- commercial relationship with it: Kinetic may give a customer a credit limit
-- that RKS does not, and the spec's separation rules require exactly that
-- ("credit limit and terms are set per company"). So the relationship lives
-- here, one row per party per company, and the identity stays in parties.
--
-- A party with no row here is simply a customer nobody has agreed terms with
-- yet. That is the normal state for 230 of them, and the UI reads the
-- defaults below rather than treating it as missing data.

create table if not exists public.customer_accounts (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null default default_tenant_id() references public.tenants(id) on delete cascade,
  party_id            uuid not null references public.parties(id) on delete cascade,

  status              text not null default 'Active'
                      check (status in ('Prospect','Active','On Hold','Inactive','Blacklisted')),
  industry            text,
  sales_owner         text,
  cs_rep              text,
  source              text,

  -- Commercial terms. Siddharth: "Can be set manually, 0 by default."
  -- Zero means no limit has been agreed, not a limit of nothing, so it does
  -- not block a booking on its own -- cash_in_advance_only is the control
  -- that does.
  default_incoterm    text,
  payment_terms       text,
  credit_limit        numeric(14,2) not null default 0,
  credit_currency     text not null default 'USD' check (credit_currency in ('USD','INR')),
  credit_hold_policy  text not null default 'Hard-block' check (credit_hold_policy in ('Hard-block','Soft-warn')),
  discount_pct        numeric(5,2) not null default 0,
  invoicing_currency  text not null default 'USD' check (invoicing_currency in ('USD','INR')),
  cash_in_advance_only boolean not null default false,
  pending_credit_request numeric(14,2),
  blacklist_reason    text,

  -- Portal access, per company: a customer of both gets a separate login for
  -- each, so this cannot live on the party.
  portal_enabled      boolean not null default false,
  vis_nvocc           boolean not null default true,
  vis_ff              boolean not null default true,
  booking_creation    boolean not null default false,
  quote_request       boolean not null default false,
  bl_edit_permission  text not null default 'Can request edits'
                      check (bl_edit_permission in ('None','Can request edits','Cannot view drafts')),
  doc_download        text not null default 'All' check (doc_download in ('All','Invoice','BL','None')),
  mfa_mandated        boolean not null default false,

  screening           text not null default 'Clear' check (screening in ('Clear','Flagged','Under Review')),
  credit_approved     boolean not null default false,
  sales_signoff       boolean not null default false,
  notes               text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, party_id)
);

create index if not exists customer_accounts_party_idx on public.customer_accounts (party_id);

alter table public.customer_accounts enable row level security;

create policy "read customer_accounts" on public.customer_accounts
  for select using (tenant_id = auth_tenant_id());

create policy "write customer_accounts" on public.customer_accounts
  for all using (tenant_id = auth_tenant_id() and can_write_masters())
  with check (tenant_id = auth_tenant_id() and can_write_masters());
