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
  | 'credit_hold'
  | 'blacklist'
  | 'agent_gate'

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

/* ── MNR module (MNR Requirements v2 + flowchart) ────────────── */

export type ContainerStatus =
  | 'Available'
  | 'On Hire'
  | 'Under Repair'
  | 'Off Hire'
  | 'Hold'
  | 'Scrapped'
  | 'Lost'

export type OwnershipType = 'Owned' | 'Leased-in' | 'Sub-leased'

export interface FleetContainer {
  id: string
  containerNo: string // ISO 6346
  isoType: string // 20GP / 40HC / 40RF / OT / FR / Tank
  ownership: OwnershipType
  lessor: string | null
  manufactureDate: string
  cscExpiry: string
  status: ContainerStatus
  depotId: string | null
  custodianBookingRef: string | null
  insuredValue: number
  warrantyRef: string | null
  isReefer: boolean
}

export type MnrStage =
  | 'Initial Inspection'
  | 'Damage Survey'
  | 'Estimate'
  | 'Approval'
  | 'Repair Execution'
  | 'Quality Control'
  | 'Finance Posting'
  | 'Closed'

export type DamageSeverity = 'Minor' | 'Major' | 'Structural'
export type ResponsibleParty = 'Carrier' | 'Customer' | 'Terminal' | 'Unknown'

export interface DamagePoint {
  id: string
  panel: string // front / rear / left / right / roof / floor / doors / corner castings
  damageCode: string
  component: string
  dims: string // L×W×D
  severity: DamageSeverity
  photos: number // min 2 gate
  preExisting: boolean
  responsibleParty: ResponsibleParty
  qcPass: boolean | null
}

export interface MnrEstimate {
  version: number
  vendorId: string
  labour: number
  material: number
  tax: number
  total: number
  validUntil: string
  revisionReason: string | null
  status: 'Submitted' | 'Auto-approved' | 'Approved' | 'Rejected'
  approverBand: string
}

export interface ChecklistItem {
  key: string
  label: string
  pass: boolean | null
}

export type WarrantyClaimStatus = 'None' | 'Claimed' | 'Under Review' | 'Reimbursed' | 'Rejected'
export type MnrOutcome = 'Available' | 'Off-Hire' | 'Scrap'

export interface MnrJob {
  id: string
  containerId: string
  containerNo: string
  bookingRef: string | null // null = free-in movement
  depotId: string
  stage: MnrStage
  // Gate-in (flow 1)
  ocrMatched: boolean
  overrideReason: string | null
  sealIntact: boolean | null // null = not an import full container
  gateInPhotos: number // min 6 gate
  eirSigned: boolean
  gateInAt: string
  // Initial inspection
  checklist: ChecklistItem[]
  cleanliness: 'Clean' | 'Broom clean' | 'Requires cleaning' | 'Requires washing' | null
  cscExpiringSoon: boolean
  ptiPass: boolean | null // reefer only
  contamination: boolean
  // Survey (flow 2)
  damagePoints: DamagePoint[]
  engineeringRequired: boolean
  // Estimate / approval (flows 2–3)
  estimates: MnrEstimate[]
  lessorNotified: boolean
  // Repair execution (flow 4)
  progressPct: number
  materialsDeviation: boolean
  additionalDamagePending: boolean
  // QC (flow 4)
  cscRecertDone: boolean
  ptiRepeatDone: boolean
  punchList: string[]
  qcSignedOff: boolean
  // Finance (flow 5)
  vendorBill: number | null
  rootCause: ResponsibleParty | null
  debitNoteIssued: boolean
  warrantyClaim: WarrantyClaimStatus
  costClass: 'Capitalize' | 'Expense' | null
  outcome: MnrOutcome | null
}

/* ── Freight Forwarding module (FF flowchart, 6 flows) ───────── */

export type FfMode = 'Sea FCL' | 'Sea LCL' | 'Air' | 'Road' | 'Multimodal'

export type FfStage =
  | 'Booking'
  | 'Carrier & Pickup'
  | 'Documentation'
  | 'Export & Transit'
  | 'Arrival & Delivery'
  | 'Financial Close'
  | 'Closed'

export type FfVendorRole = 'Carrier' | 'Customs' | 'Trucking' | 'Warehousing' | 'Insurance'

export interface FfVendorLine {
  id: string
  role: FfVendorRole
  vendorId: string
  vendorName: string
  buyAmount: number
  /** Bill arrives independently later — null until matched (flow 5) */
  billedAmount: number | null
  varianceFlag: boolean
}

export type HouseDocStatus = 'None' | 'Draft' | 'Awaiting approval' | 'Released'

export interface FfShipment {
  id: string
  ref: string // KINFF-XXXX (children: KINFF-XXXX/H1…)
  mode: FfMode
  customerId: string | null
  customerName: string
  origin: string
  destination: string
  incoterm: string
  stage: FfStage
  creditHold: boolean
  // Consolidation (flow 6)
  isConsolParent: boolean
  parentId: string | null // set on child HBLs
  consolClosed: boolean
  // Flow 2 — carrier & pickup
  carrierName: string
  linkedNvoccRef: string | null // internal NVOCC master link
  rateReconfirmed: boolean
  agentId: string | null
  specialHandling: string | null
  pickupProof: boolean
  // Flow 3 — documentation
  siReceived: boolean
  weightVarianceFlagged: boolean
  mblUploaded: boolean
  houseDocStatus: HouseDocStatus
  houseDocVersion: number
  houseReleaseType: string | null
  // Flow 4 — export & transit
  brokerAssigned: boolean
  exportHold: boolean
  letExportReceived: boolean
  gateInDone: boolean
  vgmDone: boolean
  cutoffMet: boolean | null
  departed: boolean
  transhipmentLegs: number
  // Flow 5 — arrival & delivery
  arrivalNoticeSent: boolean
  importHold: boolean
  outOfCharge: boolean
  ddOutcome: 'None' | 'Customer-billed' | 'Absorbed' | null
  doIssued: boolean
  podCaptured: boolean
  // Financials
  sellAmount: number
  vendorLines: FfVendorLine[]
  clientInvoiced: boolean
  paid: boolean
  createdAt: string
}

/* ── Customer Management module (CM Requirements v1) ─────────── */

export type CustomerStatus = 'Prospect' | 'Active' | 'On Hold' | 'Inactive' | 'Blacklisted'
export type CustomerRole = 'Shipper' | 'Consignee' | 'Notify Party'
export type BlEditPermission = 'None' | 'Can request edits' | 'Cannot view drafts'
export type CreditHoldPolicy = 'Hard-block' | 'Soft-warn'
export type ScreeningStatus = 'Clear' | 'Flagged' | 'Under Review'

export interface CustomerContact {
  id: string
  name: string
  designation: string
  email: string
  phone: string
  department: 'Commercial' | 'Operations' | 'Finance' | 'Documentation'
  preferredMethod: 'Email' | 'Phone' | 'WhatsApp'
  primary: boolean
}

export interface LaneRate {
  id: string
  origin: string
  destination: string
  mode: string
  rate: number
  currency: 'USD' | 'INR'
  validUntil: string
}

export interface PortalUser {
  id: string
  name: string
  email: string
  role: 'Company Admin' | 'Booking Creator' | 'Viewer-only' | 'Finance-only'
  status: 'Active' | 'Suspended'
  mfaEnabled: boolean
  lastLogin: string | null
}

export type NotificationEvent =
  | 'Booking Confirmed'
  | 'Milestone Updates'
  | 'BL Draft Ready'
  | 'Invoice Generated'
  | 'Payment Reminder'
  | 'Customs Hold'
  | 'Delivery Completed'

export interface NotificationPref {
  event: NotificationEvent
  channels: ('Email' | 'WhatsApp' | 'SMS' | 'In-app')[]
  digest: 'Real-time' | 'Daily digest'
}

export interface KycDoc {
  id: string
  type: 'Registration certificate' | 'Tax certificate' | 'Trade license' | 'Service agreement' | 'Insurance certificate'
  expiry: string
  verified: boolean
}

export interface CustomerRecord {
  id: string // matches booking customerIds (c1…)
  code: string // CUST-00123, immutable
  legalName: string
  displayName: string
  roles: CustomerRole[]
  industry: string
  parentId: string | null // customer group
  taxId: string
  website: string
  billingAddress: string
  status: CustomerStatus
  salesOwner: string
  csRep: string
  source: string
  contacts: CustomerContact[]
  // Commercial terms (§4)
  defaultIncoterm: string
  paymentTerms: string
  creditLimit: number
  creditCurrency: 'USD' | 'INR'
  creditHoldPolicy: CreditHoldPolicy
  laneRates: LaneRate[]
  discountPct: number
  invoicingCurrency: 'USD' | 'INR'
  consolidatedInvoicing: boolean
  autoInvoice: 'Immediate on milestone' | 'Weekly batch'
  sharedCreditPool: boolean // parent groups only
  // Access & portal (§5)
  portalEnabled: boolean
  visNvocc: boolean
  visFf: boolean
  blEditPermission: BlEditPermission
  docDownload: 'All' | 'Invoice' | 'BL' | 'None'
  bookingCreation: boolean
  quoteRequest: boolean
  ipRestriction: boolean
  mfaMandated: boolean
  portalUsers: PortalUser[]
  // Notifications (§6)
  notificationPrefs: NotificationPref[]
  // Compliance (§7) + onboarding gates (§8.1)
  kycDocs: KycDoc[]
  screening: ScreeningStatus
  creditApproved: boolean // or cash-in-advance
  cashInAdvanceOnly: boolean
  salesSignoff: boolean
  pendingCreditRequest: number | null
  blacklistReason: string | null
  createdAt: string
}

/* ── Agent Management module (AM Requirements v1) ────────────── */

export type AgentStatus = 'Prospect' | 'Active' | 'Suspended' | 'Terminated'
export type AgentDirection = 'We are Principal' | 'We are Agent' | 'Both'
export type AgentTypeTag =
  | 'Destination Agent'
  | 'Origin Agent'
  | 'NVOCC Agency Partner'
  | 'Liner Agency Partner'
export type AgentBlEdit = 'Edit live (versioned)' | 'Submit for approval' | 'None'
export type CommissionType = '% of freight' | 'Flat fee per shipment' | 'Tiered by volume'
export type SoaCycle = 'Weekly' | 'Monthly' | 'Per-shipment'

export interface AgentPortalUser {
  id: string
  name: string
  email: string
  role: 'Agent Admin' | 'Booking Creator' | 'Milestone Updater' | 'Viewer-only'
  status: 'Active' | 'Suspended'
  mfaEnabled: boolean
  lastLogin: string | null
}

export interface AgentDocument {
  id: string
  type: 'Agency agreement' | 'IATA certification' | 'FIATA certification' | 'Insurance/bond certificate' | 'Signed SLA'
  expiry: string
  verified: boolean
}

export interface AgentRecord {
  id: string // matches booking agentIds (a1…)
  code: string // AGT-00123, immutable
  legalName: string
  displayName: string
  agentTypes: AgentTypeTag[]
  direction: AgentDirection
  portsCovered: string[]
  taxId: string
  address: string
  status: AgentStatus
  relationshipOwner: string
  contacts: CustomerContact[] // same structure as customer contacts (§3.2)
  // Commercial (§4)
  commissionType: CommissionType
  commissionValue: number // % or flat USD
  commissionTypeReverse: CommissionType | null // second direction when Both
  commissionValueReverse: number | null
  settlementCurrency: 'USD' | 'INR'
  soaCycle: SoaCycle
  settlementTerms: string
  disbursementLimit: number
  pendingCommissionChange: string | null
  // Access & portal (§5)
  portalEnabled: boolean
  scopeRestriction: string // '' = full relationship scope
  createBooking: boolean // only meaningful if direction includes We are Agent
  blEdit: AgentBlEdit
  milestonePerms: ('CAN' | 'DO' | 'POD')[]
  docUpload: boolean
  soaVisibility: boolean
  portalUsers: AgentPortalUser[]
  // Compliance (§7) + onboarding (§9.1)
  documents: AgentDocument[]
  accreditationRequired: boolean
  commercialConfirmed: boolean
  activationRequested: boolean
  // Performance & SLA (§8)
  responseSlaHrs: number
  milestoneSlaHrs: number
  weightOnTime: number
  weightDocAccuracy: number
  weightResponsiveness: number
  autoFlagThreshold: number
  // computed-score demo inputs
  scoreOnTime: number
  scoreDocAccuracy: number
  scoreResponsiveness: number
  performanceFlagged: boolean
  // Settlement (termination gate §9.2)
  soaBalanceUsd: number // 0 = reconciled
  createdAt: string
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
