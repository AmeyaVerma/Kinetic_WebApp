import type { Employee, LeaveType } from './types'

/* ── Indian leave model defaults ─────────────────────────────────
   Casual 12/yr (no carry) · Sick 12/yr (no carry, medical cert
   beyond 2 days) · Earned/Privilege 15/yr, carry-forward cap 30. */

export const LEAVE_DEFAULTS = { casual: 12, sick: 12, earned: 15 }
export const EARNED_CARRY_CAP = 30
export const SICK_CERT_THRESHOLD_DAYS = 2

export function balanceFor(e: Employee, type: LeaveType): number {
  if (type === 'Loss of Pay') return Infinity
  const b = type === 'Casual' ? e.leave.casual : type === 'Sick' ? e.leave.sick : e.leave.earned
  return b.entitled + b.carriedForward - b.used
}

export function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  return ms < 0 ? 0 : Math.floor(ms / 86400000) + 1
}

export const EMPLOYEE_LIFECYCLE: Employee['status'][] = [
  'Onboarding',
  'Probation',
  'Active',
  'On Notice',
  'Exited',
]

/* Company holiday calendar 2026 (demo) */
export const HOLIDAYS_2026: { date: string; name: string }[] = [
  { date: '2026-01-26', name: 'Republic Day' },
  { date: '2026-03-04', name: 'Holi' },
  { date: '2026-03-21', name: 'Eid al-Fitr' },
  { date: '2026-05-01', name: 'Maharashtra Day' },
  { date: '2026-08-15', name: 'Independence Day' },
  { date: '2026-08-26', name: 'Ganesh Chaturthi' },
  { date: '2026-10-02', name: 'Gandhi Jayanti' },
  { date: '2026-10-20', name: 'Diwali (Laxmi Pujan)' },
  { date: '2026-10-21', name: 'Diwali (Padwa)' },
  { date: '2026-12-25', name: 'Christmas Day' },
]
