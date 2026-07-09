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
import { EXPORT_MILESTONES, IMPORT_MILESTONES } from '../lib/milestones'

/* ── Bookings ────────────────────────────────────────────────── */

const base = {
  module: 'nvocc' as const,
  notifyParty: 'Same as consignee',
  freeDaysOrigin: 7,
  freeDaysDest: 14,
  transitTime: 7,
  freightTerms: 'Prepaid' as const,
  surveyorId: 'vn2',
  emptyYardId: 'd1',
  containerType: '40HC',
  containerQty: 1,
  commodity: 'General cargo',
  hsCode: '9403',
  packages: 240,
  packageType: 'Cartons',
  grossWeightKg: 18500,
  cancelled: false,
}

export const mockBookings: Booking[] = [
  {
    ...base,
    id: 'b1',
    bookingRef: 'KINEXP-0123',
    direction: 'Export',
    bookingPartyId: 'c1',
    bookingPartyName: 'ABC Exports Pvt. Ltd.',
    bookingDate: '2025-05-01',
    principal: 'Kinetic Line',
    shipper: 'ABC Exports Pvt. Ltd.',
    consignee: 'Al Rashid Trading LLC, Dubai',
    originAgentId: 'a6',
    destinationAgentId: 'a1',
    vesselId: 'v1',
    vesselName: 'CMA CGM TAIGE',
    voyageNo: '0FL1E',
    pol: 'INNSA',
    pod: 'JEBEL ALI',
    etd: '2025-05-12',
    eta: '2025-05-19',
    containerNos: ['KLCU4001234'],
    sealNo: 'SL-99123',
    hblNo: 'KLHBL250123',
    createdAt: '2025-05-01',
  },
  {
    ...base,
    id: 'b2',
    bookingRef: 'KINEXP-0124',
    direction: 'Export',
    bookingPartyId: 'c2',
    bookingPartyName: 'Global Traders',
    bookingDate: '2025-05-02',
    principal: 'Kinetic Line',
    shipper: 'Global Traders',
    consignee: 'Mombasa Wholesale Ltd.',
    originAgentId: 'a6',
    destinationAgentId: 'a2',
    vesselId: 'v2',
    vesselName: 'MAERSK NALAF',
    voyageNo: 'S12E',
    pol: 'INNSA',
    pod: 'MOMBASA',
    etd: '2025-05-13',
    eta: '2025-05-27',
    containerNos: [],
    sealNo: '',
    hblNo: 'KLHBL250124',
    createdAt: '2025-05-02',
  },
  {
    ...base,
    id: 'b3',
    bookingRef: 'KINIMP-0089',
    direction: 'Import',
    bookingPartyId: 'c3',
    bookingPartyName: 'Oceanic Imports',
    bookingDate: '2025-05-04',
    principal: 'Kinetic Line',
    shipper: 'Jebel Ali Trading FZE',
    consignee: 'Oceanic Imports',
    originAgentId: 'a1',
    destinationAgentId: null,
    vesselId: 'v3',
    vesselName: 'MSC ORCHID',
    voyageNo: 'IV514E',
    pol: 'JEBEL ALI',
    pod: 'INNSA',
    etd: '2025-05-18',
    eta: '2025-05-25',
    containerNos: ['KLCU4005678'],
    sealNo: 'SL-99456',
    hblNo: 'KLHBL250089',
    createdAt: '2025-05-04',
  },
  {
    ...base,
    id: 'b4',
    bookingRef: 'KINIMP-0090',
    direction: 'Import',
    bookingPartyId: 'c4',
    bookingPartyName: 'Bright Logistics',
    bookingDate: '2025-05-05',
    principal: 'Kinetic Line',
    shipper: 'Kenya AgriExports',
    consignee: 'Bright Logistics',
    originAgentId: 'a2',
    destinationAgentId: null,
    vesselId: 'v4',
    vesselName: 'ONE HENRY HUDSON',
    voyageNo: '074E',
    pol: 'MOMBASA',
    pod: 'INNSA',
    etd: '2025-05-20',
    eta: '2025-06-03',
    containerNos: ['KLCU4009012'],
    sealNo: 'SL-99789',
    hblNo: 'KLHBL250090',
    createdAt: '2025-05-05',
  },
  {
    ...base,
    id: 'b5',
    bookingRef: 'KINEXP-0125',
    direction: 'Export',
    bookingPartyId: 'c5',
    bookingPartyName: 'Swift Elite',
    bookingDate: '2025-05-06',
    principal: 'Kinetic Line',
    shipper: 'Swift Elite',
    consignee: 'Chabahar Free Zone Co.',
    originAgentId: 'a6',
    destinationAgentId: 'a4',
    vesselId: 'v5',
    vesselName: 'RMS DENIA',
    voyageNo: '2305E',
    pol: 'INNSA',
    pod: 'CHABAHAR',
    etd: '2025-05-21',
    eta: '2025-05-26',
    containerNos: ['KLCU4003456'],
    sealNo: '',
    hblNo: null,
    createdAt: '2025-05-06',
  },
  {
    ...base,
    id: 'b6',
    bookingRef: 'KINEXP-0126',
    direction: 'Export',
    bookingPartyId: 'c6',
    bookingPartyName: 'Transworld Pvt. Ltd.',
    bookingDate: '2025-05-07',
    principal: 'Kinetic Line',
    shipper: 'Transworld Pvt. Ltd.',
    consignee: 'Lion City Imports Pte.',
    originAgentId: 'a6',
    destinationAgentId: 'a5',
    vesselId: 'v6',
    vesselName: 'EVER GOLDEN',
    voyageNo: '120IE',
    pol: 'INNSA',
    pod: 'SINGAPORE',
    etd: '2025-05-22',
    eta: '2025-05-29',
    containerNos: ['KLCU4007890'],
    sealNo: 'SL-99901',
    hblNo: null,
    createdAt: '2025-05-07',
  },
]

/* Milestone entries — varying depth so derived statuses differ */
function done(bookingId: string, keys: string[], upTo: string): MilestoneEntry[] {
  const defs = keys
  const idx = defs.indexOf(upTo)
  return defs.slice(0, idx + 1).map((key, i) => ({
    bookingId,
    key,
    completedAt: `2025-05-${String(8 + i).padStart(2, '0')}T10:00:00Z`,
    completedBy: 'Ops',
  }))
}
const EXP = EXPORT_MILESTONES.map((m) => m.key)
const IMP = IMPORT_MILESTONES.map((m) => m.key)

export const mockMilestones: MilestoneEntry[] = [
  ...done('b1', EXP, 'vessel_sailed'), // Sailed → In Transit
  ...done('b2', EXP, 'cro_released'), // Booked
  ...done('b3', IMP, 'prealert_can_received'), // Arrived
  ...done('b4', IMP, 'igm_filing').slice(0, 1), // Arrived (only prealert done)
  ...done('b5', EXP, 'gate_in'), // Documentation
  ...done('b6', EXP, 'bl_draft_sent'), // Awaiting BL approval
]

/* ── Charges ─────────────────────────────────────────────────── */

export const mockCharges: ChargeLine[] = [
  { id: 'ch1', bookingId: 'b1', chargeCodeId: 'cc1', chargeName: 'Ocean freight', type: 'buy', amount: 1450, currency: 'USD', vendorId: 'vn1' },
  { id: 'ch2', bookingId: 'b1', chargeCodeId: 'cc1', chargeName: 'Ocean freight', type: 'sell', amount: 1850, currency: 'USD', vendorId: null },
  { id: 'ch3', bookingId: 'b1', chargeCodeId: 'cc2', chargeName: 'Origin local charges', type: 'buy', amount: 14500, currency: 'INR', vendorId: 'vn3' },
  { id: 'ch4', bookingId: 'b1', chargeCodeId: 'cc2', chargeName: 'Origin local charges', type: 'sell', amount: 18000, currency: 'INR', vendorId: null },
  { id: 'ch5', bookingId: 'b1', chargeCodeId: 'cc4', chargeName: 'BL fee', type: 'sell', amount: 3500, currency: 'INR', vendorId: null },
  { id: 'ch6', bookingId: 'b2', chargeCodeId: 'cc1', chargeName: 'Ocean freight', type: 'buy', amount: 1100, currency: 'USD', vendorId: 'vn1' },
  { id: 'ch7', bookingId: 'b2', chargeCodeId: 'cc1', chargeName: 'Ocean freight', type: 'sell', amount: 1400, currency: 'USD', vendorId: null },
  { id: 'ch8', bookingId: 'b5', chargeCodeId: 'cc1', chargeName: 'Ocean freight', type: 'buy', amount: 900, currency: 'USD', vendorId: 'vn1' },
  { id: 'ch9', bookingId: 'b5', chargeCodeId: 'cc1', chargeName: 'Ocean freight', type: 'sell', amount: 1250, currency: 'USD', vendorId: null },
]

/* ── Documents ───────────────────────────────────────────────── */

export const mockDocuments: BookingDocument[] = [
  { id: 'doc1', bookingId: 'b1', docType: 'CRO', status: 'approved', uploadedBy: 'MNR', uploadedAt: '2025-05-08' },
  { id: 'doc2', bookingId: 'b1', docType: 'SI', status: 'uploaded', uploadedBy: 'Customer', uploadedAt: '2025-05-09' },
  { id: 'doc3', bookingId: 'b1', docType: 'VGM', status: 'approved', uploadedBy: 'Ops', uploadedAt: '2025-05-10' },
  { id: 'doc4', bookingId: 'b1', docType: 'BL', status: 'uploaded', uploadedBy: 'Ops', uploadedAt: '2025-05-11' },
  { id: 'doc5', bookingId: 'b5', docType: 'CRO', status: 'approved', uploadedBy: 'MNR', uploadedAt: '2025-05-12' },
  { id: 'doc6', bookingId: 'b6', docType: 'CRO', status: 'approved', uploadedBy: 'MNR', uploadedAt: '2025-05-13' },
  { id: 'doc7', bookingId: 'b6', docType: 'SI', status: 'uploaded', uploadedBy: 'Customer', uploadedAt: '2025-05-14' },
]

/* ── CRO ─────────────────────────────────────────────────────── */

export const mockCros: CroDocument[] = [
  { id: 'cro1', bookingId: 'b1', status: 'Container picked up', containerNo: 'KLCU4001234', issuedAt: '2025-05-08' },
  { id: 'cro2', bookingId: 'b5', status: 'Container picked up', containerNo: 'KLCU4003456', issuedAt: '2025-05-12' },
  { id: 'cro3', bookingId: 'b6', status: 'Issued', containerNo: null, issuedAt: '2025-05-13' },
]

/* ── BL ──────────────────────────────────────────────────────── */

export const mockBlStates: BlState[] = [
  {
    bookingId: 'b1',
    lifecycle: 'Approved',
    releaseType: null,
    currentFields: {
      shipper: 'ABC Exports Pvt. Ltd.',
      consignee: 'Al Rashid Trading LLC, Dubai',
      notifyParty: 'Same as consignee',
      pol: 'INNSA',
      pod: 'JEBEL ALI',
      vesselVoyage: 'CMA CGM TAIGE / 0FL1E',
      descriptionOfGoods: '240 cartons of household furniture fittings',
      grossWeight: '18,500 kg',
      marksAndNumbers: 'ART/DXB/2025',
      packages: '240 cartons',
    },
  },
  {
    bookingId: 'b6',
    lifecycle: 'Awaiting approval',
    releaseType: null,
    currentFields: {
      shipper: 'Transworld Pvt. Ltd.',
      consignee: 'Lion City Imports Pte.',
      notifyParty: 'Same as consignee',
      pol: 'INNSA',
      pod: 'SINGAPORE',
      vesselVoyage: 'EVER GOLDEN / 120IE',
      descriptionOfGoods: 'Machine spare parts, 120 crates',
      grossWeight: '14,200 kg',
      marksAndNumbers: 'TWD/SIN/2025',
      packages: '120 crates',
    },
  },
]

export const mockBlVersions: BlVersion[] = [
  {
    id: 'blv1',
    bookingId: 'b1',
    version: 1,
    fields: mockBlStates[0].currentFields,
    editedBy: 'Ops',
    editedByRole: 'ops',
    editedAt: '2025-05-10T09:00:00Z',
    amendment: false,
  },
  {
    id: 'blv2',
    bookingId: 'b6',
    version: 1,
    fields: mockBlStates[1].currentFields,
    editedBy: 'Ops',
    editedByRole: 'ops',
    editedAt: '2025-05-14T09:00:00Z',
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
  b1: CONTAINER_ACTIVITY_DEFS.map((d, i) => ({
    ...d,
    completedAt: i < 5 ? `2025-05-${String(8 + i).padStart(2, '0')}` : null,
  })),
  b5: CONTAINER_ACTIVITY_DEFS.map((d, i) => ({
    ...d,
    completedAt: i < 4 ? `2025-05-${String(12 + i).padStart(2, '0')}` : null,
  })),
}

/* ── Invoices ────────────────────────────────────────────────── */

export const mockInvoices: Invoice[] = [
  {
    id: 'inv1',
    invoiceNo: 'KLI-25-0451',
    bookingId: 'b1',
    type: 'AR',
    status: 'Zoho synced',
    lines: [
      { chargeLineId: 'ch2', chargeName: 'Ocean freight', amount: 1850, currency: 'USD' },
      { chargeLineId: 'ch5', chargeName: 'BL fee', amount: 3500, currency: 'INR' },
    ],
    zohoInvoiceId: 'ZB-88121',
    createdAt: '2025-05-15',
  },
  {
    id: 'inv2',
    invoiceNo: 'KLB-25-0187',
    bookingId: 'b1',
    type: 'AP',
    status: 'Approved',
    lines: [
      { chargeLineId: 'ch1', chargeName: 'Ocean freight', amount: 1450, currency: 'USD' },
    ],
    zohoInvoiceId: null,
    createdAt: '2025-05-15',
  },
]

/* ── Leads & Quotes (doc §0.5) ───────────────────────────────── */

export const mockLeads: Lead[] = [
  { id: 'l1', customerId: 'c2', customerName: 'Global Traders', origin: 'INNSA', destination: 'BANDAR ABBAS', mode: 'sea', cargoType: 'Rice, 25t', targetDate: '2025-06-10', status: 'New', createdAt: '2025-05-18' },
  { id: 'l2', customerId: 'c5', customerName: 'Swift Elite', origin: 'INNSA', destination: 'JEBEL ALI', mode: 'sea', cargoType: 'Textiles, 2 TEU', targetDate: '2025-06-05', status: 'Quoted', createdAt: '2025-05-16' },
  { id: 'l3', customerId: null, customerName: 'Meridian Overseas (walk-in)', origin: 'MUNDRA', destination: 'MOMBASA', mode: 'sea', cargoType: 'Ceramic tiles, 4 TEU', targetDate: '2025-06-20', status: 'New', createdAt: '2025-05-19' },
]

export const mockQuotes: Quote[] = [
  { id: 'q1', leadId: 'l2', buyTotal: 1900, sellTotal: 2450, currency: 'USD', validUntil: '2025-05-31', status: 'Sent' },
]

/* ── Approvals queue (doc §11) ───────────────────────────────── */

export const mockApprovals: Approval[] = [
  {
    id: 'ap1',
    entityType: 'bl_edit',
    entityId: 'b6',
    bookingId: 'b6',
    summary: 'Customer edit: consignee address change on KINEXP-0126',
    requestedBy: 'Transworld Pvt. Ltd. (customer)',
    requestedAt: '2025-05-20T08:30:00Z',
    status: 'Pending',
    payload: { consignee: 'Lion City Imports Pte., 7 Harbourfront Ave, Singapore 098xxx' },
  },
  {
    id: 'ap2',
    entityType: 'invoice',
    entityId: 'inv2',
    bookingId: 'b1',
    summary: 'AP vendor bill KLB-25-0187 — CMA CGM ocean freight $1,450',
    requestedBy: 'Finance (auto-draft)',
    requestedAt: '2025-05-15T11:00:00Z',
    status: 'Pending',
  },
  {
    id: 'ap3',
    entityType: 'quote',
    entityId: 'q1',
    bookingId: null,
    summary: 'Quote for Swift Elite over margin threshold (22.4%)',
    requestedBy: 'BD — S. Singh',
    requestedAt: '2025-05-16T14:00:00Z',
    status: 'Pending',
  },
]

/* ── Activity log ────────────────────────────────────────────── */

export const mockActivities: ActivityEntry[] = [
  { id: 'ac1', bookingId: 'b1', at: '2025-05-01T10:00:00Z', actor: 'S. Singh (Ops)', action: 'Booking created — KINEXP-0123' },
  { id: 'ac2', bookingId: 'b1', at: '2025-05-08T09:15:00Z', actor: 'MNR', action: 'CRO issued; container KLCU4001234 assigned' },
  { id: 'ac3', bookingId: 'b1', at: '2025-05-10T09:00:00Z', actor: 'Ops', action: 'BL draft v1 created' },
  { id: 'ac4', bookingId: 'b1', at: '2025-05-12T16:40:00Z', actor: 'System', action: 'Milestone: Vessel sailed' },
  { id: 'ac5', bookingId: 'b6', at: '2025-05-20T08:30:00Z', actor: 'Customer', action: 'BL edit submitted for approval' },
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
