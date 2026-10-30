import { supabase } from '../lib/supabaseClient'
import type { Approval } from '../lib/types'

/**
 * Keeping the approvals queue in the database.
 *
 * Approvals are raised from nineteen different places in the store -- initial
 * costing, a BL edit, a credit hold, a non-admin field change, a leave
 * request -- each building the object inline inside a `set`. Persisting them
 * by editing all nineteen would mean nineteen chances to forget, and the
 * twentieth would be written by someone who never saw this file.
 *
 * So the store is watched instead, in one place: anything that appears in
 * `approvals`, or whose status changes, is mirrored to Postgres. A future
 * creation site is covered without knowing this exists.
 *
 * Writes are deliberately fire-and-forget. The queue has already updated on
 * screen by the time this runs, and a failed sync must not throw inside a
 * store subscriber -- it is logged, and the next fetch reconciles.
 */

/** Rows already known to the database, so a re-render does not re-insert. */
const synced = new Map<string, string>()

/** Seeds the map after a fetch, so fetched rows are not written straight back. */
export function markSynced(approvals: Approval[]) {
  for (const a of approvals) synced.set(a.id, a.status)
}

export function forgetSynced() {
  synced.clear()
}

function toRow(a: Approval, bookingDbId: string | null) {
  return {
    id: a.id,
    entity_type: a.entityType,
    entity_id: a.entityId,
    booking_id: bookingDbId,
    entity_ref: a.bookingId,
    summary: a.summary,
    requested_by: a.requestedBy,
    requested_at: a.requestedAt,
    status: a.status,
    decided_by: a.decidedBy ?? null,
    payload: a.payload ?? null,
    field_change: a.fieldChange ?? null,
    charge_payload: a.chargePayload ?? null,
  }
}

/**
 * Mirrors one pass of the queue.
 *
 * `resolveBookingDbId` is passed in rather than imported: the store owns the
 * mapping from a booking ref to its database id, and reaching back into the
 * store from here would be a cycle.
 */
export function syncApprovals(
  approvals: Approval[],
  resolveBookingDbId: (bookingId: string | null) => string | null,
) {
  const pending: PromiseLike<unknown>[] = []

  for (const a of approvals) {
    const known = synced.get(a.id)

    if (known === undefined) {
      // An id generated in the browser is kept as the row's primary key, so
      // the queue on screen and the row in the database are the same thing
      // even before the write lands. upsert rather than insert because a
      // fetch may have raced ahead of this.
      if (!isUuid(a.id)) {
        // Older in-memory ids ("ap-3k2") are not uuids and cannot be the
        // primary key. Those rows pre-date persistence; they are left alone
        // rather than given a new identity the UI would not recognise.
        continue
      }
      synced.set(a.id, a.status)
      pending.push(
        supabase
          .from('approvals')
          .upsert(toRow(a, resolveBookingDbId(a.bookingId)), { onConflict: 'id' })
          .then(({ error }) => {
            if (error) {
              synced.delete(a.id)
              console.error('approvals: could not save', error.message)
            }
          }),
      )
      continue
    }

    if (known !== a.status) {
      synced.set(a.id, a.status)
      pending.push(
        supabase
          .from('approvals')
          .update({
            status: a.status,
            decided_by: a.decidedBy ?? null,
            decided_at: new Date().toISOString(),
          })
          .eq('id', a.id)
          .then(({ error }) => {
            if (error) console.error('approvals: could not update status', error.message)
          }),
      )
    }
  }

  return Promise.all(pending)
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToApproval(row: any): Approval {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    bookingId: row.entity_ref ?? null,
    summary: row.summary,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    status: row.status,
    decidedBy: row.decided_by ?? undefined,
    payload: row.payload ?? undefined,
    fieldChange: row.field_change ?? undefined,
    chargePayload: row.charge_payload ?? undefined,
  }
}
