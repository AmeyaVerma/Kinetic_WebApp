-- The portal-download Edge Function records each link it hands out, so "who
-- downloaded this document and when" has an answer. audit_log.action is
-- constrained to a fixed list (see 0083); this adds the new event to it.

alter table public.audit_log drop constraint if exists audit_log_action_check;

alter table public.audit_log add constraint audit_log_action_check
  check (action in (
    'INSERT', 'UPDATE', 'DELETE',
    'BL_SIGNED', 'SIGNING_PIN_SET', 'SIGNING_PIN_FAILED', 'SIGNING_LOCKED_OUT',
    'DOCUMENT_DOWNLOADED'
  ));
