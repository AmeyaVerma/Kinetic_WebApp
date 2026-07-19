/* ── Session data store ──────────────────────────────────────────
   The interactive mock backend. All workflow mutations live here,
   mirroring the actions the Supabase layer will expose later.
   State resets on refresh (same contract as the v5 prototype).  */

import { create } from 'zustand'
import type {
  ActivityEntry,
  AgentRecord,
  Approval,
  BlFields,
  BlState,
  BlVersion,
  AgentMaster,
  Booking,
  BookingDocument,
  BookingWorkflowStatus,
  ChargeCodeMaster,
  ChargeLine,
  CustomFieldDef,
  Customer,
  DepotMaster,
  VendorMaster,
  VesselMaster,
  ContainerActivity,
  CroDocument,
  CustomerRecord,
  DamagePoint,
  Employee,
  FfShipment,
  FfVendorLine,
  FleetContainer,
  Invoice,
  InvoiceStatus,
  Lead,
  LeaveRequest,
  LeaveType,
  MilestoneEntry,
  PayrollRun,
  MnrEstimate,
  MnrJob,
  MnrOutcome,
  Quote,
  ResponsibleParty,
  Role,
  WarrantyClaimStatus,
} from '../lib/types'
import { INSPECTION_CHECKLIST, approverBand, latestEstimate } from '../lib/mnr'
import { mockFleet, mockMnrJobs } from '../mocks/mnrSeed'
import { CREDIT_LIMIT_USD, buyTotal, overTolerance } from '../lib/ff'
import { mockFfShipments } from '../mocks/ffSeed'
import { mockCustomerRecords } from '../mocks/customerSeed'
import { mockAgentRecords } from '../mocks/agentSeed'
import { balanceFor, daysBetween } from '../lib/hr'
import { mockEmployees, mockLeaveRequests, mockPayrollRuns } from '../mocks/hrSeed'
import {
  mockAgents,
  mockChargeCodes,
  mockCustomers,
  mockDepots,
  mockVendors,
  mockVessels,
  CONTAINER_TYPES,
  PACKAGE_TYPES,
} from '../mocks/masters'
import {
  mockActivities,
  mockApprovals,
  mockBlStates,
  mockBlVersions,
  mockBookings,
  mockCharges,
  mockContainerActivities,
  mockCros,
  mockDocuments,
  mockInvoices,
  mockLeads,
  mockMilestones,
  mockQuotes,
  CONTAINER_ACTIVITY_DEFS,
} from '../mocks/seed'

let seq = 1000
const uid = (p: string) => `${p}${++seq}`
const now = () => new Date().toISOString()

const INVOICE_CHAIN: InvoiceStatus[] = [
  'Draft',
  'Pending approval',
  'Approved',
  'Zoho synced',
  'Emailed',
  'Partially paid',
  'Paid',
]

/** Master lists a user can extend with new options inline (Workflow §11). */
export interface Masters {
  customers: Customer[]
  agents: AgentMaster[]
  vessels: VesselMaster[]
  vendors: VendorMaster[]
  depots: DepotMaster[]
  chargeCodes: ChargeCodeMaster[]
  containerTypes: string[]
  packageTypes: string[]
}
export type MasterKind = keyof Masters

interface DataState {
  leads: Lead[]
  quotes: Quote[]
  bookings: Booking[]
  charges: ChargeLine[]
  milestones: MilestoneEntry[]
  documents: BookingDocument[]
  cros: CroDocument[]
  blStates: BlState[]
  blVersions: BlVersion[]
  containerActivities: Record<string, ContainerActivity[]>
  invoices: Invoice[]
  approvals: Approval[]
  activities: ActivityEntry[]
  masters: Masters
  customFieldDefs: CustomFieldDef[]
  customFieldValues: Record<string, Record<string, string>> // recordId → fieldId → value

  // Master data — user-extensible dropdown options (Workflow §11)
  addMasterOption: (kind: MasterKind, name: string) => string

  // Custom fields — user-defined schema per entity (Workflow §11)
  addCustomFieldDef: (def: Omit<CustomFieldDef, 'id'>) => string
  removeCustomFieldDef: (id: string) => void
  setCustomFieldValue: (recordId: string, fieldId: string, value: string) => void

  // Lead → Quote → Convert (doc §0.5)
  createLead: (l: Omit<Lead, 'id' | 'status' | 'createdAt'>) => void
  createQuote: (leadId: string, buy: number, sell: number, currency: 'USD' | 'INR', validUntil: string) => void
  quoteAction: (quoteId: string, action: 'send' | 'accept' | 'reject') => void
  convertToBooking: (quoteId: string) => void

  // Booking (doc §1–2)
  createBooking: (
    b: Omit<Booking, 'id' | 'bookingRef' | 'hblNo' | 'cancelled' | 'createdAt' | 'module'>,
    charges: Omit<ChargeLine, 'id' | 'bookingId'>[],
  ) => string
  cancelBooking: (bookingId: string, reason: string) => void
  updateShipmentDates: (bookingId: string, dates: { etd?: string; eta?: string }, actor: string) => void
  setBookingWorkflowStatus: (bookingId: string, status: BookingWorkflowStatus, actor: string) => void

  // Milestones (doc §6)
  markMilestone: (bookingId: string, key: string, actor: string) => void

  // CRO (doc §3)
  generateCro: (bookingId: string) => void
  croPickup: (bookingId: string, containerNo: string) => void

  // BL (doc §4)
  saveBl: (bookingId: string, fields: BlFields, actor: string, role: Role) => void
  submitCustomerBlEdit: (bookingId: string, changes: Partial<BlFields>, actor: string) => void
  approveBl: (bookingId: string) => void
  releaseBl: (bookingId: string, releaseType: 'Original' | 'Telex' | 'Seaway') => void

  // Documents (doc §5)
  uploadDocument: (bookingId: string, docType: BookingDocument['docType'], actor: string) => void

  // Container activities
  markContainerActivity: (bookingId: string, key: string) => void

  // Invoicing (doc §8)
  addCharge: (c: Omit<ChargeLine, 'id'>) => void
  removeCharge: (chargeId: string) => void
  generateInvoice: (bookingId: string, type: 'AR' | 'AP', chargeIds: string[]) => void
  advanceInvoice: (invoiceId: string) => void

  // Approvals (doc §11)
  decideApproval: (approvalId: string, decision: 'Approved' | 'Rejected') => void

  // ── MNR (Requirements v2 + flowchart) ──
  fleet: FleetContainer[]
  mnrJobs: MnrJob[]
  registerGateIn: (input: {
    containerNo: string
    bookingRef: string | null
    depotId: string
    sealIntact: boolean | null
    gateInPhotos: number
    eirSigned: boolean
    overrideReason: string | null
  }) => string | null
  setChecklistItem: (jobId: string, key: string, pass: boolean) => void
  completeInspection: (
    jobId: string,
    extra: { cleanliness: MnrJob['cleanliness']; ptiPass: boolean | null; contamination: boolean },
  ) => void
  addDamagePoint: (jobId: string, dp: Omit<DamagePoint, 'id' | 'qcPass'>) => void
  completeSurvey: (jobId: string) => void
  submitMnrEstimate: (
    jobId: string,
    est: { vendorId: string; labour: number; material: number; tax: number; validUntil: string; revisionReason: string | null },
  ) => void
  setRepairProgress: (jobId: string, pct: number, materialsDeviation: boolean) => void
  submitAdditionalDamage: (jobId: string, amount: number, desc: string) => void
  vendorCompleteRepair: (jobId: string) => void
  setQcLine: (jobId: string, dpId: string, pass: boolean) => void
  qcRework: (jobId: string) => void
  qcSignoff: (jobId: string, extra: { cscRecertDone: boolean; ptiRepeatDone: boolean; punchList: string[] }) => void
  postFinance: (
    jobId: string,
    fin: { vendorBill: number; rootCause: ResponsibleParty; costClass: 'Capitalize' | 'Expense'; warrantyClaim: WarrantyClaimStatus },
  ) => void
  issueDebitNote: (jobId: string) => void
  closeMnrJob: (jobId: string, outcome: MnrOutcome) => void

  // ── Freight Forwarding (FF flowchart, 6 flows) ──
  ffShipments: FfShipment[]
  createFfShipment: (
    s: Pick<FfShipment, 'mode' | 'customerId' | 'customerName' | 'origin' | 'destination' | 'incoterm' | 'sellAmount' | 'isConsolParent' | 'specialHandling'>,
    vendorLines: Omit<FfVendorLine, 'id' | 'billedAmount' | 'varianceFlag'>[],
  ) => string
  addChildHbl: (parentId: string, child: { customerId: string | null; customerName: string; sellAmount: number }) => void
  closeConsolRun: (parentId: string) => void
  ffConfirmCarrier: (id: string, opts: { linkedNvoccRef: string | null; carrierName: string; agentId: string | null }) => void
  ffPickupComplete: (id: string) => void
  ffDocAction: (
    id: string,
    action: 'si_received' | 'weight_variance' | 'mbl_uploaded' | 'draft_house' | 'customer_edit' | 'release',
    releaseType?: string,
  ) => void
  ffExportAction: (
    id: string,
    action: 'broker' | 'hold' | 'resolve_hold' | 'let_export' | 'gate_in_vgm' | 'cutoff_met' | 'cutoff_missed' | 'depart',
  ) => void
  ffArrivalAction: (
    id: string,
    action: 'arrival_notice' | 'import_hold' | 'resolve_hold' | 'out_of_charge' | 'dd_customer' | 'dd_absorbed' | 'dd_none' | 'issue_do' | 'pod',
  ) => void
  ffInvoiceClient: (id: string) => void
  ffMatchVendorBill: (id: string, lineId: string, billedAmount: number) => void
  ffMarkPaid: (id: string) => void
  ffFinancialClose: (id: string) => void

  // ── Customer Management (CM Requirements v1) ──
  customers: CustomerRecord[]
  updateCustomer: (id: string, patch: Partial<CustomerRecord>, auditNote: string) => void
  requestCreditLimit: (id: string, amount: number) => void
  requestBlacklist: (id: string, reason: string) => void
  requestBlacklistReversal: (id: string) => void

  // ── Agent Management (AM Requirements v1) ──
  agents: AgentRecord[]
  updateAgent: (id: string, patch: Partial<AgentRecord>, auditNote: string) => void
  requestAgentActivation: (id: string) => void
  requestCommissionChange: (id: string, description: string) => void
  suspendAgent: (id: string, reason: string) => void
  clearAgentSuspension: (id: string) => void
  requestAgentTermination: (id: string) => void

  // ── HR module ──
  employees: Employee[]
  leaveRequests: LeaveRequest[]
  payrollRuns: PayrollRun[]
  updateEmployee: (id: string, patch: Partial<Employee>, auditNote: string) => void
  requestLeave: (input: {
    employeeId: string
    type: LeaveType
    from: string
    to: string
    reason: string
    medicalCert: boolean
  }) => void
  cancelLeave: (requestId: string) => void
  confirmProbation: (id: string) => void
  startNotice: (id: string, lastDay: string) => void
  setExitClearance: (id: string, key: keyof Employee['exitClearance']) => void
  completeExit: (id: string) => void
}

function log(activities: ActivityEntry[], bookingId: string, actor: string, action: string): ActivityEntry[] {
  return [{ id: uid('ac'), bookingId, at: now(), actor, action }, ...activities]
}

export const useDataStore = create<DataState>((set, get) => ({
  leads: mockLeads,
  quotes: mockQuotes,
  bookings: mockBookings,
  charges: mockCharges,
  milestones: mockMilestones,
  documents: mockDocuments,
  cros: mockCros,
  blStates: mockBlStates,
  blVersions: mockBlVersions,
  containerActivities: mockContainerActivities,
  invoices: mockInvoices,
  approvals: mockApprovals,
  activities: mockActivities,
  masters: {
    customers: mockCustomers,
    agents: mockAgents,
    vessels: mockVessels,
    vendors: mockVendors,
    depots: mockDepots,
    chargeCodes: mockChargeCodes,
    containerTypes: [...CONTAINER_TYPES],
    packageTypes: [...PACKAGE_TYPES],
  },
  customFieldDefs: [],
  customFieldValues: {},

  addCustomFieldDef: (def) => {
    const id = uid('cf')
    set((s) => ({ customFieldDefs: [...s.customFieldDefs, { ...def, id }] }))
    return id
  },

  removeCustomFieldDef: (id) =>
    set((s) => ({ customFieldDefs: s.customFieldDefs.filter((d) => d.id !== id) })),

  setCustomFieldValue: (recordId, fieldId, value) =>
    set((s) => ({
      customFieldValues: {
        ...s.customFieldValues,
        [recordId]: { ...s.customFieldValues[recordId], [fieldId]: value },
      },
    })),

  addMasterOption: (kind, name) => {
    const trimmed = name.trim()
    if (!trimmed) return ''
    if (kind === 'containerTypes' || kind === 'packageTypes') {
      set((s) => {
        const list = s.masters[kind]
        if (list.includes(trimmed)) return s
        return { masters: { ...s.masters, [kind]: [...list, trimmed] } }
      })
      return trimmed
    }
    if (kind === 'customers') {
      const id = uid('c')
      set((s) => ({
        masters: { ...s.masters, customers: [...s.masters.customers, { id, name: trimmed, kind: 'Local' }] },
      }))
      return id
    }
    if (kind === 'chargeCodes') {
      const id = uid('cc')
      set((s) => ({
        masters: {
          ...s.masters,
          chargeCodes: [...s.masters.chargeCodes, { id, code: trimmed.slice(0, 6).toUpperCase(), name: trimmed }],
        },
      }))
      return id
    }
    // id-based masters (agents/vessels/vendors/depots) become addable in Pass 2,
    // once their record resolvers read from the store instead of the static mocks.
    return ''
  },

  createLead: (l) =>
    set((s) => ({
      leads: [{ ...l, id: uid('l'), status: 'New', createdAt: now() }, ...s.leads],
    })),

  createQuote: (leadId, buy, sell, currency, validUntil) =>
    set((s) => {
      const marginPct = sell > 0 ? ((sell - buy) / sell) * 100 : 0
      const overThreshold = marginPct > 20 // configurable threshold per doc
      const quote: Quote = {
        id: uid('q'),
        leadId,
        buyTotal: buy,
        sellTotal: sell,
        currency,
        validUntil,
        status: overThreshold ? 'Pending approval' : 'Sent',
      }
      const lead = s.leads.find((x) => x.id === leadId)
      return {
        quotes: [quote, ...s.quotes],
        leads: s.leads.map((x) => (x.id === leadId ? { ...x, status: 'Quoted' } : x)),
        approvals: overThreshold
          ? [
              {
                id: uid('ap'),
                entityType: 'quote' as const,
                entityId: quote.id,
                bookingId: null,
                summary: `Quote for ${lead?.customerName ?? 'lead'} over margin threshold (${marginPct.toFixed(1)}%)`,
                requestedBy: 'BD',
                requestedAt: now(),
                status: 'Pending' as const,
              },
              ...s.approvals,
            ]
          : s.approvals,
      }
    }),

  quoteAction: (quoteId, action) =>
    set((s) => ({
      quotes: s.quotes.map((q) =>
        q.id === quoteId
          ? { ...q, status: action === 'send' ? 'Sent' : action === 'accept' ? 'Accepted' : 'Rejected' }
          : q,
      ),
      leads: s.leads.map((l) => {
        const q = s.quotes.find((x) => x.id === quoteId)
        if (!q || l.id !== q.leadId) return l
        return action === 'accept' ? { ...l, status: 'Won' } : action === 'reject' ? { ...l, status: 'Lost' } : l
      }),
    })),

  convertToBooking: (quoteId) => {
    // Conversion pre-fills the wizard; here we just mark the quote used.
    set((s) => ({
      quotes: s.quotes.map((q) => (q.id === quoteId ? { ...q, status: 'Accepted' } : q)),
    }))
  },

  createBooking: (b, chargeLines) => {
    // Real numbering scheme from the live tracker: KLNVO2627XXXXXX
    const existing = get().bookings
    const maxSeq = existing.reduce((max, x) => {
      const m = x.bookingRef.match(/^KLNVO2627(\d{6})$/)
      return m ? Math.max(max, +m[1]) : max
    }, 0)
    const bookingRef = `KLNVO2627${String(maxSeq + 1).padStart(6, '0')}`
    const id = bookingRef
    const num = maxSeq + 1
    const booking: Booking = {
      ...b,
      id,
      module: 'nvocc',
      bookingRef,
      hblNo: `KLHBL25${String(num).padStart(4, '0')}`,
      cancelled: false,
      createdAt: now(),
      workflowStatus: 'Booked',
    }
    set((s) => ({
      bookings: [booking, ...s.bookings],
      charges: [
        ...chargeLines.map((c) => ({ ...c, id: uid('ch'), bookingId: id })),
        ...s.charges,
      ],
      activities: log(s.activities, id, 'Ops', `Booking created — ${bookingRef}`),
    }))
    return id
  },

  cancelBooking: (bookingId, reason) =>
    set((s) => {
      const open = s.invoices.some(
        (i) => i.bookingId === bookingId && !['Paid', 'Cancelled'].includes(i.status),
      )
      if (open) {
        // Doc §9: cannot void with an open, unreconciled invoice
        return {
          activities: log(s.activities, bookingId, 'System', 'Void blocked — open invoice requires credit note first'),
        }
      }
      return {
        bookings: s.bookings.map((x) =>
          x.id === bookingId ? { ...x, cancelled: true, workflowStatus: 'Cancelled' } : x,
        ),
        activities: log(s.activities, bookingId, 'Ops', `Booking cancelled — reason: ${reason}`),
      }
    }),

  updateShipmentDates: (bookingId, dates, actor) =>
    set((s) => {
      const booking = s.bookings.find((b) => b.id === bookingId)
      if (!booking) return s
      const changed: string[] = []
      if (dates.etd !== undefined && dates.etd !== booking.etd) changed.push(`ETD → ${dates.etd}`)
      if (dates.eta !== undefined && dates.eta !== booking.eta) changed.push(`ETA → ${dates.eta}`)
      if (changed.length === 0) return s
      return {
        bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, ...dates } : b)),
        activities: log(s.activities, bookingId, actor, `Shipment dates updated — ${changed.join(', ')}`),
      }
    }),

  setBookingWorkflowStatus: (bookingId, status, actor) =>
    set((s) => {
      const booking = s.bookings.find((b) => b.id === bookingId)
      if (!booking || booking.workflowStatus === status) return s
      return {
        bookings: s.bookings.map((b) =>
          b.id === bookingId
            ? { ...b, workflowStatus: status, cancelled: status === 'Cancelled' }
            : b,
        ),
        activities: log(s.activities, bookingId, actor, `Booking status → ${status}`),
      }
    }),

  markMilestone: (bookingId, key, actor) =>
    set((s) => {
      if (s.milestones.some((m) => m.bookingId === bookingId && m.key === key && m.completedAt)) return s
      const booking = s.bookings.find((b) => b.id === bookingId)
      const label = key.replace(/_/g, ' ')
      return {
        milestones: [
          ...s.milestones.filter((m) => !(m.bookingId === bookingId && m.key === key)),
          { bookingId, key, completedAt: now(), completedBy: actor },
        ],
        activities: log(s.activities, bookingId, actor, `Milestone: ${label}${booking ? '' : ''}`),
      }
    }),

  generateCro: (bookingId) =>
    set((s) => {
      if (s.cros.some((c) => c.bookingId === bookingId)) return s
      return {
        cros: [{ id: uid('cro'), bookingId, status: 'Issued', containerNo: null, issuedAt: now() }, ...s.cros],
        documents: [
          { id: uid('doc'), bookingId, docType: 'CRO' as const, status: 'uploaded' as const, uploadedBy: 'MNR', uploadedAt: now() },
          ...s.documents,
        ],
        milestones: [
          ...s.milestones.filter((m) => !(m.bookingId === bookingId && m.key === 'cro_released')),
          { bookingId, key: 'cro_released', completedAt: now(), completedBy: 'MNR' },
        ],
        activities: log(s.activities, bookingId, 'MNR', 'CRO generated and issued'),
      }
    }),

  croPickup: (bookingId, containerNo) =>
    set((s) => ({
      cros: s.cros.map((c) =>
        c.bookingId === bookingId ? { ...c, status: 'Container picked up', containerNo } : c,
      ),
      bookings: s.bookings.map((b) =>
        b.id === bookingId ? { ...b, containerNos: [...b.containerNos, containerNo] } : b,
      ),
      milestones: [
        ...s.milestones.filter((m) => !(m.bookingId === bookingId && m.key === 'container_picked_up')),
        { bookingId, key: 'container_picked_up', completedAt: now(), completedBy: 'MNR' },
      ],
      containerActivities: {
        ...s.containerActivities,
        [bookingId]: (s.containerActivities[bookingId] ?? CONTAINER_ACTIVITY_DEFS.map((d) => ({ ...d, completedAt: null }))).map(
          (a) => (a.key === 'gate_out' ? { ...a, completedAt: now() } : a),
        ),
      },
      activities: log(s.activities, bookingId, 'MNR', `Container ${containerNo} picked up — gate-out logged`),
    })),

  saveBl: (bookingId, fields, actor, role) =>
    set((s) => {
      const existing = s.blStates.find((b) => b.bookingId === bookingId)
      const versions = s.blVersions.filter((v) => v.bookingId === bookingId)
      const version: BlVersion = {
        id: uid('blv'),
        bookingId,
        version: versions.length + 1,
        fields,
        editedBy: actor,
        editedByRole: role,
        editedAt: now(),
        amendment: existing?.lifecycle === 'Approved' || existing?.lifecycle === 'Released',
      }
      return {
        blVersions: [...s.blVersions, version],
        blStates: existing
          ? s.blStates.map((b) =>
              b.bookingId === bookingId ? { ...b, currentFields: fields, lifecycle: 'Edited' } : b,
            )
          : [...s.blStates, { bookingId, lifecycle: 'Draft', releaseType: null, currentFields: fields }],
        activities: log(s.activities, bookingId, actor, `BL draft v${version.version} saved (${role})`),
      }
    }),

  submitCustomerBlEdit: (bookingId, changes, actor) =>
    set((s) => {
      const booking = s.bookings.find((b) => b.id === bookingId)
      return {
        blStates: s.blStates.map((b) =>
          b.bookingId === bookingId ? { ...b, lifecycle: 'Awaiting approval' } : b,
        ),
        approvals: [
          {
            id: uid('ap'),
            entityType: 'bl_edit' as const,
            entityId: bookingId,
            bookingId,
            summary: `Customer edit on ${booking?.bookingRef ?? bookingId}: ${Object.keys(changes).join(', ')}`,
            requestedBy: actor,
            requestedAt: now(),
            status: 'Pending' as const,
            payload: changes,
          },
          ...s.approvals,
        ],
        activities: log(s.activities, bookingId, actor, 'BL edit submitted for approval'),
      }
    }),

  approveBl: (bookingId) =>
    set((s) => ({
      blStates: s.blStates.map((b) =>
        b.bookingId === bookingId ? { ...b, lifecycle: 'Approved' } : b,
      ),
      milestones: [
        ...s.milestones.filter((m) => !(m.bookingId === bookingId && m.key === 'bl_draft_approved')),
        { bookingId, key: 'bl_draft_approved', completedAt: now(), completedBy: 'Ops' },
      ],
      activities: log(s.activities, bookingId, 'Ops', 'BL approved and locked'),
    })),

  releaseBl: (bookingId, releaseType) =>
    set((s) => ({
      blStates: s.blStates.map((b) =>
        b.bookingId === bookingId ? { ...b, lifecycle: 'Released', releaseType } : b,
      ),
      milestones: [
        ...s.milestones.filter((m) => !(m.bookingId === bookingId && m.key === 'original_bl_released')),
        { bookingId, key: 'original_bl_released', completedAt: now(), completedBy: 'Ops' },
      ],
      activities: log(s.activities, bookingId, 'Ops', `BL released — ${releaseType}`),
    })),

  uploadDocument: (bookingId, docType, actor) =>
    set((s) => ({
      documents: [
        { id: uid('doc'), bookingId, docType, status: 'uploaded' as const, uploadedBy: actor, uploadedAt: now() },
        ...s.documents,
      ],
      activities: log(s.activities, bookingId, actor, `Document uploaded: ${docType}`),
    })),

  markContainerActivity: (bookingId, key) =>
    set((s) => ({
      containerActivities: {
        ...s.containerActivities,
        [bookingId]: (s.containerActivities[bookingId] ?? CONTAINER_ACTIVITY_DEFS.map((d) => ({ ...d, completedAt: null }))).map(
          (a) => (a.key === key ? { ...a, completedAt: now() } : a),
        ),
      },
      activities: log(s.activities, bookingId, 'Ops', `Container activity: ${key.replace(/_/g, ' ')}`),
    })),

  addCharge: (c) =>
    set((s) => ({ charges: [...s.charges, { ...c, id: uid('ch') }] })),

  removeCharge: (chargeId) =>
    set((s) => ({ charges: s.charges.filter((c) => c.id !== chargeId) })),

  generateInvoice: (bookingId, type, chargeIds) =>
    set((s) => {
      const lines = s.charges
        .filter((c) => chargeIds.includes(c.id))
        .map((c) => ({ chargeLineId: c.id, chargeName: c.chargeName, amount: c.amount, currency: c.currency }))
      if (lines.length === 0) return s
      const invoiceNo = `${type === 'AR' ? 'KLI' : 'KLB'}-25-${String(400 + s.invoices.length)}`
      const invoice: Invoice = {
        id: uid('inv'),
        invoiceNo,
        bookingId,
        type,
        status: 'Draft',
        lines,
        zohoInvoiceId: null,
        createdAt: now(),
      }
      return {
        invoices: [invoice, ...s.invoices],
        activities: log(s.activities, bookingId, 'Finance', `${type} ${type === 'AR' ? 'invoice' : 'vendor bill'} drafted — ${invoiceNo}`),
      }
    }),

  advanceInvoice: (invoiceId) =>
    set((s) => {
      const inv = s.invoices.find((i) => i.id === invoiceId)
      if (!inv) return s
      const idx = INVOICE_CHAIN.indexOf(inv.status)
      if (idx < 0 || idx === INVOICE_CHAIN.length - 1) return s
      const next = INVOICE_CHAIN[idx + 1]
      // Finance approval gate → approvals queue entry when moving to Pending approval
      const extra: Partial<DataState> = {}
      if (next === 'Pending approval') {
        extra.approvals = [
          {
            id: uid('ap'),
            entityType: 'invoice' as const,
            entityId: invoiceId,
            bookingId: inv.bookingId,
            summary: `${inv.type} ${inv.invoiceNo} awaiting finance approval`,
            requestedBy: 'Finance (auto)',
            requestedAt: now(),
            status: 'Pending' as const,
          },
          ...s.approvals,
        ]
      }
      return {
        ...extra,
        invoices: s.invoices.map((i) =>
          i.id === invoiceId
            ? { ...i, status: next, zohoInvoiceId: next === 'Zoho synced' ? `ZB-${Math.floor(Math.random() * 90000 + 10000)}` : i.zohoInvoiceId }
            : i,
        ),
        activities: log(s.activities, inv.bookingId, 'Finance', `Invoice ${inv.invoiceNo} → ${next}`),
      }
    }),

  /* ── MNR actions ─────────────────────────────────────────── */

  fleet: mockFleet,
  mnrJobs: mockMnrJobs,

  registerGateIn: (input) => {
    // Flow 1 gates: min 6 photos + signed EIR before gate-in can finalize
    if (input.gateInPhotos < 6 || !input.eirSigned) return null
    const s = get()
    const container = s.fleet.find((f) => f.containerNo === input.containerNo)
    const id = uid('mnr')
    const job: MnrJob = {
      id,
      containerId: container?.id ?? '',
      containerNo: input.containerNo,
      bookingRef: input.bookingRef,
      depotId: input.depotId,
      stage: 'Initial Inspection',
      ocrMatched: !!input.bookingRef,
      overrideReason: input.overrideReason,
      sealIntact: input.sealIntact,
      gateInPhotos: input.gateInPhotos,
      eirSigned: true,
      gateInAt: now(),
      checklist: INSPECTION_CHECKLIST.map((c) => ({ ...c, pass: null })),
      cleanliness: null,
      cscExpiringSoon: container
        ? new Date(container.cscExpiry).getTime() - Date.now() < 90 * 86400000
        : false,
      ptiPass: null,
      contamination: false,
      damagePoints: [],
      engineeringRequired: false,
      estimates: [],
      lessorNotified: false,
      progressPct: 0,
      materialsDeviation: false,
      additionalDamagePending: false,
      cscRecertDone: false,
      ptiRepeatDone: false,
      punchList: [],
      qcSignedOff: false,
      vendorBill: null,
      rootCause: null,
      debitNoteIssued: false,
      warrantyClaim: 'None',
      costClass: null,
      outcome: null,
    }
    set((st) => ({
      mnrJobs: [job, ...st.mnrJobs],
      fleet: container
        ? st.fleet.map((f) =>
            f.id === container.id ? { ...f, status: 'Hold', depotId: input.depotId, custodianBookingRef: null } : f,
          )
        : st.fleet,
      activities: log(
        st.activities,
        id,
        'Depot clerk',
        `Gate-in: ${input.containerNo}${input.bookingRef ? ` (booking ${input.bookingRef})` : ' (free-in)'}${
          input.sealIntact === false ? ' — SEAL BROKEN, cargo-claim event raised, priority inspection' : ''
        }${input.overrideReason ? ` — OCR override: ${input.overrideReason}` : ''} · EIR signed`,
      ),
    }))
    return id
  },

  setChecklistItem: (jobId, key, pass) =>
    set((s) => ({
      mnrJobs: s.mnrJobs.map((j) =>
        j.id === jobId
          ? { ...j, checklist: j.checklist.map((c) => (c.key === key ? { ...c, pass } : c)) }
          : j,
      ),
    })),

  completeInspection: (jobId, extra) =>
    set((s) => {
      const job = s.mnrJobs.find((j) => j.id === jobId)
      if (!job || job.checklist.some((c) => c.pass === null)) return s
      const allPass =
        job.checklist.every((c) => c.pass) && !extra.contamination && extra.ptiPass !== false
      if (allPass) {
        // Fast path — bypasses Survey/Estimate/Approval/Repair/QC entirely
        return {
          mnrJobs: s.mnrJobs.map((j) =>
            j.id === jobId ? { ...j, ...extra, stage: 'Closed', outcome: 'Available' } : j,
          ),
          fleet: s.fleet.map((f) =>
            f.id === job.containerId ? { ...f, status: 'Available' } : f,
          ),
          activities: log(s.activities, jobId, 'Depot Inspector', 'Initial inspection passed — fast path to Available Inventory'),
        }
      }
      return {
        mnrJobs: s.mnrJobs.map((j) =>
          j.id === jobId ? { ...j, ...extra, stage: 'Damage Survey' } : j,
        ),
        fleet: s.fleet.map((f) =>
          f.id === job.containerId ? { ...f, status: 'Under Repair' } : f,
        ),
        activities: log(
          s.activities,
          jobId,
          'Depot Inspector',
          `Inspection failed ${job.checklist.filter((c) => c.pass === false).length} item(s)${
            extra.contamination ? ' — contamination flag, allocation blocked' : ''
          }${extra.ptiPass === false ? ' — PTI FAIL, routed to reefer-specialist vendor' : ''} — routed to Damage Survey`,
        ),
      }
    }),

  addDamagePoint: (jobId, dp) =>
    set((s) => {
      if (dp.photos < 2) return s // min 2 photos per damage point (flow 2)
      return {
        mnrJobs: s.mnrJobs.map((j) =>
          j.id === jobId
            ? {
                ...j,
                damagePoints: [...j.damagePoints, { ...dp, id: uid('dp'), qcPass: null }],
                engineeringRequired: j.engineeringRequired || dp.severity === 'Structural',
              }
            : j,
        ),
        activities: log(s.activities, jobId, 'Surveyor', `Damage point: ${dp.panel} · ${dp.damageCode} · ${dp.severity}${dp.preExisting ? ' (pre-existing, already logged)' : ' (new damage)'}`),
      }
    }),

  completeSurvey: (jobId) =>
    set((s) => {
      const job = s.mnrJobs.find((j) => j.id === jobId)
      if (!job || job.damagePoints.length === 0) return s
      return {
        mnrJobs: s.mnrJobs.map((j) => (j.id === jobId ? { ...j, stage: 'Estimate' } : j)),
        activities: log(s.activities, jobId, 'Surveyor', `Digitally signed DSR generated — ${job.damagePoints.length} damage point(s)${job.engineeringRequired ? ' · Engineering sign-off flagged (structural)' : ''}`),
      }
    }),

  submitMnrEstimate: (jobId, est) =>
    set((s) => {
      const job = s.mnrJobs.find((j) => j.id === jobId)
      if (!job) return s
      const total = est.labour + est.material + est.tax
      const band = approverBand(total)
      const container = s.fleet.find((f) => f.id === job.containerId)
      const leased = container?.ownership !== 'Owned'
      const autoApproved = total < 300
      const version = job.estimates.length + 1
      const newEst: MnrEstimate = {
        version,
        vendorId: est.vendorId,
        labour: est.labour,
        material: est.material,
        tax: est.tax,
        total,
        validUntil: est.validUntil,
        revisionReason: est.revisionReason,
        status: autoApproved ? 'Auto-approved' : 'Submitted',
        approverBand: band,
      }
      const patch: Partial<DataState> = {
        mnrJobs: s.mnrJobs.map((j) =>
          j.id === jobId
            ? {
                ...j,
                estimates: [...j.estimates, newEst],
                stage: autoApproved ? 'Repair Execution' : 'Approval',
                lessorNotified: leased,
              }
            : j,
        ),
        activities: log(
          s.activities,
          jobId,
          'Vendor / Ops',
          `Estimate v${version} — $${total.toLocaleString()} → ${band}${job.engineeringRequired ? ' + Engineering' : ''}${leased ? ' + Lessor notified (48-hr SLA)' : ''}${est.revisionReason ? ` · revision: ${est.revisionReason}` : ''}`,
        ),
      }
      if (!autoApproved) {
        patch.approvals = [
          {
            id: uid('ap'),
            entityType: 'repair_estimate' as const,
            entityId: jobId,
            bookingId: null,
            summary: `Repair estimate ${job.containerNo} — $${total.toLocaleString()} (${band}${job.engineeringRequired ? ' + Engineering' : ''})`,
            requestedBy: 'MNR',
            requestedAt: now(),
            status: 'Pending' as const,
          },
          ...s.approvals,
        ]
      }
      return patch
    }),

  setRepairProgress: (jobId, pct, materialsDeviation) =>
    set((s) => ({
      mnrJobs: s.mnrJobs.map((j) =>
        j.id === jobId ? { ...j, progressPct: pct, materialsDeviation } : j,
      ),
      activities: materialsDeviation
        ? log(s.activities, jobId, 'System', 'Material usage deviation alert — exceeds approved BOM by >10%')
        : s.activities,
    })),

  submitAdditionalDamage: (jobId, amount, desc) =>
    set((s) => {
      const job = s.mnrJobs.find((j) => j.id === jobId)
      if (!job) return s
      return {
        mnrJobs: s.mnrJobs.map((j) => (j.id === jobId ? { ...j, additionalDamagePending: true } : j)),
        approvals: [
          {
            id: uid('ap'),
            entityType: 'repair_estimate' as const,
            entityId: `${jobId}:delta`,
            bookingId: null,
            summary: `Additional damage delta ${job.containerNo} — $${amount.toLocaleString()}: ${desc}`,
            requestedBy: 'Vendor (mid-repair)',
            requestedAt: now(),
            status: 'Pending' as const,
          },
          ...s.approvals,
        ],
        activities: log(s.activities, jobId, 'Vendor', `Additional Damage Request — $${amount.toLocaleString()} delta routed to Approval Engine (approved items continue in parallel)`),
      }
    }),

  vendorCompleteRepair: (jobId) =>
    set((s) => {
      const job = s.mnrJobs.find((j) => j.id === jobId)
      if (!job || job.progressPct < 100 || job.additionalDamagePending) return s
      return {
        mnrJobs: s.mnrJobs.map((j) => (j.id === jobId ? { ...j, stage: 'Quality Control' } : j)),
        activities: log(s.activities, jobId, 'Vendor', 'Repair complete — QC begins (independent inspector, system-enforced)'),
      }
    }),

  setQcLine: (jobId, dpId, pass) =>
    set((s) => ({
      mnrJobs: s.mnrJobs.map((j) =>
        j.id === jobId
          ? { ...j, damagePoints: j.damagePoints.map((d) => (d.id === dpId ? { ...d, qcPass: pass } : d)) }
          : j,
      ),
    })),

  qcRework: (jobId) =>
    set((s) => ({
      mnrJobs: s.mnrJobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              stage: 'Repair Execution',
              progressPct: 80,
              damagePoints: j.damagePoints.map((d) => (d.qcPass === false ? { ...d, qcPass: null } : d)),
            }
          : j,
      ),
      activities: log(s.activities, jobId, 'QC Inspector', 'QC FAIL on one or more lines — routed back to Repair Execution (vendor-liability flag, rework not billable)'),
    })),

  qcSignoff: (jobId, extra) =>
    set((s) => {
      const job = s.mnrJobs.find((j) => j.id === jobId)
      if (!job || job.damagePoints.some((d) => d.qcPass !== true)) return s
      return {
        mnrJobs: s.mnrJobs.map((j) =>
          j.id === jobId ? { ...j, ...extra, qcSignedOff: true, stage: 'Finance Posting' } : j,
        ),
        activities: log(
          s.activities,
          jobId,
          'QC Inspector',
          `QC sign-off (digital signature)${extra.cscRecertDone ? ' · CSC re-certified' : ''}${extra.ptiRepeatDone ? ' · repeat PTI passed' : ''}${extra.punchList.length ? ` · punch-list: ${extra.punchList.length} item(s), 5-day window` : ''}`,
        ),
      }
    }),

  postFinance: (jobId, fin) =>
    set((s) => {
      const job = s.mnrJobs.find((j) => j.id === jobId)
      if (!job) return s
      const est = latestEstimate(job)
      const approved = est?.total ?? 0
      const variancePct = approved > 0 ? ((fin.vendorBill - approved) / approved) * 100 : 0
      const overTolerance = Math.abs(variancePct) > 10
      const patch: Partial<DataState> = {
        mnrJobs: s.mnrJobs.map((j) => (j.id === jobId ? { ...j, ...fin } : j)),
        activities: log(
          s.activities,
          jobId,
          'Finance',
          `Vendor bill $${fin.vendorBill.toLocaleString()} matched vs approved $${approved.toLocaleString()} (${variancePct.toFixed(1)}%)${overTolerance ? ' — OVER TOLERANCE, routed to Approvals Queue' : ''} · ${fin.costClass} · root-cause ${fin.rootCause}${fin.warrantyClaim !== 'None' ? ` · warranty: ${fin.warrantyClaim}` : ''}`,
        ),
      }
      if (overTolerance) {
        patch.approvals = [
          {
            id: uid('ap'),
            entityType: 'invoice' as const,
            entityId: jobId,
            bookingId: null,
            summary: `MNR vendor bill variance ${job.containerNo} — billed $${fin.vendorBill.toLocaleString()} vs approved $${approved.toLocaleString()}`,
            requestedBy: 'Finance (auto)',
            requestedAt: now(),
            status: 'Pending' as const,
          },
          ...s.approvals,
        ]
      }
      return patch
    }),

  issueDebitNote: (jobId) =>
    set((s) => {
      const job = s.mnrJobs.find((j) => j.id === jobId)
      if (!job || job.rootCause !== 'Customer' || job.debitNoteIssued) return s
      const amount = job.vendorBill ?? latestEstimate(job)?.total ?? 0
      const invoiceNo = `KLDN-26-${String(100 + s.invoices.length)}`
      return {
        mnrJobs: s.mnrJobs.map((j) => (j.id === jobId ? { ...j, debitNoteIssued: true } : j)),
        invoices: [
          {
            id: uid('inv'),
            invoiceNo,
            bookingId: job.bookingRef ?? '',
            type: 'AR' as const,
            status: 'Draft' as const,
            lines: [{ chargeLineId: '', chargeName: `Damage recovery — ${job.containerNo} (DSR + photos attached)`, amount, currency: 'USD' as const }],
            zohoInvoiceId: null,
            createdAt: now(),
          },
          ...s.invoices,
        ],
        activities: log(s.activities, jobId, 'Ops/CS', `Customer debit note ${invoiceNo} confirmed and issued via shared Invoicing engine — $${amount.toLocaleString()}`),
      }
    }),

  closeMnrJob: (jobId, outcome) =>
    set((s) => {
      const job = s.mnrJobs.find((j) => j.id === jobId)
      if (!job) return s
      const statusMap: Record<MnrOutcome, FleetContainer['status']> = {
        Available: 'Available',
        'Off-Hire': 'Off Hire',
        Scrap: 'Scrapped',
      }
      return {
        mnrJobs: s.mnrJobs.map((j) => (j.id === jobId ? { ...j, stage: 'Closed', outcome } : j)),
        fleet: s.fleet.map((f) =>
          f.id === job.containerId ? { ...f, status: statusMap[outcome] } : f,
        ),
        activities: log(
          s.activities,
          jobId,
          'System',
          `MNR cycle closed — ${outcome}${outcome === 'Available' ? ' (returns to Empty Yard pool, feeds CRO allocation)' : outcome === 'Off-Hire' ? ' (redelivery certificate issued, lease closed)' : ' (de-registered, GL write-off posted)'} · immutable history entry appended`,
        ),
      }
    }),

  /* ── Freight Forwarding actions ──────────────────────────── */

  ffShipments: mockFfShipments,

  createFfShipment: (s, vendorLines) => {
    const st = get()
    const maxSeq = st.ffShipments.reduce((max, x) => {
      const m = x.ref.match(/^KINFF-(\d{4})/)
      return m ? Math.max(max, +m[1]) : max
    }, 30)
    const ref = `KINFF-${String(maxSeq + 1).padStart(4, '0')}`
    const id = ref
    // Flow 1 credit gate: over limit → held for Finance sign-off
    const creditHold = s.sellAmount > CREDIT_LIMIT_USD
    const shipment: FfShipment = {
      ...s,
      id,
      ref,
      stage: creditHold ? 'Booking' : 'Carrier & Pickup',
      creditHold,
      parentId: null,
      consolClosed: false,
      carrierName: '',
      linkedNvoccRef: null,
      rateReconfirmed: true,
      agentId: null,
      pickupProof: false,
      siReceived: false,
      weightVarianceFlagged: false,
      mblUploaded: false,
      houseDocStatus: 'None',
      houseDocVersion: 0,
      houseReleaseType: null,
      brokerAssigned: false,
      exportHold: false,
      letExportReceived: false,
      gateInDone: false,
      vgmDone: false,
      cutoffMet: null,
      departed: false,
      transhipmentLegs: 0,
      arrivalNoticeSent: false,
      importHold: false,
      outOfCharge: false,
      ddOutcome: null,
      doIssued: false,
      podCaptured: false,
      vendorLines: vendorLines.map((v) => ({ ...v, id: uid('fv'), billedAmount: null, varianceFlag: false })),
      clientInvoiced: false,
      paid: false,
      createdAt: now(),
    }
    set((state) => ({
      ffShipments: [shipment, ...state.ffShipments],
      approvals: creditHold
        ? [
            {
              id: uid('ap'),
              entityType: 'credit_hold' as const,
              entityId: id,
              bookingId: null,
              summary: `Credit clearance ${ref} — ${s.customerName} sell $${s.sellAmount.toLocaleString()} exceeds limit ($${CREDIT_LIMIT_USD.toLocaleString()})`,
              requestedBy: 'System (credit gate)',
              requestedAt: now(),
              status: 'Pending' as const,
            },
            ...state.approvals,
          ]
        : state.approvals,
      activities: log(
        state.activities,
        id,
        'BD/Ops',
        `FF booking ${ref} created (${s.mode})${creditHold ? ' — HELD: over credit limit, Finance sign-off required' : ''}${s.isConsolParent ? ' — LCL consolidation parent' : ''}`,
      ),
    }))
    return id
  },

  addChildHbl: (parentId, child) =>
    set((s) => {
      const parent = s.ffShipments.find((f) => f.id === parentId)
      if (!parent || parent.consolClosed) return s
      const childCount = s.ffShipments.filter((f) => f.parentId === parentId).length
      const ref = `${parent.ref}/H${childCount + 1}`
      const shipment: FfShipment = {
        ...parent,
        id: ref,
        ref,
        isConsolParent: false,
        parentId,
        customerId: child.customerId,
        customerName: child.customerName,
        sellAmount: child.sellAmount,
        vendorLines: [],
        creditHold: false,
        createdAt: now(),
      }
      return {
        ffShipments: [...s.ffShipments, shipment],
        activities: log(s.activities, parentId, 'Ops', `Child HBL ${ref} added — ${child.customerName} (manifest auto-updated)`),
      }
    }),

  closeConsolRun: (parentId) =>
    set((s) => {
      const parent = s.ffShipments.find((f) => f.id === parentId)
      const children = s.ffShipments.filter((f) => f.parentId === parentId)
      if (!parent || children.length === 0) return s
      // Container-level cost apportioned across child HBLs by revenue share
      const containerCost = buyTotal(parent)
      const totalSell = children.reduce((a, c) => a + c.sellAmount, 0) || 1
      return {
        ffShipments: s.ffShipments.map((f) => {
          if (f.id === parentId) return { ...f, consolClosed: true }
          if (f.parentId === parentId) {
            const share = Math.round(containerCost * (f.sellAmount / totalSell))
            return {
              ...f,
              vendorLines: [
                {
                  id: uid('fv'),
                  role: 'Carrier' as const,
                  vendorId: 'vn1',
                  vendorName: 'Apportioned container cost (by revenue share)',
                  buyAmount: share,
                  billedAmount: null,
                  varianceFlag: false,
                },
              ],
            }
          }
          return f
        }),
        activities: log(s.activities, parentId, 'Ops', `Consolidation run closed — $${containerCost.toLocaleString()} apportioned across ${children.length} child HBL(s); container milestones now apply to all`),
      }
    }),

  ffConfirmCarrier: (id, opts) =>
    set((s) => ({
      ffShipments: s.ffShipments.map((f) =>
        f.id === id ? { ...f, ...opts, rateReconfirmed: true } : f,
      ),
      activities: log(
        s.activities,
        id,
        'Ops',
        opts.linkedNvoccRef
          ? `Linked internally to NVOCC ${opts.linkedNvoccRef} as master — milestones auto-subscribe`
          : `External carrier confirmed: ${opts.carrierName} — booking confirmation uploaded`,
      ),
    })),

  ffPickupComplete: (id) =>
    set((s) => ({
      ffShipments: s.ffShipments.map((f) =>
        f.id === id ? { ...f, pickupProof: true, stage: 'Documentation' } : f,
      ),
      activities: log(s.activities, id, 'Transporter', 'Cargo collected — signed proof of collection logged as milestone'),
    })),

  ffDocAction: (id, action, releaseType) =>
    set((s) => {
      const f = s.ffShipments.find((x) => x.id === id)
      if (!f) return s
      let patchS: Partial<FfShipment> = {}
      let msg = ''
      switch (action) {
        case 'si_received':
          patchS = { siReceived: true }
          msg = 'Shipping Instructions received — completeness checked'
          break
        case 'weight_variance':
          patchS = { weightVarianceFlagged: true }
          msg = 'Weight/measure variance vs cargo receipt beyond tolerance — Ops sign-off required'
          break
        case 'mbl_uploaded':
          patchS = { mblUploaded: true }
          msg = 'Master document (MBL/MAWB) received from carrier and uploaded'
          break
        case 'draft_house':
          patchS = { houseDocStatus: 'Draft', houseDocVersion: f.houseDocVersion + 1 }
          msg = `House ${f.mode === 'Air' ? 'AWB' : 'BL'} auto-drafted from SI + booking data (governed fields, clause library) — v${f.houseDocVersion + 1}`
          break
        case 'customer_edit':
          patchS = { houseDocStatus: 'Awaiting approval' }
          msg = 'Customer edit on governed fields — routed to Ops Approval Queue'
          break
        case 'release':
          patchS = { houseDocStatus: 'Released', houseReleaseType: releaseType ?? 'Original', stage: 'Export & Transit' }
          msg = `House document RELEASED (${releaseType}) — locked; further edits need a formal Amendment`
          break
      }
      const extra: Partial<DataState> = {}
      if (action === 'customer_edit') {
        extra.approvals = [
          {
            id: uid('ap'),
            entityType: 'bl_edit' as const,
            entityId: `ff:${id}`,
            bookingId: null,
            summary: `FF house-doc customer edit on ${f.ref} (governed fields)`,
            requestedBy: f.customerName,
            requestedAt: now(),
            status: 'Pending' as const,
          },
          ...s.approvals,
        ]
      }
      return {
        ...extra,
        ffShipments: s.ffShipments.map((x) => (x.id === id ? { ...x, ...patchS } : x)),
        activities: log(s.activities, id, 'Ops', msg),
      }
    }),

  ffExportAction: (id, action) =>
    set((s) => {
      const f = s.ffShipments.find((x) => x.id === id)
      if (!f) return s
      let patchS: Partial<FfShipment> = {}
      let msg = ''
      switch (action) {
        case 'broker':
          patchS = { brokerAssigned: true }
          msg = 'Customs broker assigned — shipping bill / export declaration filed before cut-off'
          break
        case 'hold':
          patchS = { exportHold: true }
          msg = 'EXPORT CUSTOMS HOLD — Ops + customer notified'
          break
        case 'resolve_hold':
          patchS = { exportHold: false }
          msg = 'Export hold resolved with broker'
          break
        case 'let_export':
          patchS = { letExportReceived: true }
          msg = '"Let Export Order" / export clearance received'
          break
        case 'gate_in_vgm':
          patchS = { gateInDone: true, vgmDone: true }
          msg = f.mode === 'Air' ? 'Cargo tendered to airline — final SI/chargeable weight submitted' : 'Gate-in done — VGM submitted with final SI before carrier cut-off'
          break
        case 'cutoff_met':
          patchS = { cutoffMet: true }
          msg = 'Cut-off met — on schedule'
          break
        case 'cutoff_missed':
          patchS = { cutoffMet: false }
          msg = 'CUT-OFF MISSED — delay flag raised, re-plan to next sailing/flight'
          break
        case 'depart':
          patchS = { departed: true, cutoffMet: true, stage: 'Arrival & Delivery' }
          msg = 'Departed — SOB/uplift confirmation received, notation added to released house document; in-transit vs ETA'
          break
      }
      return {
        ffShipments: s.ffShipments.map((x) => (x.id === id ? { ...x, ...patchS } : x)),
        activities: log(s.activities, id, 'Ops', msg),
      }
    }),

  ffArrivalAction: (id, action) =>
    set((s) => {
      const f = s.ffShipments.find((x) => x.id === id)
      if (!f) return s
      let patchS: Partial<FfShipment> = {}
      let msg = ''
      switch (action) {
        case 'arrival_notice':
          patchS = { arrivalNoticeSent: true }
          msg = 'Arrival Notice auto-generated → consignee/notify party; destination agent takes over'
          break
        case 'import_hold':
          patchS = { importHold: true }
          msg = 'IMPORT CUSTOMS HOLD — Ops + customer notified'
          break
        case 'resolve_hold':
          patchS = { importHold: false }
          msg = 'Import hold resolved with broker'
          break
        case 'out_of_charge':
          patchS = { outOfCharge: true }
          msg = 'Bill of Entry filed, duty paid — "Out of Charge" customs release confirmed'
          break
        case 'dd_customer':
          patchS = { ddOutcome: 'Customer-billed' }
          msg = 'Free time exceeded — D&D charge auto-drafted, customer-caused → billed to customer'
          break
        case 'dd_absorbed':
          patchS = { ddOutcome: 'Absorbed' }
          msg = 'Free time exceeded — carrier/Kinetic-caused → absorbed as operational cost'
          break
        case 'dd_none':
          patchS = { ddOutcome: 'None' }
          msg = 'Gate-out within free time — no D&D exposure'
          break
        case 'issue_do':
          patchS = { doIssued: true }
          msg = 'Delivery Order issued — last-mile transport dispatched'
          break
        case 'pod':
          patchS = { podCaptured: true, stage: 'Financial Close' }
          msg = 'POD (signature/photo) captured — booking status → Delivered; financial closure begins'
          break
      }
      return {
        ffShipments: s.ffShipments.map((x) => (x.id === id ? { ...x, ...patchS } : x)),
        activities: log(s.activities, id, 'Agent/Ops', msg),
      }
    }),

  ffInvoiceClient: (id) =>
    set((s) => {
      const f = s.ffShipments.find((x) => x.id === id)
      if (!f || f.clientInvoiced) return s
      const invoiceNo = `KLI-26-${String(500 + s.invoices.length)}`
      return {
        ffShipments: s.ffShipments.map((x) => (x.id === id ? { ...x, clientInvoiced: true } : x)),
        invoices: [
          {
            id: uid('inv'),
            invoiceNo,
            bookingId: id,
            type: 'AR' as const,
            status: 'Draft' as const,
            lines: [{ chargeLineId: '', chargeName: `FF consolidated sell — ${f.ref} (${f.origin} → ${f.destination})`, amount: f.sellAmount, currency: 'USD' as const }],
            zohoInvoiceId: null,
            createdAt: now(),
          },
          ...s.invoices,
        ],
        activities: log(s.activities, id, 'Finance', `Client invoice ${invoiceNo} raised off consolidated sell — $${f.sellAmount.toLocaleString()}`),
      }
    }),

  ffMatchVendorBill: (id, lineId, billedAmount) =>
    set((s) => {
      const f = s.ffShipments.find((x) => x.id === id)
      const line = f?.vendorLines.find((v) => v.id === lineId)
      if (!f || !line) return s
      const flag = overTolerance(line.buyAmount, billedAmount)
      const extra: Partial<DataState> = {}
      if (flag) {
        extra.approvals = [
          {
            id: uid('ap'),
            entityType: 'invoice' as const,
            entityId: `${id}:${lineId}`,
            bookingId: null,
            summary: `FF vendor bill variance ${f.ref} — ${line.vendorName} billed $${billedAmount.toLocaleString()} vs booked $${line.buyAmount.toLocaleString()}`,
            requestedBy: 'Finance (auto)',
            requestedAt: now(),
            status: 'Pending' as const,
          },
          ...s.approvals,
        ]
      }
      return {
        ...extra,
        ffShipments: s.ffShipments.map((x) =>
          x.id === id
            ? { ...x, vendorLines: x.vendorLines.map((v) => (v.id === lineId ? { ...v, billedAmount, varianceFlag: flag } : v)) }
            : x,
        ),
        activities: log(s.activities, id, 'Finance', `Vendor bill matched — ${line.vendorName}: $${billedAmount.toLocaleString()} vs booked $${line.buyAmount.toLocaleString()}${flag ? ' — OVER TOLERANCE, routed to Approvals Queue before posting' : ' — posted as AP'}`),
      }
    }),

  ffMarkPaid: (id) =>
    set((s) => ({
      ffShipments: s.ffShipments.map((x) => (x.id === id ? { ...x, paid: true } : x)),
      activities: log(s.activities, id, 'Finance', 'Client payment received in full — marked Paid'),
    })),

  ffFinancialClose: (id) =>
    set((s) => {
      const f = s.ffShipments.find((x) => x.id === id)
      if (!f) return s
      const allMatched = f.vendorLines.length > 0 && f.vendorLines.every((v) => v.billedAmount !== null)
      if (!f.paid || !allMatched) return s
      return {
        ffShipments: s.ffShipments.map((x) => (x.id === id ? { ...x, stage: 'Closed' } : x)),
        activities: log(s.activities, id, 'Finance', 'Every vendor bill matched — P&L flipped to Actual GP; booking marked Financially Closed'),
      }
    }),

  /* ── Customer Management actions ─────────────────────────── */

  customers: mockCustomerRecords,

  updateCustomer: (id, patch, auditNote) =>
    set((s) => {
      const next = s.customers.map((c) => {
        if (c.id !== id) return c
        const merged = { ...c, ...patch }
        // §8.1 onboarding gate: all four conditions met → auto-flip to Active
        if (
          merged.status === 'Prospect' &&
          merged.kycDocs.length > 0 &&
          merged.kycDocs.every((d) => d.verified) &&
          merged.screening === 'Clear' &&
          (merged.creditApproved || merged.cashInAdvanceOnly) &&
          merged.salesSignoff
        ) {
          merged.status = 'Active'
        }
        return merged
      })
      const flipped =
        s.customers.find((c) => c.id === id)?.status === 'Prospect' &&
        next.find((c) => c.id === id)?.status === 'Active'
      let acts = log(s.activities, id, 'Admin', auditNote)
      if (flipped) acts = log(acts, id, 'System', 'All four onboarding conditions met — status auto-flipped Prospect → Active')
      return { customers: next, activities: acts }
    }),

  requestCreditLimit: (id, amount) =>
    set((s) => {
      const c = s.customers.find((x) => x.id === id)
      if (!c) return s
      return {
        customers: s.customers.map((x) => (x.id === id ? { ...x, pendingCreditRequest: amount } : x)),
        approvals: [
          {
            id: uid('ap'),
            entityType: 'credit_hold' as const,
            entityId: `cust:${id}:credit`,
            bookingId: null,
            summary: `Credit limit ${c.code} ${c.legalName} — $${amount.toLocaleString()} requested (Finance approval matrix)`,
            requestedBy: 'Admin',
            requestedAt: now(),
            status: 'Pending' as const,
          },
          ...s.approvals,
        ],
        activities: log(s.activities, id, 'Admin', `Credit limit $${amount.toLocaleString()} requested — routed through Finance approval matrix`),
      }
    }),

  requestBlacklist: (id, reason) =>
    set((s) => {
      const c = s.customers.find((x) => x.id === id)
      if (!c) return s
      return {
        approvals: [
          {
            id: uid('ap'),
            entityType: 'blacklist' as const,
            entityId: `cust:${id}:blacklist`,
            bookingId: null,
            summary: `Blacklist ${c.code} ${c.legalName} — reason: ${reason} (requires Regional Head)`,
            requestedBy: 'Admin',
            requestedAt: now(),
            status: 'Pending' as const,
          },
          ...s.approvals,
        ],
        customers: s.customers.map((x) => (x.id === id ? { ...x, blacklistReason: reason } : x)),
        activities: log(s.activities, id, 'Admin', `Blacklist requested — reason: ${reason}; two-person gate, Regional Head approval pending`),
      }
    }),

  requestBlacklistReversal: (id) =>
    set((s) => {
      const c = s.customers.find((x) => x.id === id)
      if (!c) return s
      return {
        approvals: [
          {
            id: uid('ap'),
            entityType: 'blacklist' as const,
            entityId: `cust:${id}:reverse`,
            bookingId: null,
            summary: `Blacklist REVERSAL ${c.code} ${c.legalName} — requires same Regional Head level`,
            requestedBy: 'Admin',
            requestedAt: now(),
            status: 'Pending' as const,
          },
          ...s.approvals,
        ],
        activities: log(s.activities, id, 'Admin', 'Blacklist reversal requested — logged separately from original decision'),
      }
    }),

  /* ── Agent Management actions ────────────────────────────── */

  agents: mockAgentRecords,

  updateAgent: (id, patch, auditNote) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      activities: log(s.activities, id, 'Admin', auditNote),
    })),

  requestAgentActivation: (id) =>
    set((s) => {
      const a = s.agents.find((x) => x.id === id)
      if (!a || a.status !== 'Prospect') return s
      return {
        agents: s.agents.map((x) => (x.id === id ? { ...x, activationRequested: true } : x)),
        approvals: [
          {
            id: uid('ap'),
            entityType: 'agent_gate' as const,
            entityId: `agt:${id}:onboard`,
            bookingId: null,
            summary: `Agent onboarding ${a.code} ${a.legalName} (${a.direction}) — Regional Head approval to activate`,
            requestedBy: 'Admin',
            requestedAt: now(),
            status: 'Pending' as const,
          },
          ...s.approvals,
        ],
        activities: log(s.activities, id, 'Admin', 'Onboarding submitted — Regional Head review (higher bar than customer onboarding: Active grants booking/document rights)'),
      }
    }),

  requestCommissionChange: (id, description) =>
    set((s) => {
      const a = s.agents.find((x) => x.id === id)
      if (!a) return s
      return {
        agents: s.agents.map((x) => (x.id === id ? { ...x, pendingCommissionChange: description } : x)),
        approvals: [
          {
            id: uid('ap'),
            entityType: 'agent_gate' as const,
            entityId: `agt:${id}:commission`,
            bookingId: null,
            summary: `Commission change ${a.code} ${a.legalName} — ${description} (Finance Head approval)`,
            requestedBy: 'Admin',
            requestedAt: now(),
            status: 'Pending' as const,
          },
          ...s.approvals,
        ],
        activities: log(s.activities, id, 'Admin', `Commission change proposed on Active agent: ${description} — Finance Head approval required`),
      }
    }),

  suspendAgent: (id, reason) =>
    set((s) => ({
      // Deliberately fast — single Ops Manager action, no queue (risk containment)
      agents: s.agents.map((a) =>
        a.id === id ? { ...a, status: 'Suspended', createBooking: false, blEdit: 'None' } : a,
      ),
      activities: log(s.activities, id, 'Ops Manager', `SUSPENDED (immediate) — ${reason}; booking-creation and BL-edit rights revoked instantly, in-flight bookings continue`),
    })),

  clearAgentSuspension: (id) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, status: 'Active' } : a)),
      activities: log(s.activities, id, 'Ops Manager', 'Investigation cleared — status returns to Active (permissions to be re-granted deliberately)'),
    })),

  requestAgentTermination: (id) =>
    set((s) => {
      const a = s.agents.find((x) => x.id === id)
      if (!a) return s
      // §9.2 settlement gate: SOA must be zero/reconciled before termination can even be requested
      if (a.soaBalanceUsd !== 0) {
        return {
          activities: log(s.activities, id, 'System', `Termination BLOCKED — Agency SOA balance $${a.soaBalanceUsd.toLocaleString()} must be zero/reconciled in both directions first`),
        }
      }
      return {
        approvals: [
          {
            id: uid('ap'),
            entityType: 'agent_gate' as const,
            entityId: `agt:${id}:terminate`,
            bookingId: null,
            summary: `Termination ${a.code} ${a.legalName} — SOA settled; Regional Head + Finance dual sign-off`,
            requestedBy: 'Admin',
            requestedAt: now(),
            status: 'Pending' as const,
          },
          ...s.approvals,
        ],
        activities: log(s.activities, id, 'Admin', 'Termination requested — settlement confirmed; Regional Head + Finance sign-off pending'),
      }
    }),

  /* ── HR actions ──────────────────────────────────────────── */

  employees: mockEmployees,
  leaveRequests: mockLeaveRequests,
  payrollRuns: mockPayrollRuns,

  updateEmployee: (id, patch, auditNote) =>
    set((s) => ({
      employees: s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      activities: log(s.activities, id, 'HR', auditNote),
    })),

  requestLeave: (input) =>
    set((s) => {
      const emp = s.employees.find((e) => e.id === input.employeeId)
      if (!emp) return s
      const days = daysBetween(input.from, input.to)
      if (days <= 0) return s
      const req: LeaveRequest = {
        id: uid('lv'),
        employeeId: emp.id,
        employeeName: emp.name,
        type: input.type,
        from: input.from,
        to: input.to,
        days,
        reason: input.reason,
        medicalCert: input.medicalCert,
        status: 'Pending',
        lopDays: 0,
        requestedAt: now(),
      }
      const bal = balanceFor(emp, input.type)
      const short = input.type === 'Loss of Pay' ? 0 : Math.max(0, days - bal)
      return {
        leaveRequests: [req, ...s.leaveRequests],
        approvals: [
          {
            id: uid('ap'),
            entityType: 'leave_request' as const,
            entityId: `emp:${emp.id}:leave:${req.id}`,
            bookingId: null,
            summary: `Leave — ${emp.name}: ${days}d ${input.type} (${input.from} → ${input.to})${short > 0 ? ` — balance short by ${short}d, excess converts to LOP` : ''}${input.medicalCert ? ' · medical cert attached' : ''}`,
            requestedBy: emp.name,
            requestedAt: now(),
            status: 'Pending' as const,
          },
          ...s.approvals,
        ],
        activities: log(s.activities, emp.id, emp.name, `Leave requested: ${days}d ${input.type} (${input.from} → ${input.to}) — routed to manager approval`),
      }
    }),

  cancelLeave: (requestId) =>
    set((s) => {
      const req = s.leaveRequests.find((r) => r.id === requestId)
      if (!req || req.status !== 'Pending') return s
      return {
        leaveRequests: s.leaveRequests.map((r) => (r.id === requestId ? { ...r, status: 'Cancelled' } : r)),
        approvals: s.approvals.map((a) =>
          a.entityId === `emp:${req.employeeId}:leave:${requestId}` && a.status === 'Pending'
            ? { ...a, status: 'Rejected' }
            : a,
        ),
        activities: log(s.activities, req.employeeId, req.employeeName, 'Leave request cancelled by employee'),
      }
    }),

  confirmProbation: (id) =>
    set((s) => ({
      employees: s.employees.map((e) =>
        e.id === id && e.status === 'Probation'
          ? { ...e, status: 'Active', probationEndsAt: null, leave: { ...e.leave, earned: { ...e.leave.earned, entitled: 15 } } }
          : e,
      ),
      activities: log(s.activities, id, 'HR', 'Probation confirmed — status → Active; earned-leave accrual (15/yr) begins'),
    })),

  startNotice: (id, lastDay) =>
    set((s) => ({
      employees: s.employees.map((e) =>
        e.id === id ? { ...e, status: 'On Notice', noticeEndsAt: lastDay } : e,
      ),
      activities: log(s.activities, id, 'HR', `Resignation accepted — On Notice, last working day ${lastDay}; exit clearance checklist opened`),
    })),

  setExitClearance: (id, key) =>
    set((s) => ({
      employees: s.employees.map((e) =>
        e.id === id ? { ...e, exitClearance: { ...e.exitClearance, [key]: true } } : e,
      ),
      activities: log(s.activities, id, 'HR', `Exit clearance: ${key === 'handover' ? 'knowledge handover complete' : key === 'assetsReturned' ? 'assets returned' : 'final settlement processed (incl. earned-leave encashment)'}`),
    })),

  completeExit: (id) =>
    set((s) => {
      const e = s.employees.find((x) => x.id === id)
      if (!e) return s
      const c = e.exitClearance
      // Exit gate mirrors the platform's settlement-gated closures
      if (!c.handover || !c.assetsReturned || !c.financeSettled) {
        return {
          activities: log(s.activities, id, 'System', 'Exit BLOCKED — handover, asset return and final settlement must all complete first'),
        }
      }
      return {
        employees: s.employees.map((x) => (x.id === id ? { ...x, status: 'Exited' } : x)),
        activities: log(s.activities, id, 'HR', 'Exited — record retained for audit; platform access revoked'),
      }
    }),

  decideApproval: (approvalId, decision) =>
    set((s) => {
      const ap = s.approvals.find((a) => a.id === approvalId)
      if (!ap || ap.status !== 'Pending') return s
      let patch: Partial<DataState> = {}
      const done = () => ({
        ...patch,
        approvals: s.approvals.map((a) => (a.id === approvalId ? { ...a, status: decision } : a)),
      })
      // HR leave approvals (entityId emp:{id}:leave:{reqId})
      if (ap.entityId.startsWith('emp:') && ap.entityType === 'leave_request') {
        const [, empId, , reqId] = ap.entityId.split(':')
        const req = s.leaveRequests.find((r) => r.id === reqId)
        const emp = s.employees.find((e) => e.id === empId)
        if (!req || !emp) return done()
        if (decision === 'Approved') {
          const bal = balanceFor(emp, req.type)
          const paidDays = req.type === 'Loss of Pay' ? 0 : Math.min(req.days, bal)
          const lopDays = req.type === 'Loss of Pay' ? req.days : req.days - paidDays
          const key = req.type === 'Casual' ? 'casual' : req.type === 'Sick' ? 'sick' : 'earned'
          patch = {
            leaveRequests: s.leaveRequests.map((r) => (r.id === reqId ? { ...r, status: 'Approved', lopDays } : r)),
            employees:
              req.type === 'Loss of Pay'
                ? s.employees
                : s.employees.map((e) =>
                    e.id === empId
                      ? { ...e, leave: { ...e.leave, [key]: { ...e.leave[key], used: e.leave[key].used + paidDays } } }
                      : e,
                  ),
            activities: log(
              s.activities, empId, 'Manager',
              `Leave approved: ${req.days}d ${req.type}${lopDays > 0 ? ` (${lopDays}d as LOP — flows to payroll deduction)` : ''}`,
            ),
          }
        } else {
          patch = {
            leaveRequests: s.leaveRequests.map((r) => (r.id === reqId ? { ...r, status: 'Rejected' } : r)),
            activities: log(s.activities, empId, 'Manager', `Leave rejected: ${req.days}d ${req.type}`),
          }
        }
        return done()
      }
      // Agent Management approvals (entityId agt:{id}:{kind})
      if (ap.entityId.startsWith('agt:')) {
        const [, agtId, kind] = ap.entityId.split(':')
        if (kind === 'onboard') {
          patch = {
            agents: s.agents.map((a) =>
              a.id === agtId
                ? decision === 'Approved'
                  ? { ...a, status: 'Active', activationRequested: false }
                  : { ...a, activationRequested: false }
                : a,
            ),
            activities: log(
              s.activities, agtId, 'Regional Head',
              decision === 'Approved' ? 'Onboarding approved — status → Active' : 'Onboarding rejected — terms/documentation to be revised and resubmitted',
            ),
          }
        } else if (kind === 'commission') {
          patch = {
            agents: s.agents.map((a) =>
              a.id === agtId ? { ...a, pendingCommissionChange: null } : a,
            ),
            activities: log(
              s.activities, agtId, 'Finance Head',
              decision === 'Approved'
                ? 'Commission change approved — new terms apply going forward, prior terms retained for historical SOA reference'
                : 'Commission change rejected — proposal to be revised',
            ),
          }
        } else if (kind === 'terminate') {
          patch = {
            agents: s.agents.map((a) =>
              a.id === agtId && decision === 'Approved'
                ? { ...a, status: 'Terminated', portalEnabled: false, createBooking: false, blEdit: 'None' }
                : a,
            ),
            activities: log(
              s.activities, agtId, 'Regional Head + Finance',
              decision === 'Approved'
                ? 'TERMINATED — forward-looking access cut (portal, new bookings); historical bookings/documents remain permanently queryable'
                : 'Termination declined — status stands, decision revisited',
            ),
          }
        }
        return done()
      }
      // Customer Management approvals (entityId cust:{id}:{kind})
      if (ap.entityId.startsWith('cust:')) {
        const [, custId, kind] = ap.entityId.split(':')
        if (kind === 'credit') {
          patch = {
            customers: s.customers.map((c) => {
              if (c.id !== custId) return c
              if (decision === 'Approved') {
                return {
                  ...c,
                  creditLimit: c.pendingCreditRequest ?? c.creditLimit,
                  creditApproved: true,
                  cashInAdvanceOnly: false,
                  pendingCreditRequest: null,
                }
              }
              return { ...c, pendingCreditRequest: null }
            }),
            activities: log(
              s.activities, custId, 'Finance',
              decision === 'Approved'
                ? 'Credit limit approved — change logged, cross-referenced to Finance approval record'
                : 'Credit limit rejected — proposed limit to be revised and resubmitted',
            ),
          }
        } else if (kind === 'blacklist') {
          patch = {
            customers: s.customers.map((c) =>
              c.id === custId && decision === 'Approved'
                ? { ...c, status: 'Blacklisted', portalEnabled: false }
                : c,
            ),
            activities: log(
              s.activities, custId, 'Regional Head',
              decision === 'Approved'
                ? 'Blacklist approved — all new quotes/bookings/portal access blocked; open bookings flagged for manual Ops review'
                : 'Blacklist declined — customer remains Active, request logged',
            ),
          }
        } else if (kind === 'reverse') {
          patch = {
            customers: s.customers.map((c) =>
              c.id === custId && decision === 'Approved'
                ? { ...c, status: 'Active', blacklistReason: null }
                : c,
            ),
            activities: log(
              s.activities, custId, 'Regional Head',
              decision === 'Approved' ? 'Blacklist reversed — status returns to Active' : 'Reversal declined — status stands',
            ),
          }
        }
        return done()
      }
      if (ap.entityType === 'credit_hold') {
        patch = {
          ffShipments: s.ffShipments.map((f) =>
            f.id === ap.entityId
              ? decision === 'Approved'
                ? { ...f, creditHold: false, stage: 'Carrier & Pickup' }
                : { ...f, stage: 'Closed' }
              : f,
          ),
          activities: log(s.activities, ap.entityId, 'Finance', decision === 'Approved' ? 'Credit hold cleared by Finance — booking proceeds' : 'Credit declined — booking closed'),
        }
        return {
          ...patch,
          approvals: s.approvals.map((a) => (a.id === approvalId ? { ...a, status: decision } : a)),
        }
      }
      if (ap.entityType === 'bl_edit' && ap.entityId.startsWith('ff:')) {
        const ffId = ap.entityId.slice(3)
        patch = {
          ffShipments: s.ffShipments.map((f) =>
            f.id === ffId
              ? decision === 'Approved'
                ? { ...f, houseDocStatus: 'Draft', houseDocVersion: f.houseDocVersion + 1 }
                : { ...f, houseDocStatus: 'Draft' }
              : f,
          ),
          activities: log(s.activities, ffId, 'Ops', decision === 'Approved' ? 'Customer house-doc edit approved — version logged' : 'Customer house-doc edit rejected — reason sent to customer'),
        }
        return {
          ...patch,
          approvals: s.approvals.map((a) => (a.id === approvalId ? { ...a, status: decision } : a)),
        }
      }
      if (ap.entityType === 'repair_estimate') {
        const isDelta = ap.entityId.endsWith(':delta')
        const jobId = isDelta ? ap.entityId.split(':')[0] : ap.entityId
        if (decision === 'Approved') {
          patch = {
            mnrJobs: s.mnrJobs.map((j) => {
              if (j.id !== jobId) return j
              if (isDelta) return { ...j, additionalDamagePending: false }
              return {
                ...j,
                stage: 'Repair Execution',
                estimates: j.estimates.map((e, i) =>
                  i === j.estimates.length - 1 ? { ...e, status: 'Approved' } : e,
                ),
              }
            }),
            activities: log(s.activities, jobId, 'Approver', isDelta ? 'Additional damage delta approved — work order updated' : 'Estimate approved — work order auto-generated, sent to vendor'),
          }
        } else {
          patch = {
            mnrJobs: s.mnrJobs.map((j) => {
              if (j.id !== jobId) return j
              if (isDelta) return { ...j, additionalDamagePending: false }
              return {
                ...j,
                stage: 'Estimate',
                estimates: j.estimates.map((e, i) =>
                  i === j.estimates.length - 1 ? { ...e, status: 'Rejected' } : e,
                ),
              }
            }),
            activities: log(s.activities, jobId, 'Approver', isDelta ? 'Additional damage delta rejected' : 'Estimate rejected — loops back to vendor for re-quote'),
          }
        }
        return {
          ...patch,
          approvals: s.approvals.map((a) => (a.id === approvalId ? { ...a, status: decision } : a)),
        }
      }
      if (decision === 'Approved') {
        if (ap.entityType === 'bl_edit' && ap.bookingId && ap.payload) {
          patch = {
            blStates: s.blStates.map((b) =>
              b.bookingId === ap.bookingId
                ? { ...b, lifecycle: 'Approved', currentFields: { ...b.currentFields, ...ap.payload } }
                : b,
            ),
            blVersions: [
              ...s.blVersions,
              {
                id: uid('blv'),
                bookingId: ap.bookingId,
                version: s.blVersions.filter((v) => v.bookingId === ap.bookingId).length + 1,
                fields: {
                  ...(s.blStates.find((b) => b.bookingId === ap.bookingId)?.currentFields as BlFields),
                  ...ap.payload,
                },
                editedBy: ap.requestedBy,
                editedByRole: 'customer',
                editedAt: now(),
                amendment: false,
              },
            ],
          }
        } else if (ap.entityType === 'invoice') {
          patch = {
            invoices: s.invoices.map((i) =>
              i.id === ap.entityId && i.status === 'Pending approval' ? { ...i, status: 'Approved' } : i,
            ),
          }
        } else if (ap.entityType === 'quote') {
          patch = {
            quotes: s.quotes.map((q) => (q.id === ap.entityId ? { ...q, status: 'Sent' } : q)),
          }
        }
      } else if (ap.entityType === 'bl_edit' && ap.bookingId) {
        patch = {
          blStates: s.blStates.map((b) =>
            b.bookingId === ap.bookingId ? { ...b, lifecycle: 'Edited' } : b,
          ),
        }
      }
      return {
        ...patch,
        approvals: s.approvals.map((a) => (a.id === approvalId ? { ...a, status: decision } : a)),
        activities: ap.bookingId
          ? log(s.activities, ap.bookingId, 'Ops', `Approval ${decision.toLowerCase()}: ${ap.summary}`)
          : s.activities,
      }
    }),
}))
