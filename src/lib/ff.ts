import type { BadgeTone } from '../components/ui/Badge'
import type { FfShipment, FfStage } from './types'

export const FF_STAGES: FfStage[] = [
  'Booking',
  'Carrier & Pickup',
  'Documentation',
  'Export & Transit',
  'Arrival & Delivery',
  'Financial Close',
  'Closed',
]

export const INCOTERMS = ['EXW', 'FOB', 'CIF', 'CFR', 'DAP', 'DDP', 'FCA', 'CPT'] as const

/** FF margin: single consolidated sell − sum of every vendor buy line.
    GP stays "Estimated" until every vendor bill has landed (flow 5). */
export function ffGp(s: FfShipment): { value: number; actual: boolean } {
  const allBilled = s.vendorLines.length > 0 && s.vendorLines.every((v) => v.billedAmount !== null)
  const cost = s.vendorLines.reduce(
    (a, v) => a + (v.billedAmount !== null ? v.billedAmount : v.buyAmount),
    0,
  )
  return { value: s.sellAmount - cost, actual: allBilled }
}

export function buyTotal(s: FfShipment): number {
  return s.vendorLines.reduce((a, v) => a + v.buyAmount, 0)
}

/** Vendor bill variance tolerance — flow 5 default 10% */
export function overTolerance(buy: number, billed: number): boolean {
  if (buy <= 0) return billed > 0
  return Math.abs((billed - buy) / buy) > 0.1
}

/** Demo credit limits per customer (Customer Master carries this in production) */
export const CREDIT_LIMIT_USD = 10000

/**
 * Operational status for a freight-forwarding shipment.
 *
 * It used to borrow the NVOCC list, which carries container-yard language:
 * "Back to Town" means an empty container returning to the yard and says
 * nothing at all about an air or road shipment (spec, RKS booking notes).
 */
export const FF_WORKFLOW_STATUSES = [
  'Booked',
  'In Progress',
  'On Hold',
  'Returned',
  'Cancelled',
] as const

export type FfWorkflowStatus = (typeof FF_WORKFLOW_STATUSES)[number]

export const FF_WORKFLOW_TONE: Record<FfWorkflowStatus, BadgeTone> = {
  Booked: 'success',
  'In Progress': 'info',
  'On Hold': 'attention',
  Returned: 'critical',
  Cancelled: 'danger',
}

/**
 * Progress through the lifecycle, as a percentage.
 *
 * Spec F14: a cancelled Freight shipment kept 17% while a cancelled NVOCC
 * booking dropped to 0, so the same event read two different ways depending
 * which module you were in. One rule for both -- a shipment that is not going
 * anywhere has made no progress.
 */
export function ffCyclePct(stage: FfStage, cancelled: boolean): number {
  if (cancelled) return 0
  const index = FF_STAGES.indexOf(stage)
  if (index < 0) return 0
  return Math.round((index / (FF_STAGES.length - 1)) * 100)
}
