/* ── Manual booking status (Workflow v3 §9) ──────────────────────
   The selectable operational status, kept as config (not hardcoded in
   components) so a future tenant can relabel/extend the set without a
   code change — same intent as the RBAC matrix. Distinct from the
   milestone-computed lifecycle status in lib/milestones.ts.          */

import type { Booking, BookingWorkflowStatus, ChipStatus } from './types'

export const BOOKING_WORKFLOW_STATUSES: BookingWorkflowStatus[] = [
  'Booked',
  'In Progress',
  'Cancelled',
  'Back to Town',
  'Hold',
]

/** Map each manual status onto the shared chip palette for colour. */
export const WORKFLOW_STATUS_CHIP: Record<BookingWorkflowStatus, ChipStatus> = {
  Booked: 'Booked',
  'In Progress': 'In Transit',
  Cancelled: 'Cancelled',
  'Back to Town': 'Overdue',
  Hold: 'Pending',
}

/** Effective status for a booking — respects the manual field, falls back for
    legacy/seed records that predate it (cancelled ⇒ Cancelled, else Booked). */
export function workflowStatusOf(b: Booking): BookingWorkflowStatus {
  if (b.workflowStatus) return b.workflowStatus
  return b.cancelled ? 'Cancelled' : 'Booked'
}
