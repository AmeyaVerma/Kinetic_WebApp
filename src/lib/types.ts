/* ── Domain types ────────────────────────────────────────────────
   Shapes intentionally mirror the future Postgres tables (see
   Product Reference §6.1) so the mock layer can be swapped for
   Supabase without touching components.                          */

export type Role =
  | 'admin'
  | 'ops'
  | 'finance'
  | 'sales'
  | 'mnr'
  | 'hr'
  | 'customer'
  | 'agent'

export type BookingStatus =
  | 'Enquiry'
  | 'Quoted'
  | 'Approved'
  | 'Booked'
  | 'Container allocated'
  | 'Documentation'
  | 'Awaiting BL approval'
  | 'Ready to sail'
  | 'Sailed'
  | 'Arrived'
  | 'Under clearance'
  | 'Delivered'
  | 'Financial closure'
  | 'Closed'

/** Simplified status used for chips in lists/dashboard */
export type ChipStatus =
  | 'Booked'
  | 'In Transit'
  | 'Documentation'
  | 'Delivered'
  | 'Arrived'
  | 'Cancelled'
  | 'Draft'
  | 'BL Draft'
  | 'Pending'
  | 'Overdue'

export type ShipmentType =
  | 'FCL (EXP)'
  | 'FCL (IMP)'
  | 'LCL'
  | 'Air'
  | 'Cross Trade'
  | 'Project'

export interface Booking {
  id: string
  bookingRef: string // KL/EXP/25/000123
  type: ShipmentType
  direction: 'Export' | 'Import'
  pol: string // UN/LOCODE-ish short name e.g. INNSA
  pod: string
  vesselVoyage: string // "CMA CGM TAIGE / 0FL1E"
  etd: string // ISO date
  eta: string | null
  status: BookingStatus
  chipStatus: ChipStatus
  customerId: string
  customerName: string
  agentId: string | null
  hblNo: string | null
  createdAt: string
}

export interface KpiSummary {
  totalShipments: number
  totalShipmentsDelta: number // percent
  inTransit: number
  inTransitDelta: number
  delivered: number
  deliveredDelta: number
  revenueUsd: number
  revenueDelta: number
  blDrafts: number
  blDraftsDelta: number
}

export interface ShipmentOverviewPoint {
  label: string // "1 May"
  booked: number
  inTransit: number
  delivered: number
}

export interface ShipmentTypeSlice {
  label: string // "FCL (Export)"
  value: number // percent
  color: string
}

export interface TradeLane {
  from: string
  to: string
  sharePct: number
  kind: 'sea' | 'other'
}

export interface TaskItem {
  id: string
  label: string
  count: number
}

export interface DashboardData {
  kpis: KpiSummary
  overview: ShipmentOverviewPoint[]
  byType: ShipmentTypeSlice[]
  byTypeTotal: number
  tradeLanes: TradeLane[]
  recentBookings: Booking[]
  totalBookings: number
  tasks: TaskItem[]
  approvalsPending: number
  notifications: number
}

export interface CurrentUser {
  name: string
  role: Role
  roleLabel: string
  avatarInitials: string
}
