/* ── Session data store ──────────────────────────────────────────
   The interactive mock backend. All workflow mutations live here,
   mirroring the actions the Supabase layer will expose later.
   State resets on refresh (same contract as the v5 prototype).  */

import { create } from 'zustand'
import type {
  ActivityEntry,
  Approval,
  BlFields,
  BlState,
  BlVersion,
  Booking,
  BookingDocument,
  ChargeLine,
  ContainerActivity,
  CroDocument,
  DamagePoint,
  FleetContainer,
  Invoice,
  InvoiceStatus,
  Lead,
  MilestoneEntry,
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
        bookings: s.bookings.map((x) => (x.id === bookingId ? { ...x, cancelled: true } : x)),
        activities: log(s.activities, bookingId, 'Ops', `Booking cancelled — reason: ${reason}`),
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

  decideApproval: (approvalId, decision) =>
    set((s) => {
      const ap = s.approvals.find((a) => a.id === approvalId)
      if (!ap || ap.status !== 'Pending') return s
      let patch: Partial<DataState> = {}
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
