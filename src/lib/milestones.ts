import type { BookingStatus, ChipStatus, Direction, MilestoneDef, MilestoneEntry } from './types'

/* ── Milestone sequences (Workflow v3 §6) ────────────────────────
   Status and cycle % are COMPUTED from these — never set by hand. */

export const EXPORT_MILESTONES: MilestoneDef[] = [
  { key: 'gate_open', label: 'Gate open' },
  { key: 'si_cutoff', label: 'SI cut-off' },
  { key: 'vgm_cutoff', label: 'VGM cut-off' },
  { key: 'cy_cutoff', label: 'CY cut-off' },
  { key: 'cro_released', label: 'CRO released' },
  { key: 'container_picked_up', label: 'Container picked up' },
  { key: 'form13_released', label: 'Form 13 released' },
  { key: 'gate_in', label: 'Containers gate-in' },
  { key: 'first_print_received', label: '1st print received' },
  { key: 'docs_checked', label: 'Docs checked vs BL draft' },
  { key: 'bl_draft_sent', label: 'BL draft sent' },
  { key: 'bl_draft_approved', label: 'BL draft approved' },
  { key: 'vessel_sailed', label: 'Vessel sailed' },
  { key: 'sob_sent', label: 'SOB sent' },
  { key: 'eta_destination', label: 'ETA destination' },
  { key: 'tdr_sent', label: 'TDR sent to POD agent' },
  { key: 'invoice_shared', label: 'Invoice shared' },
  { key: 'payment_received', label: 'Payment received' },
  { key: 'tax_invoice_sent', label: 'Tax invoice sent' },
  { key: 'original_bl_released', label: 'Original BL released' },
  { key: 'documents_received', label: 'Documents received' },
  { key: 'surrender_released', label: 'Surrender / seaway released' },
]

export const IMPORT_MILESTONES: MilestoneDef[] = [
  { key: 'prealert_can_received', label: 'Pre-alert / CAN received' },
  { key: 'igm_filing', label: 'IGM filing' },
  { key: 'job_order_cfs', label: 'Job order to CFS' },
  { key: 'igm_details_to_customer', label: 'IGM details to customer' },
  { key: 'invoice_to_customer', label: 'Invoice to customer' },
  { key: 'payment_confirmed', label: 'Payment confirmed' },
  { key: 'do_shared', label: 'Delivery Order shared' },
  { key: 'documents_received', label: 'Documents received' },
  { key: 'detention_end', label: 'Detention / free-time end tracked' },
]

export function milestoneDefs(direction: Direction): MilestoneDef[] {
  return direction === 'Export' ? EXPORT_MILESTONES : IMPORT_MILESTONES
}

export function cyclePct(direction: Direction, entries: MilestoneEntry[]): number {
  const defs = milestoneDefs(direction)
  const done = defs.filter((d) =>
    entries.some((e) => e.key === d.key && e.completedAt),
  ).length
  return Math.round((done / defs.length) * 100)
}

/* Status ladder: highest completed milestone with a mapping wins.
   (doc: "if sailed = true and delivered = false → status = Sailed") */
const EXPORT_STATUS_LADDER: [string, BookingStatus][] = [
  ['container_picked_up', 'Container allocated'],
  ['gate_in', 'Documentation'],
  ['bl_draft_sent', 'Awaiting BL approval'],
  ['bl_draft_approved', 'Ready to sail'],
  ['vessel_sailed', 'Sailed'],
  ['eta_destination', 'Arrived'],
  ['tdr_sent', 'Under clearance'],
  ['payment_received', 'Delivered'],
  ['tax_invoice_sent', 'Financial closure'],
  ['surrender_released', 'Closed'],
]

const IMPORT_STATUS_LADDER: [string, BookingStatus][] = [
  ['prealert_can_received', 'Arrived'],
  ['igm_filing', 'Under clearance'],
  ['payment_confirmed', 'Delivered'],
  ['do_shared', 'Financial closure'],
  ['documents_received', 'Closed'],
]

export function deriveStatus(
  direction: Direction,
  entries: MilestoneEntry[],
  cancelled: boolean,
): BookingStatus {
  if (cancelled) return 'Cancelled'
  const ladder = direction === 'Export' ? EXPORT_STATUS_LADDER : IMPORT_STATUS_LADDER
  let status: BookingStatus = 'Booked'
  for (const [key, s] of ladder) {
    if (entries.some((e) => e.key === key && e.completedAt)) status = s
  }
  return status
}

export function toChipStatus(status: BookingStatus): ChipStatus {
  switch (status) {
    case 'Booked':
    case 'Container allocated':
      return 'Booked'
    case 'Documentation':
      return 'Documentation'
    case 'Awaiting BL approval':
      return 'BL Draft'
    case 'Ready to sail':
    case 'Sailed':
    case 'Under clearance':
      return 'In Transit'
    case 'Arrived':
      return 'Arrived'
    case 'Delivered':
    case 'Financial closure':
    case 'Closed':
      return 'Delivered'
    case 'Cancelled':
      return 'Cancelled'
  }
}
