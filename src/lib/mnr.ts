import type { ChecklistItem, MnrEstimate, MnrJob } from './types'

/* ── Approval Matrix (Requirements §4.E) ─────────────────────────
   Value band × structural × ownership drives who must sign off. */

export function approverBand(total: number): string {
  if (total < 300) return 'System auto-approval'
  if (total <= 1500) return 'Depot Supervisor'
  if (total <= 5000) return 'MNR Manager'
  return 'Regional Head + Finance (dual sign-off)'
}

export function approvalRequirements(job: MnrJob, total: number, leased: boolean): string[] {
  const reqs = [approverBand(total)]
  if (job.engineeringRequired) reqs.push('Engineering sign-off (structural — cannot be bypassed)')
  if (leased) reqs.push('Lessor notification (48-hr response SLA)')
  return reqs
}

/* Structural checklist from Requirements §4.B */
export const INSPECTION_CHECKLIST: Omit<ChecklistItem, 'pass'>[] = [
  { key: 'roof', label: 'Roof' },
  { key: 'floor', label: 'Floor' },
  { key: 'side_walls', label: 'Side walls' },
  { key: 'doors', label: 'Doors' },
  { key: 'understructure', label: 'Understructure' },
  { key: 'corner_castings', label: 'Corner castings' },
]

export const CONTAINER_PANELS = [
  'Front panel',
  'Rear panel',
  'Left side',
  'Right side',
  'Roof',
  'Floor',
  'Doors',
  'Corner castings',
] as const

/* IICL-style demo damage codes (Damage Code Master §2.5) */
export const DAMAGE_CODES = [
  { code: 'DT', label: 'Dent' },
  { code: 'CU', label: 'Cut / puncture' },
  { code: 'BR', label: 'Broken component' },
  { code: 'CO', label: 'Corrosion' },
  { code: 'BW', label: 'Bowed / warped' },
  { code: 'GC', label: 'Gasket / seal damage' },
] as const

export function latestEstimate(job: MnrJob): MnrEstimate | null {
  return job.estimates.length ? job.estimates[job.estimates.length - 1] : null
}

/** Total-loss check — default threshold 70% of insured value (§4.K) */
export function isTotalLossCandidate(total: number, insuredValue: number): boolean {
  return insuredValue > 0 && total >= insuredValue * 0.7
}

export const MNR_STAGES: MnrJob['stage'][] = [
  'Initial Inspection',
  'Damage Survey',
  'Estimate',
  'Approval',
  'Repair Execution',
  'Quality Control',
  'Finance Posting',
  'Closed',
]
