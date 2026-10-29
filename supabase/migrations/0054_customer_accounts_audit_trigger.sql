-- A credit limit, a blacklisting or a portal permission changing is exactly
-- the kind of thing the audit trail exists for, and every other master
-- carries this trigger already.

create trigger customer_accounts_audit
after insert or update or delete on public.customer_accounts
for each row execute function public.audit_row_change();
