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
