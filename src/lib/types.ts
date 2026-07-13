/* ── Domain types ────────────────────────────────────────────────
   Shapes mirror the future Postgres tables named in the Workflow
   v3 reference (leads, quotes, bookings, booking_charges,
   booking_milestones, bl_versions, booking_documents,
   cro_documents, invoices, approvals, container_activities) so
   the mock layer swaps to Supabase without touching components. */

export type Role =
  | 'admin'
  | 'ops'
  | 'finance'
  | 'sales'
  | 'mnr'
  | 'hr'
  | 'customer'
  | 'agent'

/* ── Masters ─────────────────────────────────────────────────── */

export interface Customer {
  id: string
  name: string
  kind: 'Local' | 'Overseas'
}

export interface AgentMaster {
  id: string
  name: string
  country: string
  role: 'origin' | 'destination' | 'both'
}

export interface VesselMaster {
  id: string
  name: string
  voyageNo: string
  carrier: string
  pol: string
  pod: string
  etd: string
  eta: string
}

export interface VendorMaster {
  id: string
  name: string
  kind: 'Shipping line' | 'Surveyor' | 'CFS' | 'Repair' | 'Trucker' | 'Broker'
}

export interface DepotMaster {
  id: string
  name: string
  location: string
}

export interface ChargeCodeMaster {
  id: string
  code: string
  name: string
}

/* ── Lead → Quote funnel (doc §0.5) ──────────────────────────── */

export type LeadStatus = 'New' | 'Quoted' | 'Won' | 'Lost'
export type LeadMode = 'sea' | 'air' | 'road'

export interface Lead {
  id: string
  customerId: string | null // nullable — walk-in leads get a stub
  customerName: string
  origin: string
  destination: string
  mode: LeadMode
  cargoType: string
  targetDate: string
  status: LeadStatus
  createdAt: string
}

export type QuoteStatus =
  | 'Draft'
  | 'Pending approval'
  | 'Sent'
  | 'Accepted'
  | 'Rejected'
  | 'Expired'

export interface Quote {
  id: string
  leadId: string
  buyTotal: number
  sellTotal: number
  currency: 'USD' | 'INR'
  validUntil: string
  status: QuoteStatus
}

/* ── Booking (doc §1–2) ──────────────────────────────────────── */

export type Direction = 'Export' | 'Import'
export type FreightTerms = 'Prepaid' | 'Collect'

export type BookingStatus =
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
  | 'Cancelled'

export interface Booking {
  id: string
  bookingRef: string // KINEXP-XXXX / KINIMP-XXXX
  module: 'nvocc' | 'ff' | 'agency'
  direction: Direction
  // Header (doc §1 field grid)
  bookingPartyId: string
  bookingPartyName: string
  bookingDate: string
  principal: string
  shipper: string
  consignee: string
  notifyParty: string
  originAgentId: string | null
  destinationAgentId: string | null
  freeDaysOrigin: number
  freeDaysDest: number
  transitTime: number
  vesselId: string | null
  vesselName: string
  voyageNo: string
  pol: string
  pod: string
  etd: string
  eta: string
  freightTerms: FreightTerms
  surveyorId: string | null
  emptyYardId: string | null | undefined
  terminal?: string | null
  mblNo?: string | null
  // Container / product info tabs
  containerType: string // e.g. "40HC"
  containerQty: number
  containerNos: string[]
  commodity: string
  hsCode: string
  packages: number
  packageType: string
  grossWeightKg: number
  sealNo: string
  // System
  hblNo: string | null
  cancelled: boolean
  createdAt: string
}

/* ── Charges / costing (doc §2, booking_charges) ─────────────── */

export interface ChargeLine {
  id: string
  bookingId: string
  chargeCodeId: string
  chargeName: string
  type: 'buy' | 'sell'
  amount: number
  currency: 'USD' | 'INR'
  vendorId: string | null
}

/* ── Milestones (doc §6, booking_milestones) ─────────────────── */

export interface MilestoneDef {
  key: string
  label: string
}

export interface MilestoneEntry {
  bookingId: string
  key: string
  completedAt: string | null
  completedBy: string | null
}

/* ── Documents tab (doc §5, booking_documents) ───────────────── */

export type DocType =
  | 'CRO'
  | 'SI'
  | 'VGM'
  | 'CLP'
  | 'Shipping Bill'
  | 'BL'
  | 'SOB'
  | 'Offloading Letter'
  | 'DO'
  | 'CAN'
  | 'Commercial Invoice + Packing List'
  | 'Certificate of Origin'

export type DocStatus = 'pending' | 'uploaded' | 'approved'

export interface BookingDocument {
  id: string
  bookingId: string
  docType: DocType
  status: DocStatus
  uploadedBy: string | null
  uploadedAt: string | null
}

/* ── CRO (doc §3, cro_documents) ─────────────────────────────── */

export type CroStatus = 'Draft' | 'Issued' | 'Container picked up'

export interface CroDocument {
  id: string
  bookingId: string
  status: CroStatus
  containerNo: string | null
  issuedAt: string | null
}

/* ── BL (doc §4, bl_versions) ────────────────────────────────── */

export type BlLifecycle =
  | 'Draft'
  | 'Edited'
  | 'Awaiting approval'
  | 'Approved'
  | 'Released'

export interface BlFields {
  shipper: string
  consignee: string
  notifyParty: string
  pol: string
  pod: string
  vesselVoyage: string
  descriptionOfGoods: string
  grossWeight: string
  marksAndNumbers: string
  packages: string
}

export interface BlVersion {
  id: string
  bookingId: string
  version: number
  fields: BlFields
  editedBy: string
  editedByRole: Role
  editedAt: string
  amendment: boolean
}

export interface BlState {
  bookingId: string
  lifecycle: BlLifecycle
  releaseType: 'Original' | 'Telex' | 'Seaway' | null
  currentFields: BlFields
}

/* ── Container activities (doc §2/§9, container_activities) ──── */

export interface ContainerActivity {
  key: string
  label: string
  section: 'origin' | 'destination'
  completedAt: string | null
}

/* ── Invoices (doc §8) ───────────────────────────────────────── */

export type InvoiceStatus =
  | 'Draft'
  | 'Pending approval'
  | 'Approved'
  | 'Zoho synced'
  | 'Emailed'
  | 'Partially paid'
  | 'Paid'
  | 'Overdue'
  | 'Cancelled'

export interface InvoiceLine {
  chargeLineId: string
  chargeName: string
  amount: number
  currency: 'USD' | 'INR'
}

export interface Invoice {
  id: string
  invoiceNo: string
  bookingId: string
  type: 'AR' | 'AP'
  status: InvoiceStatus
  lines: InvoiceLine[]
  zohoInvoiceId: string | null
  createdAt: string
}

/* ── Approvals engine (doc §11, approvals) ───────────────────── */

export type ApprovalEntityType =
  | 'quote'
  | 'bl_edit'
  | 'invoice'
  | 'repair_estimate'
  | 'booking_request'
  | 'credit_note'

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected'

export interface Approval {
  id: string
  entityType: ApprovalEntityType
  entityId: string
  bookingId: string | null
  summary: string
  requestedBy: string
  requestedAt: string
  status: ApprovalStatus
  /** For bl_edit: proposed field changes awaiting ops approval */
  payload?: Partial<BlFields>
}

/* ── Activity log (append-only) ──────────────────────────────── */

export interface ActivityEntry {
  id: string
  bookingId: string
  at: string
  actor: string
  action: string
}

/* ── Dashboard aggregates (unchanged consumers) ──────────────── */

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

export interface KpiSummary {
  totalShipments: number
  totalShipmentsDelta: number
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
  label: string
  booked: number
  inTransit: number
  delivered: number
}

export interface ShipmentTypeSlice {
  label: string
  value: number
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
  tasks: TaskItem[]
  notifications: number
}

export interface CurrentUser {
  name: string
  role: Role
  roleLabel: string
  avatarInitials: string
}
