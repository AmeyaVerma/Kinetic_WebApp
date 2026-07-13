/* ── MOCK DATA ──────────────────────────────────────────────────
   ⚠ Everything in src/mocks/ is throwaway demo data.
   Components never import from here directly — they go through
   the data store / lib/api, the single swap point for Supabase. */

import type {
  ActivityEntry,
  Approval,
  BlState,
  BlVersion,
  Booking,
  BookingDocument,
  ChargeLine,
  ContainerActivity,
  CroDocument,
  DashboardData,
  Invoice,
  Lead,
  MilestoneEntry,
  Quote,
} from '../lib/types'

/* ── Bookings — REAL data from the Business Solution CSV ─────── */

import { nvoccBookings, nvoccMilestones } from './nvoccSeed'

export const mockBookings: Booking[] = nvoccBookings
export const mockMilestones: MilestoneEntry[] = nvoccMilestones


/* ── Charges ─────────────────────────────────────────────────── */

export const mockCharges: ChargeLine[] = [
  { id: 'ch1', bookingId: 'KLNVO2627000009', chargeCodeId: 'cc1', chargeName: 'Ocean freight', type: 'buy', amount: 1450, currency: 'USD', vendorId: 'vn1' },
  { id: 'ch2', bookingId: 'KLNVO2627000009', chargeCodeId: 'cc1', chargeName: 'Ocean freight', type: 'sell', amount: 1850, currency: 'USD', vendorId: null },
  { id: 'ch3', bookingId: 'KLNVO2627000009', chargeCodeId: 'cc2', chargeName: 'Origin local charges', type: 'buy', amount: 14500, currency: 'INR', vendorId: 'vn3' },
  { id: 'ch4', bookingId: 'KLNVO2627000009', chargeCodeId: 'cc2', chargeName: 'Origin local charges', type: 'sell', amount: 18000, currency: 'INR', vendorId: null },
  { id: 'ch5', bookingId: 'KLNVO2627000009', chargeCodeId: 'cc4', chargeName: 'BL fee', type: 'sell', amount: 3500, currency: 'INR', vendorId: null },
  { id: 'ch6', bookingId: 'KLNVO2627000010', chargeCodeId: 'cc1', chargeName: 'Ocean freight', type: 'buy', amount: 1100, currency: 'USD', vendorId: 'vn1' },
  { id: 'ch7', bookingId: 'KLNVO2627000010', chargeCodeId: 'cc1', chargeName: 'Ocean freight', type: 'sell', amount: 1400, currency: 'USD', vendorId: null },
  { id: 'ch8', bookingId: 'KLNVO2627000016', chargeCodeId: 'cc1', chargeName: 'Ocean freight', type: 'buy', amount: 900, currency: 'USD', vendorId: 'vn1' },
  { id: 'ch9', bookingId: 'KLNVO2627000016', chargeCodeId: 'cc1', chargeName: 'Ocean freight', type: 'sell', amount: 1250, currency: 'USD', vendorId: null },
]

/* ── Documents ───────────────────────────────────────────────── */

export const mockDocuments: BookingDocument[] = [
  { id: 'doc1', bookingId: 'KLNVO2627000009', docType: 'CRO', status: 'approved', uploadedBy: 'MNR', uploadedAt: '2026-06-08' },
  { id: 'doc2', bookingId: 'KLNVO2627000009', docType: 'SI', status: 'uploaded', uploadedBy: 'Customer', uploadedAt: '2026-06-09' },
  { id: 'doc3', bookingId: 'KLNVO2627000009', docType: 'VGM', status: 'approved', uploadedBy: 'Ops', uploadedAt: '2026-06-10' },
  { id: 'doc4', bookingId: 'KLNVO2627000009', docType: 'BL', status: 'uploaded', uploadedBy: 'Ops', uploadedAt: '2026-06-11' },
  { id: 'doc5', bookingId: 'KLNVO2627000016', docType: 'CRO', status: 'approved', uploadedBy: 'MNR', uploadedAt: '2026-06-12' },
  { id: 'doc6', bookingId: 'KLNVO2627000007', docType: 'CRO', status: 'approved', uploadedBy: 'MNR', uploadedAt: '2026-05-25' },
  { id: 'doc7', bookingId: 'KLNVO2627000019', docType: 'SI', status: 'uploaded', uploadedBy: 'Customer', uploadedAt: '2026-06-14' },
]

/* ── CRO ─────────────────────────────────────────────────────── */

export const mockCros: CroDocument[] = [
  { id: 'cro1', bookingId: 'KLNVO2627000009', status: 'Container picked up', containerNo: 'TRLU3010904', issuedAt: '2026-06-08' },
  { id: 'cro2', bookingId: 'KLNVO2627000016', status: 'Container picked up', containerNo: 'GLDU3629153', issuedAt: '2026-06-12' },
  { id: 'cro3', bookingId: 'KLNVO2627000007', status: 'Issued', containerNo: null, issuedAt: '2026-05-25' },
]

/* ── BL ──────────────────────────────────────────────────────── */

export const mockBlStates: BlState[] = [
  {
    bookingId: 'KLNVO2627000009',
    lifecycle: 'Approved',
    releaseType: null,
    currentFields: {
      shipper: 'M/S. CLASSIC RAZORS',
      consignee: 'To order',
      notifyParty: 'Same as consignee',
      pol: 'NHAVA SHEVA',
      pod: 'SOHAR',
      vesselVoyage: 'SOUL OF KOLKATA / 2610',
      descriptionOfGoods: 'Razors and shaving accessories — 1x20 GP',
      grossWeight: '',
      marksAndNumbers: 'TRLU3010904',
      packages: '1 container',
    },
  },
  {
    bookingId: 'KLNVO2627000019',
    lifecycle: 'Awaiting approval',
    releaseType: null,
    currentFields: {
      shipper: 'BARKA FOODSTUFF TRADING L.L.C',
      consignee: 'To order',
      notifyParty: 'Same as consignee',
      pol: 'JEBEL ALI',
      pod: 'MUNDRA',
      vesselVoyage: 'GFS PRECIOUS / 0050',
      descriptionOfGoods: 'Foodstuff — 1x40 RF (reefer)',
      grossWeight: '',
      marksAndNumbers: 'CGMU9299220',
      packages: '1 container',
    },
  },
]

export const mockBlVersions: BlVersion[] = [
  {
    id: 'blv1',
    bookingId: 'KLNVO2627000009',
    version: 1,
    fields: mockBlStates[0].currentFields,
    editedBy: 'Ops',
    editedByRole: 'ops',
    editedAt: '2026-06-10T09:00:00Z',
    amendment: false,
  },
  {
    id: 'blv2',
    bookingId: 'KLNVO2627000019',
    version: 1,
    fields: mockBlStates[1].currentFields,
    editedBy: 'Ops',
    editedByRole: 'ops',
    editedAt: '2026-06-14T09:00:00Z',
    amendment: false,
  },
]

/* ── Container activities (doc: origin + destination sections) ─ */

export const CONTAINER_ACTIVITY_DEFS: Omit<ContainerActivity, 'completedAt'>[] = [
  { key: 'gate_out', label: 'Gate-out (empty pickup)', section: 'origin' },
  { key: 'stuffing', label: 'Stuffing', section: 'origin' },
  { key: 'seal', label: 'Seal confirmed', section: 'origin' },
  { key: 'gate_in', label: 'Gate-in (laden)', section: 'origin' },
  { key: 'vessel_load', label: 'Vessel load', section: 'origin' },
  { key: 'discharge', label: 'Discharge', section: 'destination' },
  { key: 'customs', label: 'Customs cleared', section: 'destination' },
  { key: 'delivery', label: 'Delivery', section: 'destination' },
  { key: 'empty_return', label: 'Empty return', section: 'destination' },
]

export const mockContainerActivities: Record<string, ContainerActivity[]> = {
  KLNVO2627000009: CONTAINER_ACTIVITY_DEFS.map((d, i) => ({
    ...d,
    completedAt: i < 5 ? `2026-06-${String(8 + i).padStart(2, '0')}` : null,
  })),
  KLNVO2627000016: CONTAINER_ACTIVITY_DEFS.map((d, i) => ({
    ...d,
    completedAt: i < 4 ? `2026-06-${String(12 + i).padStart(2, '0')}` : null,
  })),
}

/* ── Invoices ────────────────────────────────────────────────── */

export const mockInvoices: Invoice[] = [
  {
    id: 'inv1',
    invoiceNo: 'KLI-25-0451',
    bookingId: 'KLNVO2627000009',
    type: 'AR',
    status: 'Zoho synced',
    lines: [
      { chargeLineId: 'ch2', chargeName: 'Ocean freight', amount: 1850, currency: 'USD' },
      { chargeLineId: 'ch5', chargeName: 'BL fee', amount: 3500, currency: 'INR' },
    ],
    zohoInvoiceId: 'ZB-88121',
    createdAt: '2026-06-15',
  },
  {
    id: 'inv2',
    invoiceNo: 'KLB-25-0187',
    bookingId: 'KLNVO2627000009',
    type: 'AP',
    status: 'Approved',
    lines: [
      { chargeLineId: 'ch1', chargeName: 'Ocean freight', amount: 1450, currency: 'USD' },
    ],
    zohoInvoiceId: null,
    createdAt: '2026-06-15',
  },
]

/* ── Leads & Quotes (doc §0.5) ───────────────────────────────── */

export const mockLeads: Lead[] = [
  { id: 'l1', customerId: 'c2', customerName: 'Global Traders', origin: 'INNSA', destination: 'BANDAR ABBAS', mode: 'sea', cargoType: 'Rice, 25t', targetDate: '2025-06-10', status: 'New', createdAt: '2026-06-18' },
  { id: 'l2', customerId: 'c5', customerName: 'Swift Elite', origin: 'INNSA', destination: 'JEBEL ALI', mode: 'sea', cargoType: 'Textiles, 2 TEU', targetDate: '2025-06-05', status: 'Quoted', createdAt: '2026-06-16' },
  { id: 'l3', customerId: null, customerName: 'Meridian Overseas (walk-in)', origin: 'MUNDRA', destination: 'MOMBASA', mode: 'sea', cargoType: 'Ceramic tiles, 4 TEU', targetDate: '2025-06-20', status: 'New', createdAt: '2026-06-19' },
]

export const mockQuotes: Quote[] = [
  { id: 'q1', leadId: 'l2', buyTotal: 1900, sellTotal: 2450, currency: 'USD', validUntil: '2026-06-31', status: 'Sent' },
]

/* ── Approvals queue (doc §11) ───────────────────────────────── */

export const mockApprovals: Approval[] = [
  {
    id: 'ap1',
    entityType: 'bl_edit',
    entityId: 'KLNVO2627000019',
    bookingId: 'KLNVO2627000019',
    summary: 'Customer edit: consignee address change on KLNVO2627000019',
    requestedBy: 'Barka Foodstuff Trading LLC (customer)',
    requestedAt: '2026-06-20T08:30:00Z',
    status: 'Pending',
    payload: { consignee: 'Barka Foodstuff Trading LLC, Barka Souq, Sultanate of Oman' },
  },
  {
    id: 'ap2',
    entityType: 'invoice',
    entityId: 'inv2',
    bookingId: 'KLNVO2627000009',
    summary: 'AP vendor bill KLB-25-0187 — CMA CGM ocean freight $1,450',
    requestedBy: 'Finance (auto-draft)',
    requestedAt: '2026-06-15T11:00:00Z',
    status: 'Pending',
  },
  {
    id: 'ap3',
    entityType: 'quote',
    entityId: 'q1',
    bookingId: null,
    summary: 'Quote for Swift Elite over margin threshold (22.4%)',
    requestedBy: 'BD — S. Singh',
    requestedAt: '2026-06-16T14:00:00Z',
    status: 'Pending',
  },
]

/* ── Activity log ────────────────────────────────────────────── */

export const mockActivities: ActivityEntry[] = [
  { id: 'ac1', bookingId: 'KLNVO2627000009', at: '2026-06-01T10:00:00Z', actor: 'S. Singh (Ops)', action: 'Booking created — KLNVO2627000009' },
  { id: 'ac2', bookingId: 'KLNVO2627000009', at: '2026-06-08T09:15:00Z', actor: 'MNR', action: 'CRO issued; container TRLU3010904 assigned' },
  { id: 'ac3', bookingId: 'KLNVO2627000009', at: '2026-06-10T09:00:00Z', actor: 'Ops', action: 'BL draft v1 created' },
  { id: 'ac4', bookingId: 'KLNVO2627000009', at: '2026-06-12T16:40:00Z', actor: 'System', action: 'Milestone: Vessel sailed' },
  { id: 'ac5', bookingId: 'KLNVO2627000019', at: '2026-06-20T08:30:00Z', actor: 'Customer', action: 'BL edit submitted for approval' },
]

/* ── Dashboard aggregates (chart data stays static demo) ─────── */

export const mockDashboard: DashboardData = {
  kpis: {
    totalShipments: 1248,
    totalShipmentsDelta: 12.5,
    inTransit: 612,
    inTransitDelta: 8.1,
    delivered: 528,
    deliveredDelta: 10.3,
    revenueUsd: 2_450_000,
    revenueDelta: 15.7,
    blDrafts: 93,
    blDraftsDelta: 5.2,
  },
  overview: [
    { label: '1 May', booked: 340, inTransit: 240, delivered: 130 },
    { label: '4 May', booked: 420, inTransit: 300, delivered: 150 },
    { label: '8 May', booked: 380, inTransit: 280, delivered: 170 },
    { label: '11 May', booked: 470, inTransit: 350, delivered: 160 },
    { label: '15 May', booked: 440, inTransit: 330, delivered: 200 },
    { label: '18 May', booked: 530, inTransit: 390, delivered: 220 },
    { label: '22 May', booked: 500, inTransit: 430, delivered: 210 },
    { label: '25 May', booked: 590, inTransit: 400, delivered: 250 },
    { label: '29 May', booked: 640, inTransit: 460, delivered: 280 },
  ],
  byType: [
    { label: 'FCL (Export)', value: 42, color: '#22C55E' },
    { label: 'FCL (Import)', value: 33, color: '#3B82F6' },
    { label: 'LCL', value: 15, color: '#8B5CF6' },
    { label: 'Air', value: 7, color: '#FB923C' },
    { label: 'Others', value: 3, color: '#06B6D4' },
  ],
  byTypeTotal: 1248,
  tradeLanes: [
    { from: 'INNSA', to: 'JEBEL ALI', sharePct: 32, kind: 'sea' },
    { from: 'INNSA', to: 'MOMBASA', sharePct: 21, kind: 'sea' },
    { from: 'INNSA', to: 'BANDAR ABBAS', sharePct: 18, kind: 'sea' },
    { from: 'INNSA', to: 'CHABAHAR', sharePct: 15, kind: 'sea' },
    { from: 'Others', to: '', sharePct: 14, kind: 'other' },
  ],
  tasks: [
    { id: 't1', label: 'BL Draft Approvals', count: 5 },
    { id: 't2', label: 'Invoice Approvals', count: 7 },
    { id: 't3', label: 'Repair Estimates', count: 2 },
    { id: 't4', label: 'Customer Requests', count: 3 },
    { id: 't5', label: 'Document Uploads', count: 4 },
  ],
  notifications: 3,
}
