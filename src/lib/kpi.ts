import type {
  Approval,
  Booking,
  BlState,
  FfShipment,
  FleetContainer,
  MilestoneEntry,
  MnrJob,
} from './types'
import { deriveStatus } from './milestones'
import { docStatusOf } from './docStatus'

/**
 * Every KPI, defined exactly once (spec M6).
 *
 * The cards used to disagree with the rows beneath them, and each
 * disagreement had the same cause: the card and the table asked different
 * questions. BL Drafts read the milestone-derived status while the column
 * beside it read the BL's own lifecycle. Under Repair counted containers
 * flagged as such while Open Jobs counted jobs. Total GP added an estimate
 * to an actual and printed the result as one figure.
 *
 * So these functions return the *rows*, not a number. A card shows
 * `rows.length` and the table under it renders the same array, which makes
 * "every KPI card equals the row count under it" true by construction rather
 * than by vigilance.
 */

/* ── Bookings ─────────────────────────────────────────────────── */

/**
 * Bookings in the active company that are not void.
 *
 * Cancelled bookings stay counted: a cancellation is a real thing that
 * happened to a real booking, and the business still wants it in the total.
 * Void means the record should never have existed, which is why the two were
 * separated in the first place.
 */
export function totalBookings(bookings: Booking[]): Booking[] {
  return bookings.filter((b) => !b.voided)
}

/**
 * Sailed reached, Arrived not yet reached.
 *
 * Read off the same status ladder the table's Status column uses rather than
 * by poking at milestone keys here, so the two cannot drift. An import has no
 * sailing step of its own — it enters the ladder at Arrived — so nothing is
 * ever in transit on the import side, which is the truthful answer.
 */
export function inTransit(bookings: Booking[], milestones: MilestoneEntry[]): Booking[] {
  return bookings.filter((b) => {
    const mine = milestones.filter((m) => m.bookingId === b.id)
    return deriveStatus(b.direction, mine, b.cancelled) === 'Sailed'
  })
}

/**
 * Bookings whose BL is in Draft or Awaiting approval.
 *
 * This is the one M6 named outright: the card said 0 while twenty-odd rows
 * showed Draft. The card was reading the booking's milestone status, where
 * "BL Draft" is a narrow stage a booking passes through; the column was
 * reading the BL's own lifecycle, where Draft is where most BLs sit. The
 * BL's lifecycle is the honest answer, so both now use it.
 */
export function blDrafts(bookings: Booking[], blStates: BlState[]): Booking[] {
  return bookings.filter((b) => {
    const status = docStatusOf(blStates.find((x) => x.bookingId === b.id))
    return status === 'Draft' || status === 'Sent'
  })
}

export function byDirection(bookings: Booking[], direction: 'Export' | 'Import'): Booking[] {
  return bookings.filter((b) => b.direction === direction)
}

export function deliveredOrArrived(bookings: Booking[], milestones: MilestoneEntry[]): Booking[] {
  return bookings.filter((b) => {
    const mine = milestones.filter((m) => m.bookingId === b.id)
    const status = deriveStatus(b.direction, mine, b.cancelled)
    return status === 'Delivered' || status === 'Arrived' || status === 'Closed'
  })
}

/* ── Approvals ────────────────────────────────────────────────── */

/**
 * All pending approvals, repair estimates included.
 *
 * The MNR page used to count only `repair_estimate` rows and call it the
 * approval queue, so a repair waiting on an Admin showed as zero whenever
 * the request had been raised through any other route.
 */
export function pendingApprovals(approvals: Approval[]): Approval[] {
  return approvals.filter((a) => a.status === 'Pending')
}

export function pendingRepairApprovals(approvals: Approval[]): Approval[] {
  return pendingApprovals(approvals).filter((a) => a.entityType === 'repair_estimate')
}

/* ── Fleet and repairs ────────────────────────────────────────── */

/** A repair job that has not been closed. */
export function openRepairJobs(jobs: MnrJob[]): MnrJob[] {
  return jobs.filter((j) => j.stage !== 'Closed')
}

/**
 * Containers with an open repair job.
 *
 * Not containers whose status field says 'Under Repair'. Those two numbers
 * drifted apart (5 against 3) because the status is set by hand and the job
 * is the actual work, and the spec settles it in favour of the job.
 */
export function containersUnderRepair(
  fleet: FleetContainer[],
  jobs: MnrJob[],
): FleetContainer[] {
  const busy = new Set(openRepairJobs(jobs).map((j) => j.containerId))
  return fleet.filter((f) => busy.has(f.id))
}

export function containersAvailable(fleet: FleetContainer[], jobs: MnrJob[]): FleetContainer[] {
  const busy = new Set(openRepairJobs(jobs).map((j) => j.containerId))
  return fleet.filter((f) => f.status === 'Available' && !busy.has(f.id))
}

/* ── Gross profit ─────────────────────────────────────────────── */

/**
 * Sell minus cost, kept apart.
 *
 * A shipment whose vendor bills have all arrived has an actual GP; one still
 * carrying quoted buy figures has an estimate. Adding the two produced the
 * "$-50 against roughly $2,150" the spec caught — a single number that was
 * true of neither set. The spec's instruction is blunt: never one number.
 */
export interface GpSplit {
  estimated: number
  actual: number
  estimatedCount: number
  actualCount: number
}

export function gpSplit(shipments: FfShipment[]): GpSplit {
  const split: GpSplit = { estimated: 0, actual: 0, estimatedCount: 0, actualCount: 0 }
  for (const s of shipments) {
    const allBilled = s.vendorLines.length > 0 && s.vendorLines.every((v) => v.billedAmount !== null)
    const cost = s.vendorLines.reduce(
      (a, v) => a + (v.billedAmount !== null ? v.billedAmount : v.buyAmount),
      0,
    )
    const gp = s.sellAmount - cost
    if (allBilled) {
      split.actual += gp
      split.actualCount += 1
    } else {
      split.estimated += gp
      split.estimatedCount += 1
    }
  }
  return split
}
