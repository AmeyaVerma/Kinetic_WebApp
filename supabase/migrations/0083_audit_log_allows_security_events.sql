-- The signing audit trail has never recorded anything.
--
-- audit_log.action was constrained to INSERT, UPDATE and DELETE -- the three
-- a row trigger writes. The sign-document Edge Function also writes four
-- security events of its own: BL_SIGNED, SIGNING_PIN_SET, SIGNING_PIN_FAILED
-- and SIGNING_LOCKED_OUT. Every one of them violated the constraint, and the
-- function did not check the insert's error, so each failed in silence.
--
-- The effect: no signature was ever logged, and neither was any failed PIN
-- attempt or lockout. The spec requires that every signature be logged with
-- the signer's name, and the function was written to do exactly that -- the
-- constraint threw the rows away before they landed.
--
-- Found by signing a real Surrender BL and then looking for the audit row.
-- The UI said "Signed", the PDF came back correctly composited, and nothing
-- was written. Nothing about the success path reveals this; only asking the
-- database does. The function now checks the error and refuses to return a
-- signed document it could not record.

alter table public.audit_log drop constraint if exists audit_log_action_check;

alter table public.audit_log add constraint audit_log_action_check
  check (action in (
    -- written by the audit_row_change() row trigger
    'INSERT', 'UPDATE', 'DELETE',
    -- written explicitly by the sign-document Edge Function, which cannot
    -- use a row trigger because a trigger on signing_pins would copy the
    -- PIN hash into a table admins can read
    'BL_SIGNED', 'SIGNING_PIN_SET', 'SIGNING_PIN_FAILED', 'SIGNING_LOCKED_OUT'
  ));
