/* ── Manual booking status (Workflow v3 §9) ──────────────────────
   The selectable operational status, kept as config (not hardcoded in
   components) so a future tenant can relabel/extend the set without a
   code change — same intent as the RBAC matrix. Distinct from the
   milestone-computed lifecycle status in lib/milestones.ts.          */

import type { BadgeTone } from '../components/ui/Badge'
import type { Booking, BookingWorkflowStatus } from './types'

export const BOOKING_WORKFLOW_STATUSES: BookingWorkflowStatus[] = [
  'Booked',
  'In Progress',
  'Cancelled',
  'Back to Town',
  'Hold',
]

/** The colour each manual status wears. The badge shows the status's own
    word -- "Back to Town" used to be displayed as "Overdue" because it
    borrowed that chip to get the colour. */
export const WORKFLOW_STATUS_TONE: Record<BookingWorkflowStatus, BadgeTone> = {
  Booked: 'success',
  'In Progress': 'info',
  Cancelled: 'danger',
  'Back to Town': 'critical',
  Hold: 'attention',
}

/** Effective status for a booking — respects the manual field, falls back for
    legacy/seed records that predate it (cancelled ⇒ Cancelled, else Booked). */
export function workflowStatusOf(b: Booking): BookingWorkflowStatus {
  if (b.workflowStatus) return b.workflowStatus
  return b.cancelled ? 'Cancelled' : 'Booked'
}
