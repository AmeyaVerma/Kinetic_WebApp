/* ── Session data store ──────────────────────────────────────────
   The interactive mock backend. All workflow mutations live here,
   mirroring the actions the Supabase layer will expose later.
   State resets on refresh (same contract as the v5 prototype).  */

import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'
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
  DocStatus,
  HazmatDetails,
  HazmatStatus,
  ChargeCodeMaster,
  ChargeLine,
  Customer,
  DepotMaster,
  VendorMaster,
  VesselMaster,
  ContainerActivity,
  ContainerLineItem,
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
  Party,
  PartyAuthorizedPerson,
  PartyBranch,
  PartyDocument,
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

/* ── Supabase mapping (NVOCC pilot only — see supabase/migrations/0005) ──
   The app's Booking.id stays the human bookingRef everywhere (routes,
   charge/milestone lookups); dbId is the real DB uuid, used only to link
   child rows (charges, documents) to the real record. A booking that only
   ever existed in mock data has dbId === undefined. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToParty(row: any): Party {
  return {
    id: row.id,
    code: row.code,
    legalName: row.legal_name,
    displayName: row.display_name,
    partyType: row.party_type,
    roles: row.roles ?? [],
    addressLine: row.address_line,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    addressRaw: row.address_raw,
    pan: row.pan,
    gstin: row.gstin,
    iec: row.iec,
    taxId: row.tax_id,
    email: row.email,
    phone: row.phone,
    salesPerson: row.sales_person,
    accountingCode: row.accounting_code,
    partyCodeLegacy: row.party_code_legacy,
    status: row.status,
    isSelf: row.is_self,
    createdAt: row.created_at,
    partyPrefix: row.party_prefix,
    legacyUsername: row.legacy_username,
    legacyPassword: row.legacy_password,
    clientCoordinator: row.client_coordinator,
    exporterImporterClass: row.exporter_importer_class,
    exporterImporterType: row.exporter_importer_type,
    typeOfFirm: row.type_of_firm,
    msmeType: row.msme_type,
    msmeNo: row.msme_no,
    cin: row.cin,
    tin: row.tin,
    bin: row.bin,
    dobOrIncorporationDate: row.dob_or_incorporation_date,
    remarks: row.remarks,
    partyRole: row.party_role,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPartyBranch(row: any): PartyBranch {
  return {
    id: row.id,
    partyId: row.party_id,
    addressType: row.address_type,
    srNo: row.sr_no,
    city: row.city,
    address: row.address,
    state: row.state,
    country: row.country,
    postalCode: row.postal_code,
    gstNumber: row.gst_number,
    contactPerson: row.contact_person,
    email: row.email,
    phone: row.phone,
    fax: row.fax,
    bankBranch: row.bank_branch,
    accountType: row.account_type,
    accountNumber: row.account_number,
    ifsc: row.ifsc,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPartyAuthorizedPerson(row: any): PartyAuthorizedPerson {
  return {
    id: row.id,
    partyId: row.party_id,
    name: row.name,
    designation: row.designation,
    contactNumber: row.contact_number,
    email: row.email,
    location: row.location,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPartyDocument(row: any): PartyDocument {
  return {
    id: row.id,
    partyId: row.party_id,
    documentName: row.document_name,
    storagePath: row.storage_path,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
  }
}

function rowToBooking(row: any): Booking {
  return {
    id: row.booking_ref,
    dbId: row.id,
    bookingRef: row.booking_ref,
    module: row.module,
    direction: row.direction,
    bookingPartyId: row.booking_party_id,
    bookingPartyName: row.booking_party_name,
    bookingDate: row.booking_date,
    principal: row.principal,
    shipper: row.shipper,
    consignee: row.consignee,
    notifyParty: row.notify_party,
    originAgentId: row.origin_agent_id,
    destinationAgentId: row.destination_agent_id,
    transshipmentAgent: row.transshipment_agent ?? undefined,
    emptyContainerYardOrigin: row.empty_container_yard_origin ?? undefined,
    emptyContainerYardDestination: row.empty_container_yard_destination ?? undefined,
    freeDaysOrigin: row.free_days_origin,
    freeDaysDest: row.free_days_dest,
    transitTime: row.transit_time,
    vesselId: row.vessel_id,
    vesselName: row.vessel_name,
    voyageNo: row.voyage_no,
    pol: row.pol,
    pod: row.pod,
    etd: row.etd,
    eta: row.eta,
    freightTerms: row.freight_terms,
    surveyorId: row.surveyor_id,
    emptyYardId: row.empty_yard_id,
    terminal: row.terminal ?? undefined,
    mblNo: row.mbl_no ?? undefined,
    plannedGateOpen: row.planned_gate_open ?? undefined,
    plannedGateClose: row.planned_gate_close ?? undefined,
    plannedSiCutoff: row.planned_si_cutoff ?? undefined,
    plannedVgmCutoff: row.planned_vgm_cutoff ?? undefined,
    plannedCyCutoff: row.planned_cy_cutoff ?? undefined,
    containerType: row.container_type,
    containerQty: row.container_qty,
    containerNos: row.container_nos ?? [],
    commodity: row.commodity,
    hsCode: row.hs_code,
    packages: row.packages,
    packageType: row.package_type,
    grossWeightKg: row.gross_weight_kg,
    sealNo: row.seal_no,
    numberOfContainers: row.number_of_containers ?? undefined,
    sizeOfContainer: row.size_of_container ?? undefined,
    customSealNo: row.custom_seal_no ?? undefined,
    containerDetails: row.container_details ?? undefined,
    hazmatStatus: row.hazmat_status ?? undefined,
    hazmatDetails: row.hazmat_details ?? undefined,
    hblNo: row.hbl_no,
    cancelled: row.cancelled,
    createdAt: row.created_at,
    workflowStatus: row.workflow_status ?? undefined,
  }
}

function bookingToInsertRow(b: Booking) {
  return {
    booking_ref: b.bookingRef,
    module: b.module,
    direction: b.direction,
    booking_party_id: b.bookingPartyId,
    booking_party_name: b.bookingPartyName,
    booking_date: b.bookingDate || null,
    principal: b.principal,
    shipper: b.shipper,
    consignee: b.consignee,
    notify_party: b.notifyParty,
    origin_agent_id: b.originAgentId,
    destination_agent_id: b.destinationAgentId,
    transshipment_agent: b.transshipmentAgent ?? null,
    empty_container_yard_origin: b.emptyContainerYardOrigin ?? null,
    empty_container_yard_destination: b.emptyContainerYardDestination ?? null,
    free_days_origin: b.freeDaysOrigin,
    free_days_dest: b.freeDaysDest,
    transit_time: b.transitTime,
    vessel_id: b.vesselId,
    vessel_name: b.vesselName,
    voyage_no: b.voyageNo,
    pol: b.pol,
    pod: b.pod,
    etd: b.etd || null,
    eta: b.eta || null,
    freight_terms: b.freightTerms,
    surveyor_id: b.surveyorId,
    empty_yard_id: b.emptyYardId,
    terminal: b.terminal ?? null,
    mbl_no: b.mblNo ?? null,
    planned_gate_open: b.plannedGateOpen || null,
    planned_gate_close: b.plannedGateClose || null,
    planned_si_cutoff: b.plannedSiCutoff || null,
    planned_vgm_cutoff: b.plannedVgmCutoff || null,
    planned_cy_cutoff: b.plannedCyCutoff || null,
    container_type: b.containerType,
    container_qty: b.containerQty,
    container_nos: b.containerNos,
    commodity: b.commodity,
    hs_code: b.hsCode,
    packages: b.packages,
    package_type: b.packageType,
    gross_weight_kg: b.grossWeightKg,
    seal_no: b.sealNo,
    number_of_containers: b.numberOfContainers ?? null,
    size_of_container: b.sizeOfContainer ?? null,
    custom_seal_no: b.customSealNo ?? null,
    container_details: b.containerDetails ?? null,
    hazmat_status: b.hazmatStatus ?? 'Non-Haz',
    hazmat_details: b.hazmatDetails ?? null,
    hbl_no: b.hblNo,
    cancelled: b.cancelled,
    workflow_status: b.workflowStatus ?? 'Booked',
  }
}

/* ── Supabase persistence helpers ─────────────────────────────────
   Every one of these is a no-op if dbId is undefined (a demo/mock
   booking that was never actually created via createBooking) — local
   state still updates as before either way, this only adds the
   background DB write for real bookings. Errors are logged, never
   thrown — a failed background sync shouldn't break the UI action
   that already completed locally. */

function findDbId(bookings: Booking[], bookingId: string): string | undefined {
  return bookings.find((b) => b.id === bookingId)?.dbId
}

function persistBookingUpdate(dbId: string | undefined, patch: Record<string, unknown>, label: string) {
  if (!dbId) return
  ;(async () => {
    const { error } = await supabase.from('bookings').update(patch).eq('id', dbId)
    if (error) console.error(`${label}: failed to persist`, error)
  })()
}

function persistMilestoneUpsert(
  dbId: string | undefined,
  key: string,
  completedAt: string | null,
  completedBy: string | null,
) {
  if (!dbId) return
  ;(async () => {
    const { error } = await supabase
      .from('booking_milestones')
      .upsert({ booking_id: dbId, key, completed_at: completedAt, completed_by: completedBy }, { onConflict: 'booking_id,key' })
    if (error) console.error('markMilestone: failed to persist', error)
  })()
}

function persistContainerActivityUpsert(dbId: string | undefined, key: string, completedAt: string | null) {
  if (!dbId) return
  const def = CONTAINER_ACTIVITY_DEFS.find((d) => d.key === key)
  ;(async () => {
    const { error } = await supabase.from('container_activities').upsert(
      { booking_id: dbId, key, completed_at: completedAt, label: def?.label ?? null, section: def?.section ?? null },
      { onConflict: 'booking_id,key' },
    )
    if (error) console.error('markContainerActivity: failed to persist', error)
  })()
}

function persistBlVersionInsert(dbId: string | undefined, version: BlVersion) {
  if (!dbId) return
  ;(async () => {
    const { error } = await supabase.from('bl_versions').insert({
      booking_id: dbId,
      version: version.version,
      fields: version.fields,
      edited_by: version.editedBy,
      edited_by_role: version.editedByRole,
      amendment: version.amendment,
    })
    if (error) console.error('saveBl: failed to persist version', error)
  })()
}

function persistBlStateUpsert(
  dbId: string | undefined,
  lifecycle: string,
  releaseType: string | null,
  currentFields: BlFields,
) {
  if (!dbId) return
  ;(async () => {
    const { error } = await supabase
      .from('bl_state')
      .upsert(
        { booking_id: dbId, lifecycle, release_type: releaseType, current_fields: currentFields },
        { onConflict: 'booking_id' },
      )
    if (error) console.error('saveBl: failed to persist bl_state', error)
  })()
}

function persistBlStatePatch(dbId: string | undefined, patch: Record<string, unknown>, label: string) {
  if (!dbId) return
  ;(async () => {
    const { error } = await supabase.from('bl_state').update(patch).eq('booking_id', dbId)
    if (error) console.error(`${label}: failed to persist bl_state`, error)
  })()
}

function persistCroInsert(dbId: string | undefined, validUntil: string | null) {
  if (!dbId) return
  ;(async () => {
    const { error } = await supabase
      .from('cro_documents')
      .insert({ booking_id: dbId, status: 'Issued', container_no: null, issued_at: now(), valid_until: validUntil })
    if (error) console.error('generateCro: failed to persist', error)
    const { error: docErr } = await supabase
      .from('booking_documents')
      .insert({ booking_id: dbId, doc_type: 'CRO', status: 'uploaded', uploaded_by: 'MNR', uploaded_at: now() })
    if (docErr) console.error('generateCro: failed to persist CRO document row', docErr)
  })()
}

function persistCroUpdate(dbId: string | undefined, status: string, containerNo: string | null) {
  if (!dbId) return
  ;(async () => {
    const { error } = await supabase
      .from('cro_documents')
      .update({ status, container_no: containerNo })
      .eq('booking_id', dbId)
    if (error) console.error('croPickup: failed to persist', error)
  })()
}

function persistCroValidity(dbId: string | undefined, validUntil: string | null) {
  if (!dbId) return
  ;(async () => {
    const { error } = await supabase
      .from('cro_documents')
      .update({ valid_until: validUntil })
      .eq('booking_id', dbId)
    if (error) console.error('updateCroValidity: failed to persist', error)
  })()
}

function persistDocumentInsert(dbId: string | undefined, docType: string, uploadedBy: string) {
  if (!dbId) return
  ;(async () => {
    const { error } = await supabase
      .from('booking_documents')
      .insert({ booking_id: dbId, doc_type: docType, status: 'uploaded', uploaded_by: uploadedBy, uploaded_at: now() })
    if (error) console.error('uploadDocument: failed to persist', error)
  })()
}

/* ── FF (Freight Forwarding) Supabase mapping — see supabase/migrations/0008.
   Same id/dbId split as Booking: FfShipment.id stays the human `ref`
   everywhere in the app, dbId is the real DB uuid. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToFfShipment(row: any): FfShipment {
  return {
    id: row.ref,
    dbId: row.id,
    ref: row.ref,
    mode: row.mode,
    customerId: row.customer_id,
    customerName: row.customer_name,
    origin: row.origin,
    destination: row.destination,
    incoterm: row.incoterm,
    stage: row.stage,
    creditHold: row.credit_hold,
    isConsolParent: row.is_consol_parent,
    parentId: null, // resolved client-side below once all rows are loaded
    consolClosed: row.consol_closed,
    carrierName: row.carrier_name,
    linkedNvoccRef: row.linked_nvocc_ref,
    rateReconfirmed: row.rate_reconfirmed,
    agentId: row.agent_id,
    specialHandling: row.special_handling ?? null,
    pickupProof: row.pickup_proof,
    siReceived: row.si_received,
    weightVarianceFlagged: row.weight_variance_flagged,
    mblUploaded: row.mbl_uploaded,
    houseDocStatus: row.house_doc_status,
    houseDocVersion: row.house_doc_version,
    houseReleaseType: row.house_release_type,
    brokerAssigned: row.broker_assigned,
    exportHold: row.export_hold,
    letExportReceived: row.let_export_received,
    gateInDone: row.gate_in_done,
    vgmDone: row.vgm_done,
    cutoffMet: row.cutoff_met,
    departed: row.departed,
    transhipmentLegs: row.transhipment_legs,
    arrivalNoticeSent: row.arrival_notice_sent,
    importHold: row.import_hold,
    outOfCharge: row.out_of_charge,
    ddOutcome: row.dd_outcome,
    doIssued: row.do_issued,
    podCaptured: row.pod_captured,
    sellAmount: row.sell_amount,
    daysOfCredit: row.days_of_credit ?? undefined,
    vendorLines: [], // fetched/merged separately (ff_vendor_lines)
    clientInvoiced: row.client_invoiced,
    paid: row.paid,
    createdAt: row.created_at,
    workflowStatus: row.workflow_status ?? undefined,
    containerType: row.container_type ?? undefined,
    numberOfContainers: row.number_of_containers ?? undefined,
    sizeOfContainer: row.size_of_container ?? undefined,
    sealNo: row.seal_no ?? undefined,
    customSealNo: row.custom_seal_no ?? undefined,
    commodity: row.commodity ?? undefined,
    hsCode: row.hs_code ?? undefined,
    packages: row.packages ?? undefined,
    packageType: row.package_type ?? undefined,
    grossWeightKg: row.gross_weight_kg ?? undefined,
    freightTerms: row.freight_terms ?? undefined,
    hazmatStatus: row.hazmat_status ?? undefined,
    hazmatDetails: row.hazmat_details ?? undefined,
    vesselName: row.vessel_name ?? undefined,
    voyageNo: row.voyage_no ?? undefined,
    etd: row.etd ?? undefined,
    eta: row.eta ?? undefined,
    terminal: row.terminal ?? undefined,
    mblNo: row.mbl_no ?? undefined,
    plannedGateOpen: row.planned_gate_open ?? undefined,
    plannedGateClose: row.planned_gate_close ?? undefined,
    plannedSiCutoff: row.planned_si_cutoff ?? undefined,
    plannedVgmCutoff: row.planned_vgm_cutoff ?? undefined,
    plannedCyCutoff: row.planned_cy_cutoff ?? undefined,
    shipper: row.shipper ?? undefined,
    consignee: row.consignee ?? undefined,
    notifyParty: row.notify_party ?? undefined,
    originAgentName: row.origin_agent_name ?? undefined,
    destinationAgentName: row.destination_agent_name ?? undefined,
    transshipmentAgent: row.transshipment_agent ?? undefined,
    surveyorName: row.surveyor_name ?? undefined,
    emptyContainerYardOrigin: row.empty_container_yard_origin ?? undefined,
    croValidTill: row.cro_valid_till ?? undefined,
  }
}

function ffShipmentToInsertRow(s: FfShipment) {
  return {
    ref: s.ref,
    mode: s.mode,
    customer_id: s.customerId,
    customer_name: s.customerName,
    origin: s.origin,
    destination: s.destination,
    incoterm: s.incoterm,
    stage: s.stage,
    credit_hold: s.creditHold,
    is_consol_parent: s.isConsolParent,
    consol_closed: s.consolClosed,
    carrier_name: s.carrierName,
    linked_nvocc_ref: s.linkedNvoccRef,
    rate_reconfirmed: s.rateReconfirmed,
    agent_id: s.agentId,
    special_handling: s.specialHandling ?? null,
    pickup_proof: s.pickupProof,
    si_received: s.siReceived,
    weight_variance_flagged: s.weightVarianceFlagged,
    mbl_uploaded: s.mblUploaded,
    house_doc_status: s.houseDocStatus,
    house_doc_version: s.houseDocVersion,
    house_release_type: s.houseReleaseType,
    broker_assigned: s.brokerAssigned,
    export_hold: s.exportHold,
    let_export_received: s.letExportReceived,
    gate_in_done: s.gateInDone,
    vgm_done: s.vgmDone,
    cutoff_met: s.cutoffMet,
    departed: s.departed,
    transhipment_legs: s.transhipmentLegs,
    arrival_notice_sent: s.arrivalNoticeSent,
    import_hold: s.importHold,
    out_of_charge: s.outOfCharge,
    dd_outcome: s.ddOutcome,
    do_issued: s.doIssued,
    pod_captured: s.podCaptured,
    sell_amount: s.sellAmount,
    days_of_credit: s.daysOfCredit ?? 0,
    client_invoiced: s.clientInvoiced,
    paid: s.paid,
  }
}

/* ── FF persistence helpers — same no-op-if-no-dbId contract as the
   NVOCC ones above. */

function findFfDbId(ffShipments: FfShipment[], shipmentId: string): string | undefined {
  return ffShipments.find((f) => f.id === shipmentId)?.dbId
}

function persistFfUpdate(dbId: string | undefined, patch: Record<string, unknown>, label: string) {
  if (!dbId) return
  ;(async () => {
    const { error } = await supabase.from('ff_shipments').update(patch).eq('id', dbId)
    if (error) console.error(`${label}: failed to persist`, error)
  })()
}

function persistFfVendorLineUpdate(dbId: string | undefined, patch: Record<string, unknown>, label: string) {
  if (!dbId) return
  ;(async () => {
    const { error } = await supabase.from('ff_vendor_lines').update(patch).eq('id', dbId)
    if (error) console.error(`${label}: failed to persist`, error)
  })()
}

const CONTAINER_INFO_FIELD_LABELS = {
  numberOfContainers: 'Number of containers',
  sizeOfContainer: 'Size of container',
  sealNo: 'Seal No.',
  customSealNo: 'Custom Seal No.',
  containerType: 'Container type',
  commodity: 'Commodity',
  hsCode: 'HS code',
  principal: 'Principal',
  freightTerms: 'Freight terms',
  packages: 'Packages',
  grossWeightKg: 'Cargo weight',
} as const

/** Fields on Booking that are numbers, not strings — updateContainerInfoField
    and the booking_field_edit approval path both need to parse into these
    before writing, rather than storing the raw text. */
const NUMERIC_BOOKING_FIELDS = new Set(['packages', 'grossWeightKg'])

const PLANNED_DATE_FIELD_LABELS = {
  plannedGateOpen: 'Planned gate open',
  plannedGateClose: 'Planned gate close',
  plannedSiCutoff: 'Planned SI cut-off',
  plannedVgmCutoff: 'Dock Cutoff',
  plannedCyCutoff: 'Planned CY cut-off',
} as const

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
  parties: Party[]
  partyBranches: PartyBranch[]
  partyAuthorizedPersons: PartyAuthorizedPerson[]
  partyDocuments: PartyDocument[]

  // Master data — user-extensible dropdown options (Workflow §11)
  addMasterOption: (kind: MasterKind, name: string) => string

  /** Pulls the Parties master (supabase/migrations/0015) from Supabase.
      Replaces local state wholesale — unlike fetchBookings/fetchFfShipments
      there's no local mock array to merge with, this table is real-only. */
  fetchParties: () => Promise<void>
  /** Creates the base party row (Pass 2 — 0016_party_details.sql fields).
      Returns the new party (with real id) so the caller can immediately
      add branches/authorized persons/documents against it. */
  createParty: (
    fields: Omit<Party, 'id' | 'code' | 'createdAt' | 'roles' | 'status' | 'isSelf' | 'partyType'> &
      Partial<Pick<Party, 'partyType'>>,
  ) => Promise<{ party: Party | null; error: string | null }>
  /** Admin-direct edit of any Party field — no approval gate, since only
      Admin can reach this (UI-gated in PartyDetailPage). `roles` is passed
      as a comma-separated string and split before writing, same value type
      as every other field so the caller doesn't need a special case. */
  updateParty: (partyId: string, field: keyof Party, value: string, actor: string) => void
  /** Pulls branches/authorized persons/documents for one party — call when
      opening a party for edit (the "new party" flow already has them local). */
  fetchPartyChildren: (partyId: string) => Promise<void>
  addPartyBranch: (partyId: string, branch: Omit<PartyBranch, 'id' | 'partyId'>) => Promise<{ error: string | null }>
  addPartyAuthorizedPerson: (
    partyId: string,
    person: Omit<PartyAuthorizedPerson, 'id' | 'partyId'>,
  ) => Promise<{ error: string | null }>
  uploadPartyDocument: (
    partyId: string,
    documentName: string,
    file: File,
    actor: string,
  ) => Promise<{ error: string | null }>
  getPartyDocumentUrl: (storagePath: string) => Promise<string | null>

  // Lead → Quote → Convert (doc §0.5)
  createLead: (l: Omit<Lead, 'id' | 'status' | 'createdAt'>) => void
  createQuote: (leadId: string, buy: number, sell: number, currency: 'USD' | 'INR', validUntil: string) => void
  quoteAction: (quoteId: string, action: 'send' | 'accept' | 'reject') => void
  convertToBooking: (quoteId: string) => void

  // Booking (doc §1–2)
  /** Pulls real bookings from Supabase (NVOCC pilot table) and merges them
      into local state — additive, never removes the existing demo bookings.
      Safe to call repeatedly (e.g. on every NVOCC page mount). */
  fetchBookings: () => Promise<void>
  createBooking: (
    b: Omit<Booking, 'id' | 'bookingRef' | 'hblNo' | 'cancelled' | 'createdAt' | 'module'>,
    charges: Omit<ChargeLine, 'id' | 'bookingId'>[],
  ) => string
  cancelBooking: (bookingId: string, reason: string) => void
  updateShipmentDates: (bookingId: string, dates: { etd?: string; eta?: string }, actor: string) => void
  updatePlannedDate: (
    bookingId: string,
    field: 'plannedGateOpen' | 'plannedGateClose' | 'plannedSiCutoff' | 'plannedVgmCutoff' | 'plannedCyCutoff',
    value: string,
    actor: string,
  ) => void
  setBookingWorkflowStatus: (bookingId: string, status: BookingWorkflowStatus, actor: string) => void
  setHazmatStatus: (bookingId: string, status: HazmatStatus, actor: string) => void
  updateHazmatDetail: (bookingId: string, field: keyof HazmatDetails, value: string, actor: string) => void
  /** Admin-direct path for any single-field booking edit — Container info
      AND Product info tabs both use this. Handles the two numeric fields
      (packages, grossWeightKg) by parsing the string input before writing,
      everything else stays a plain string/text column. Non-admins should
      call requestBookingFieldChange instead (raises an approval). */
  updateContainerInfoField: (
    bookingId: string,
    field:
      | 'numberOfContainers' | 'sizeOfContainer' | 'sealNo' | 'customSealNo' | 'containerType'
      | 'commodity' | 'hsCode' | 'principal' | 'freightTerms' | 'packages' | 'grossWeightKg',
    value: string,
    actor: string,
  ) => void
  /** Non-admin path for any single-field booking edit on an EXISTING
      booking — raises an Admin-approval request instead of applying
      immediately. `label` is just for a readable approval summary.
      Admins should call updateContainerInfoField directly (no approval
      needed for their own edits). */
  requestBookingFieldChange: (bookingId: string, field: string, label: string, value: string, actor: string) => void
  /** Same as requestBookingFieldChange but for an FfShipment — separate
      because FF has no row in `bookings` to look up. Uses entityType
      'ff_field_edit' so decideApproval knows to apply it to ffShipments. */
  requestFfFieldChange: (shipmentId: string, field: string, label: string, value: string, actor: string) => void
  /** Replaces the whole containerDetails array — used when the container
      count changes (resizes the array, padding/truncating) or a single
      row's field is edited (same array, one entry changed). Admin-direct,
      no approval gate (unlike container type) since these are
      per-container operational details, not a booking-wide classification. */
  updateContainerDetails: (bookingId: string, details: ContainerLineItem[], actor: string) => void
  updateTransshipmentAgent: (bookingId: string, value: string, actor: string) => void
  updateEmptyYardField: (
    bookingId: string,
    field: 'emptyContainerYardOrigin' | 'emptyContainerYardDestination',
    value: string,
    actor: string,
  ) => void

  // Milestones (doc §6)
  markMilestone: (bookingId: string, key: string, actor: string, completedAt?: string) => void
  /** Admin-only: change the date on an already-completed milestone (markMilestone
      refuses to touch one that's already marked; UI gates this to Admin). */
  updateMilestoneDate: (bookingId: string, key: string, completedAt: string, actor: string) => void

  // CRO (doc §3)
  generateCro: (bookingId: string, validUntil?: string) => void
  /** Editable after the CRO already exists — e.g. extending validity. */
  updateCroValidity: (bookingId: string, validUntil: string, actor: string) => void
  croPickup: (bookingId: string, containerNo: string) => void

  // BL (doc §4)
  saveBl: (bookingId: string, fields: BlFields, actor: string, role: Role) => void
  submitCustomerBlEdit: (bookingId: string, changes: Partial<BlFields>, actor: string) => void
  approveBl: (bookingId: string, actor: string) => void
  releaseBl: (bookingId: string, releaseType: 'Original' | 'Telex' | 'Seaway') => void

  // Documents (doc §5)
  uploadDocument: (bookingId: string, docType: BookingDocument['docType'], actor: string) => void
  /** Pulls real document rows (with storagePath) for a booking from
      Supabase and merges them into local state — additive, same pattern
      as fetchBookings. No-ops if the booking has no dbId. */
  fetchDocuments: (bookingId: string) => Promise<void>
  /** Real upload: puts the file in Supabase Storage (booking-documents
      bucket) then inserts the booking_documents row pointing at it.
      Returns an error string on failure so the UI can show it. No-ops
      with an explanatory error if the booking has no dbId yet (legacy
      demo booking, never persisted). */
  uploadDocumentFile: (
    bookingId: string,
    docType: BookingDocument['docType'],
    actor: string,
    file: File,
  ) => Promise<{ error: string | null }>
  /** Signed, time-limited URL to view/download a stored document (the
      bucket is private, so there's no permanent public URL). */
  getDocumentUrl: (storagePath: string) => Promise<string | null>

  // Container activities
  markContainerActivity: (bookingId: string, key: string, completedAt?: string, actor?: string) => void

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
  /** Pulls real FF shipments from Supabase and merges them into local
      state — additive, same pattern as fetchBookings. */
  fetchFfShipments: () => Promise<void>
  createFfShipment: (
    s: Pick<FfShipment, 'mode' | 'customerId' | 'customerName' | 'origin' | 'destination' | 'incoterm' | 'sellAmount' | 'isConsolParent' | 'specialHandling' | 'daysOfCredit'>,
    vendorLines: Omit<FfVendorLine, 'id' | 'billedAmount' | 'varianceFlag'>[],
  ) => string
  addChildHbl: (parentId: string, child: { customerId: string | null; customerName: string; sellAmount: number }) => void
  closeConsolRun: (parentId: string) => void
  ffConfirmCarrier: (id: string, opts: { linkedNvoccRef: string | null; carrierName: string; agentId: string | null }) => void
  ffPickupComplete: (id: string) => void
  // Booking-detail parity actions (mirror the Booking-side ones, generic over any FfShipment field)
  updateFfField: (shipmentId: string, field: keyof FfShipment, value: string, actor: string) => void
  setFfWorkflowStatus: (shipmentId: string, status: BookingWorkflowStatus, actor: string) => void
  setFfHazmatStatus: (shipmentId: string, status: HazmatStatus, actor: string) => void
  updateFfHazmatDetail: (shipmentId: string, field: keyof HazmatDetails, value: string, actor: string) => void
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

  // FF document upload (own table/bucket — see supabase/migrations/0009).
  // Reuses the same local `documents` array as NVOCC (already generic on
  // bookingId), just talks to ff_documents + the ff-documents bucket.
  fetchFfDocuments: (shipmentId: string) => Promise<void>
  uploadFfDocumentFile: (
    shipmentId: string,
    docType: BookingDocument['docType'],
    actor: string,
    file: File,
  ) => Promise<{ error: string | null }>
  getFfDocumentUrl: (storagePath: string) => Promise<string | null>

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
  parties: [],
  partyBranches: [],
  partyAuthorizedPersons: [],
  partyDocuments: [],
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

  fetchBookings: async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })
    if (error || !data) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetched = (data as any[]).map(rowToBooking)
    set((s) => {
      const existingRefs = new Set(s.bookings.map((b) => b.bookingRef))
      const newOnes = fetched.filter((b) => !existingRefs.has(b.bookingRef))
      // Patch dbId onto any local booking that now has a matching real row
      // (covers the case where createBooking's insert resolved after fetch).
      const patched = s.bookings.map((b) => {
        const match = fetched.find((f) => f.bookingRef === b.bookingRef)
        return match ? { ...b, dbId: match.dbId } : b
      })
      return { bookings: [...newOnes, ...patched] }
    })
  },

  fetchParties: async () => {
    const { data, error } = await supabase
      .from('parties')
      .select('*')
      .order('legal_name', { ascending: true })
    if (error || !data) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set({ parties: (data as any[]).map(rowToParty) })
  },

  createParty: async (fields) => {
    const existing = get().parties
    const maxSeq = existing.reduce((max, p) => {
      const m = p.code.match(/^PTY-(\d{5})$/)
      return m ? Math.max(max, +m[1]) : max
    }, 0)
    const code = `PTY-${String(maxSeq + 1).padStart(5, '0')}`

    const { data, error } = await supabase
      .from('parties')
      .insert({
        code,
        legal_name: fields.legalName,
        display_name: fields.displayName || fields.legalName,
        party_type: fields.partyType ?? 'Local',
        roles: [],
        status: 'Active',
        is_self: false,
        address_line: fields.addressLine,
        city: fields.city,
        state: fields.state,
        postal_code: fields.postalCode,
        country: fields.country,
        address_raw: fields.addressRaw,
        pan: fields.pan,
        gstin: fields.gstin,
        iec: fields.iec,
        tax_id: fields.taxId,
        email: fields.email,
        phone: fields.phone,
        sales_person: fields.salesPerson,
        accounting_code: fields.accountingCode,
        party_code_legacy: fields.partyCodeLegacy,
        party_prefix: fields.partyPrefix,
        legacy_username: fields.legacyUsername,
        legacy_password: fields.legacyPassword,
        client_coordinator: fields.clientCoordinator,
        exporter_importer_class: fields.exporterImporterClass,
        exporter_importer_type: fields.exporterImporterType,
        type_of_firm: fields.typeOfFirm,
        msme_type: fields.msmeType,
        msme_no: fields.msmeNo,
        cin: fields.cin,
        tin: fields.tin,
        bin: fields.bin,
        dob_or_incorporation_date: fields.dobOrIncorporationDate,
        remarks: fields.remarks,
        party_role: fields.partyRole,
      })
      .select()
      .single()
    if (error || !data) return { party: null, error: error?.message ?? 'Could not create party.' }

    const party = rowToParty(data)
    set((s) => ({ parties: [party, ...s.parties] }))
    return { party, error: null }
  },

  updateParty: (partyId, field, value, actor) => {
    const p = get().parties.find((x) => x.id === partyId)
    if (!p) return
    const column = String(field).replace(/([A-Z])/g, '_$1').toLowerCase()
    const isRoles = field === 'roles'
    const rolesArr = isRoles ? value.split(',').map((r) => r.trim()).filter(Boolean) : null
    supabase
      .from('parties')
      .update({ [column]: isRoles ? rolesArr : value })
      .eq('id', partyId)
      .then(({ error }) => {
        if (error) console.error('updateParty failed', error)
      })
    set((s) => ({
      parties: s.parties.map((x) => (x.id === partyId ? { ...x, [field]: isRoles ? rolesArr : value } : x)),
      activities: log(s.activities, partyId, actor, `${String(field)} updated`),
    }))
  },

  fetchPartyChildren: async (partyId) => {
    const [branches, persons, docs] = await Promise.all([
      supabase.from('party_branches').select('*').eq('party_id', partyId).order('sr_no'),
      supabase.from('party_authorized_persons').select('*').eq('party_id', partyId),
      supabase.from('party_documents').select('*').eq('party_id', partyId).order('uploaded_at', { ascending: false }),
    ])
    set((s) => ({
      partyBranches: [
        ...s.partyBranches.filter((b) => b.partyId !== partyId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...((branches.data as any[]) ?? []).map(rowToPartyBranch),
      ],
      partyAuthorizedPersons: [
        ...s.partyAuthorizedPersons.filter((p) => p.partyId !== partyId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...((persons.data as any[]) ?? []).map(rowToPartyAuthorizedPerson),
      ],
      partyDocuments: [
        ...s.partyDocuments.filter((d) => d.partyId !== partyId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...((docs.data as any[]) ?? []).map(rowToPartyDocument),
      ],
    }))
  },

  addPartyBranch: async (partyId, branch) => {
    const { data, error } = await supabase
      .from('party_branches')
      .insert({
        party_id: partyId,
        address_type: branch.addressType,
        sr_no: branch.srNo,
        city: branch.city,
        address: branch.address,
        state: branch.state,
        country: branch.country,
        postal_code: branch.postalCode,
        gst_number: branch.gstNumber,
        contact_person: branch.contactPerson,
        email: branch.email,
        phone: branch.phone,
        fax: branch.fax,
        bank_branch: branch.bankBranch,
        account_type: branch.accountType,
        account_number: branch.accountNumber,
        ifsc: branch.ifsc,
      })
      .select()
      .single()
    if (error || !data) return { error: error?.message ?? 'Could not add branch.' }
    set((s) => ({ partyBranches: [...s.partyBranches, rowToPartyBranch(data)] }))
    return { error: null }
  },

  addPartyAuthorizedPerson: async (partyId, person) => {
    const { data, error } = await supabase
      .from('party_authorized_persons')
      .insert({
        party_id: partyId,
        name: person.name,
        designation: person.designation,
        contact_number: person.contactNumber,
        email: person.email,
        location: person.location,
      })
      .select()
      .single()
    if (error || !data) return { error: error?.message ?? 'Could not add authorized person.' }
    set((s) => ({ partyAuthorizedPersons: [...s.partyAuthorizedPersons, rowToPartyAuthorizedPerson(data)] }))
    return { error: null }
  },

  uploadPartyDocument: async (partyId, documentName, file, actor) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${partyId}/${Date.now()}_${safeName}`

    const { error: uploadErr } = await supabase.storage.from('party-documents').upload(path, file)
    if (uploadErr) return { error: uploadErr.message }

    const { data, error: insertErr } = await supabase
      .from('party_documents')
      .insert({
        party_id: partyId,
        document_name: documentName,
        storage_path: path,
        uploaded_by: actor,
        uploaded_at: now(),
      })
      .select()
      .single()
    if (insertErr || !data) return { error: insertErr?.message ?? 'Upload succeeded but saving the record failed.' }

    const party = get().parties.find((p) => p.id === partyId)
    set((s) => ({
      partyDocuments: [rowToPartyDocument(data), ...s.partyDocuments],
      // Notify Admin — same Approvals-queue mechanism every other
      // notification in this app uses (badge count + list), not a real
      // approval gate: the document is already saved regardless of decision.
      approvals: [
        {
          id: uid('ap'),
          entityType: 'party_document' as const,
          entityId: partyId,
          bookingId: null,
          summary: `${documentName} uploaded for ${party?.legalName ?? 'a party'} (${party?.code ?? partyId})`,
          requestedBy: actor,
          requestedAt: now(),
          status: 'Pending' as const,
        },
        ...s.approvals,
      ],
    }))
    return { error: null }
  },

  getPartyDocumentUrl: async (storagePath) => {
    const { data, error } = await supabase.storage.from('party-documents').createSignedUrl(storagePath, 60)
    if (error || !data) return null
    return data.signedUrl
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

    // Persist to Supabase in the background — UI already updated optimistically
    // above, so this doesn't block the wizard. On success, patch the real DB
    // uuid onto the booking (dbId) so it's ready for documents/etc. later.
    ;(async () => {
      const { data, error } = await supabase
        .from('bookings')
        .insert(bookingToInsertRow(booking))
        .select()
        .single()
      if (error || !data) {
        console.error('createBooking: failed to persist to Supabase', error)
        return
      }
      const dbId = data.id as string
      set((s) => ({
        bookings: s.bookings.map((x) => (x.id === id ? { ...x, dbId } : x)),
      }))
      if (chargeLines.length) {
        const rows = chargeLines.map((c) => ({
          booking_id: dbId,
          charge_code_id: c.chargeCodeId,
          charge_name: c.chargeName,
          type: c.type,
          amount: c.amount,
          currency: c.currency,
          vendor_id: c.vendorId,
        }))
        const { error: chargeErr } = await supabase.from('booking_charges').insert(rows)
        if (chargeErr) console.error('createBooking: failed to persist charges', chargeErr)
      }
    })()

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
      persistBookingUpdate(findDbId(s.bookings, bookingId), { cancelled: true, workflow_status: 'Cancelled' }, 'cancelBooking')
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
      persistBookingUpdate(booking.dbId, { etd: dates.etd, eta: dates.eta }, 'updateShipmentDates')
      return {
        bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, ...dates } : b)),
        activities: log(s.activities, bookingId, actor, `Shipment dates updated — ${changed.join(', ')}`),
      }
    }),

  updatePlannedDate: (bookingId, field, value, actor) =>
    set((s) => {
      const booking = s.bookings.find((b) => b.id === bookingId)
      if (!booking || (booking[field] ?? '') === value) return s
      const column = field.replace(/([A-Z])/g, '_$1').toLowerCase()
      persistBookingUpdate(booking.dbId, { [column]: value }, 'updatePlannedDate')
      return {
        bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, [field]: value } : b)),
        activities: log(s.activities, bookingId, actor, `${PLANNED_DATE_FIELD_LABELS[field]} set → ${value}`),
      }
    }),

  setBookingWorkflowStatus: (bookingId, status, actor) =>
    set((s) => {
      const booking = s.bookings.find((b) => b.id === bookingId)
      if (!booking || booking.workflowStatus === status) return s
      persistBookingUpdate(
        booking.dbId,
        { workflow_status: status, cancelled: status === 'Cancelled' },
        'setBookingWorkflowStatus',
      )
      return {
        bookings: s.bookings.map((b) =>
          b.id === bookingId
            ? { ...b, workflowStatus: status, cancelled: status === 'Cancelled' }
            : b,
        ),
        activities: log(s.activities, bookingId, actor, `Booking status → ${status}`),
      }
    }),

  setHazmatStatus: (bookingId, status, actor) =>
    set((s) => {
      const booking = s.bookings.find((b) => b.id === bookingId)
      if (!booking || booking.hazmatStatus === status) return s
      persistBookingUpdate(booking.dbId, { hazmat_status: status }, 'setHazmatStatus')
      return {
        bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, hazmatStatus: status } : b)),
        activities: log(s.activities, bookingId, actor, `Product info: cargo marked ${status}`),
      }
    }),

  updateHazmatDetail: (bookingId, field, value, actor) =>
    set((s) => {
      const booking = s.bookings.find((b) => b.id === bookingId)
      if (!booking || (booking.hazmatDetails?.[field] ?? '') === value) return s
      const nextDetails = { ...booking.hazmatDetails, [field]: value }
      persistBookingUpdate(booking.dbId, { hazmat_details: nextDetails }, 'updateHazmatDetail')
      return {
        bookings: s.bookings.map((b) =>
          b.id === bookingId
            ? { ...b, hazmatDetails: nextDetails }
            : b,
        ),
        activities: log(s.activities, bookingId, actor, `Hazmat ${field} updated`),
      }
    }),

  updateContainerInfoField: (bookingId, field, value, actor) =>
    set((s) => {
      const booking = s.bookings.find((b) => b.id === bookingId)
      if (!booking) return s
      const column = field.replace(/([A-Z])/g, '_$1').toLowerCase()
      const applied: string | number = NUMERIC_BOOKING_FIELDS.has(field) ? Number(value) || 0 : value
      if ((booking[field] ?? '') === applied) return s
      persistBookingUpdate(booking.dbId, { [column]: applied }, 'updateContainerInfoField')
      return {
        bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, [field]: applied } : b)),
        activities: log(s.activities, bookingId, actor, `${CONTAINER_INFO_FIELD_LABELS[field]} updated`),
      }
    }),

  requestBookingFieldChange: (bookingId, field, label, value, actor) =>
    set((s) => {
      const booking = s.bookings.find((b) => b.id === bookingId)
      if (!booking) return s
      const current = String((booking as unknown as Record<string, unknown>)[field] ?? '')
      if (current === value) return s
      // Refuse a duplicate request while one's already pending on this field.
      const alreadyPending = s.approvals.some(
        (a) => a.bookingId === bookingId && a.status === 'Pending' && a.fieldChange?.field === field,
      )
      if (alreadyPending) return s
      return {
        approvals: [
          {
            id: uid('ap'),
            entityType: 'booking_field_edit' as const,
            entityId: bookingId,
            bookingId,
            summary: `${label} change on ${booking.bookingRef}: ${current || '—'} → ${value}`,
            requestedBy: actor,
            requestedAt: now(),
            status: 'Pending' as const,
            fieldChange: { field, value },
          },
          ...s.approvals,
        ],
        activities: log(s.activities, bookingId, actor, `Requested ${label.toLowerCase()} change → ${value} (Admin approval required)`),
      }
    }),

  requestFfFieldChange: (shipmentId, field, label, value, actor) =>
    set((s) => {
      const shipment = s.ffShipments.find((f) => f.id === shipmentId)
      if (!shipment) return s
      const current = String((shipment as unknown as Record<string, unknown>)[field] ?? '')
      if (current === value) return s
      const alreadyPending = s.approvals.some(
        (a) => a.entityId === shipmentId && a.status === 'Pending' && a.fieldChange?.field === field,
      )
      if (alreadyPending) return s
      return {
        approvals: [
          {
            id: uid('ap'),
            entityType: 'ff_field_edit' as const,
            entityId: shipmentId,
            bookingId: null,
            summary: `${label} change on ${shipment.ref}: ${current || '—'} → ${value}`,
            requestedBy: actor,
            requestedAt: now(),
            status: 'Pending' as const,
            fieldChange: { field, value },
          },
          ...s.approvals,
        ],
        activities: log(s.activities, shipmentId, actor, `Requested ${label.toLowerCase()} change → ${value} (Admin approval required)`),
      }
    }),

  updateContainerDetails: (bookingId, details, actor) =>
    set((s) => {
      const booking = s.bookings.find((b) => b.id === bookingId)
      if (!booking) return s
      persistBookingUpdate(booking.dbId, { container_details: details }, 'updateContainerDetails')
      return {
        bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, containerDetails: details } : b)),
        activities: log(s.activities, bookingId, actor, 'Container details updated'),
      }
    }),

  updateTransshipmentAgent: (bookingId, value, actor) =>
    set((s) => {
      const booking = s.bookings.find((b) => b.id === bookingId)
      if (!booking || (booking.transshipmentAgent ?? '') === value) return s
      persistBookingUpdate(booking.dbId, { transshipment_agent: value }, 'updateTransshipmentAgent')
      return {
        bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, transshipmentAgent: value } : b)),
        activities: log(s.activities, bookingId, actor, 'Transshipment agent updated'),
      }
    }),

  updateEmptyYardField: (bookingId, field, value, actor) =>
    set((s) => {
      const booking = s.bookings.find((b) => b.id === bookingId)
      if (!booking || (booking[field] ?? '') === value) return s
      const label = field === 'emptyContainerYardOrigin' ? 'Empty container yard (origin)' : 'Empty container yard (destination)'
      const column = field.replace(/([A-Z])/g, '_$1').toLowerCase()
      persistBookingUpdate(booking.dbId, { [column]: value }, 'updateEmptyYardField')
      return {
        bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, [field]: value } : b)),
        activities: log(s.activities, bookingId, actor, `${label} updated`),
      }
    }),

  markMilestone: (bookingId, key, actor, completedAt) =>
    set((s) => {
      if (s.milestones.some((m) => m.bookingId === bookingId && m.key === key && m.completedAt)) return s
      const label = key.replace(/_/g, ' ')
      const resolvedAt = completedAt ?? now()
      persistMilestoneUpsert(findDbId(s.bookings, bookingId), key, resolvedAt, actor)
      return {
        milestones: [
          ...s.milestones.filter((m) => !(m.bookingId === bookingId && m.key === key)),
          { bookingId, key, completedAt: resolvedAt, completedBy: actor },
        ],
        activities: log(s.activities, bookingId, actor, `Milestone: ${label}`),
      }
    }),

  updateMilestoneDate: (bookingId, key, completedAt, actor) =>
    set((s) => {
      const entry = s.milestones.find((m) => m.bookingId === bookingId && m.key === key)
      if (!entry || !entry.completedAt || entry.completedAt === completedAt) return s
      const label = key.replace(/_/g, ' ')
      persistMilestoneUpsert(findDbId(s.bookings, bookingId), key, completedAt, actor)
      return {
        milestones: s.milestones.map((m) =>
          m.bookingId === bookingId && m.key === key ? { ...m, completedAt, completedBy: actor } : m,
        ),
        activities: log(s.activities, bookingId, actor, `Milestone date corrected (Admin): ${label} → ${completedAt}`),
      }
    }),

  generateCro: (bookingId, validUntil) =>
    set((s) => {
      if (s.cros.some((c) => c.bookingId === bookingId)) return s
      // No date given → default to 3 days from today, not left blank.
      const resolvedValidUntil =
        validUntil || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      persistCroInsert(findDbId(s.bookings, bookingId), resolvedValidUntil)
      persistMilestoneUpsert(findDbId(s.bookings, bookingId), 'cro_released', now(), 'MNR')
      return {
        cros: [
          { id: uid('cro'), bookingId, status: 'Issued', containerNo: null, issuedAt: now(), validUntil: resolvedValidUntil },
          ...s.cros,
        ],
        documents: [
          { id: uid('doc'), bookingId, docType: 'CRO' as const, status: 'uploaded' as const, uploadedBy: 'MNR', uploadedAt: now() },
          ...s.documents,
        ],
        milestones: [
          ...s.milestones.filter((m) => !(m.bookingId === bookingId && m.key === 'cro_released')),
          { bookingId, key: 'cro_released', completedAt: now(), completedBy: 'MNR' },
        ],
        activities: log(
          s.activities,
          bookingId,
          'MNR',
          `CRO generated and issued${resolvedValidUntil ? ` — valid until ${resolvedValidUntil}` : ''}`,
        ),
      }
    }),

  updateCroValidity: (bookingId, validUntil, actor) =>
    set((s) => {
      const cro = s.cros.find((c) => c.bookingId === bookingId)
      if (!cro || cro.validUntil === validUntil) return s
      persistCroValidity(findDbId(s.bookings, bookingId), validUntil)
      return {
        cros: s.cros.map((c) => (c.bookingId === bookingId ? { ...c, validUntil } : c)),
        activities: log(s.activities, bookingId, actor, `CRO validity updated → ${validUntil}`),
      }
    }),

  croPickup: (bookingId, containerNo) =>
    set((s) => {
      const dbId = findDbId(s.bookings, bookingId)
      const booking = s.bookings.find((b) => b.id === bookingId)
      persistCroUpdate(dbId, 'Container picked up', containerNo)
      persistMilestoneUpsert(dbId, 'container_picked_up', now(), 'MNR')
      persistContainerActivityUpsert(dbId, 'gate_out', now())
      if (booking) persistBookingUpdate(dbId, { container_nos: [...booking.containerNos, containerNo] }, 'croPickup')
      return {
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
      }
    }),

  saveBl: (bookingId, fields, actor, role) =>
    set((s) => {
      const dbId = findDbId(s.bookings, bookingId)
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
      persistBlVersionInsert(dbId, version)
      persistBlStateUpsert(dbId, existing ? 'Edited' : 'Draft', existing?.releaseType ?? null, fields)
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
      // Note: the approval itself stays local-only — the cross-cutting
      // `approvals` table isn't part of the NVOCC pilot schema yet.
      persistBlStatePatch(booking?.dbId, { lifecycle: 'Awaiting approval' }, 'submitCustomerBlEdit')
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

  approveBl: (bookingId, actor) =>
    set((s) => {
      const dbId = findDbId(s.bookings, bookingId)
      persistBlStatePatch(dbId, { lifecycle: 'Approved' }, 'approveBl')
      persistMilestoneUpsert(dbId, 'bl_draft_approved', now(), actor)
      return {
        blStates: s.blStates.map((b) =>
          b.bookingId === bookingId ? { ...b, lifecycle: 'Approved' } : b,
        ),
        milestones: [
          ...s.milestones.filter((m) => !(m.bookingId === bookingId && m.key === 'bl_draft_approved')),
          { bookingId, key: 'bl_draft_approved', completedAt: now(), completedBy: actor },
        ],
        activities: log(s.activities, bookingId, actor, 'BL approved and locked (Admin)'),
      }
    }),

  releaseBl: (bookingId, releaseType) =>
    set((s) => {
      const dbId = findDbId(s.bookings, bookingId)
      persistBlStatePatch(dbId, { lifecycle: 'Released', release_type: releaseType }, 'releaseBl')
      persistMilestoneUpsert(dbId, 'original_bl_released', now(), 'Ops')
      return {
        blStates: s.blStates.map((b) =>
          b.bookingId === bookingId ? { ...b, lifecycle: 'Released', releaseType } : b,
        ),
        milestones: [
          ...s.milestones.filter((m) => !(m.bookingId === bookingId && m.key === 'original_bl_released')),
          { bookingId, key: 'original_bl_released', completedAt: now(), completedBy: 'Ops' },
        ],
        activities: log(s.activities, bookingId, 'Ops', `BL released — ${releaseType}`),
      }
    }),

  uploadDocument: (bookingId, docType, actor) =>
    set((s) => {
      persistDocumentInsert(findDbId(s.bookings, bookingId), docType, actor)
      return {
        documents: [
          { id: uid('doc'), bookingId, docType, status: 'uploaded' as const, uploadedBy: actor, uploadedAt: now() },
          ...s.documents,
        ],
        activities: log(s.activities, bookingId, actor, `Document uploaded: ${docType}`),
      }
    }),

  fetchDocuments: async (bookingId) => {
    const dbId = findDbId(get().bookings, bookingId)
    if (!dbId) return
    const { data, error } = await supabase
      .from('booking_documents')
      .select('*')
      .eq('booking_id', dbId)
      .order('uploaded_at', { ascending: false })
    if (error || !data) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetched = (data as any[]).map((row) => ({
      id: row.id as string,
      bookingId,
      docType: row.doc_type as BookingDocument['docType'],
      status: row.status as DocStatus,
      uploadedBy: row.uploaded_by,
      uploadedAt: row.uploaded_at,
      storagePath: row.storage_path ?? undefined,
    }))
    set((s) => {
      const existingIds = new Set(s.documents.map((d) => d.id))
      const newOnes = fetched.filter((d) => !existingIds.has(d.id))
      return { documents: [...newOnes, ...s.documents] }
    })
  },

  uploadDocumentFile: async (bookingId, docType, actor, file) => {
    const dbId = findDbId(get().bookings, bookingId)
    if (!dbId) {
      return { error: 'This booking is demo data (not yet saved to the database) — real upload is unavailable for it.' }
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${dbId}/${docType}/${Date.now()}_${safeName}`

    const { error: uploadErr } = await supabase.storage.from('booking-documents').upload(path, file)
    if (uploadErr) return { error: uploadErr.message }

    const { data, error: insertErr } = await supabase
      .from('booking_documents')
      .insert({
        booking_id: dbId,
        doc_type: docType,
        status: 'uploaded',
        storage_path: path,
        uploaded_by: actor,
        uploaded_at: now(),
      })
      .select()
      .single()
    if (insertErr || !data) return { error: insertErr?.message ?? 'Upload succeeded but saving the record failed.' }

    set((s) => ({
      documents: [
        {
          id: data.id as string,
          bookingId,
          docType,
          status: 'uploaded',
          uploadedBy: actor,
          uploadedAt: data.uploaded_at as string,
          storagePath: path,
        },
        ...s.documents.filter((d) => !(d.bookingId === bookingId && d.docType === docType && !d.storagePath)),
      ],
      activities: log(s.activities, bookingId, actor, `Document uploaded: ${docType} (${file.name})`),
    }))
    return { error: null }
  },

  getDocumentUrl: async (storagePath) => {
    const { data, error } = await supabase.storage
      .from('booking-documents')
      .createSignedUrl(storagePath, 60)
    if (error || !data) return null
    return data.signedUrl
  },

  fetchFfDocuments: async (shipmentId) => {
    const dbId = findFfDbId(get().ffShipments, shipmentId)
    if (!dbId) return
    const { data, error } = await supabase
      .from('ff_documents')
      .select('*')
      .eq('ff_shipment_id', dbId)
      .order('uploaded_at', { ascending: false })
    if (error || !data) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetched = (data as any[]).map((row) => ({
      id: row.id as string,
      bookingId: shipmentId,
      docType: row.doc_type as BookingDocument['docType'],
      status: row.status as DocStatus,
      uploadedBy: row.uploaded_by,
      uploadedAt: row.uploaded_at,
      storagePath: row.storage_path ?? undefined,
    }))
    set((s) => {
      const existingIds = new Set(s.documents.map((d) => d.id))
      const newOnes = fetched.filter((d) => !existingIds.has(d.id))
      return { documents: [...newOnes, ...s.documents] }
    })
  },

  uploadFfDocumentFile: async (shipmentId, docType, actor, file) => {
    const dbId = findFfDbId(get().ffShipments, shipmentId)
    if (!dbId) {
      return { error: 'This shipment is demo data (not yet saved to the database) — real upload is unavailable for it.' }
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${dbId}/${docType}/${Date.now()}_${safeName}`

    const { error: uploadErr } = await supabase.storage.from('ff-documents').upload(path, file)
    if (uploadErr) return { error: uploadErr.message }

    const { data, error: insertErr } = await supabase
      .from('ff_documents')
      .insert({
        ff_shipment_id: dbId,
        doc_type: docType,
        status: 'uploaded',
        storage_path: path,
        uploaded_by: actor,
        uploaded_at: now(),
      })
      .select()
      .single()
    if (insertErr || !data) return { error: insertErr?.message ?? 'Upload succeeded but saving the record failed.' }

    set((s) => ({
      documents: [
        {
          id: data.id as string,
          bookingId: shipmentId,
          docType,
          status: 'uploaded',
          uploadedBy: actor,
          uploadedAt: data.uploaded_at as string,
          storagePath: path,
        },
        ...s.documents.filter((d) => !(d.bookingId === shipmentId && d.docType === docType && !d.storagePath)),
      ],
      activities: log(s.activities, shipmentId, actor, `Document uploaded: ${docType} (${file.name})`),
    }))
    return { error: null }
  },

  getFfDocumentUrl: async (storagePath) => {
    const { data, error } = await supabase.storage
      .from('ff-documents')
      .createSignedUrl(storagePath, 60)
    if (error || !data) return null
    return data.signedUrl
  },

  markContainerActivity: (bookingId, key, completedAt, actor) => {
    const wasCompleted = get()
      .containerActivities[bookingId]?.find((a) => a.key === key)?.completedAt
    const resolvedAt = completedAt ?? now()
    persistContainerActivityUpsert(findDbId(get().bookings, bookingId), key, resolvedAt)
    set((s) => ({
      containerActivities: {
        ...s.containerActivities,
        [bookingId]: (s.containerActivities[bookingId] ?? CONTAINER_ACTIVITY_DEFS.map((d) => ({ ...d, completedAt: null }))).map(
          (a) => (a.key === key ? { ...a, completedAt: resolvedAt } : a),
        ),
      },
      activities: log(
        s.activities,
        bookingId,
        actor ?? 'Ops',
        wasCompleted
          ? `Container activity date corrected (Admin): ${key.replace(/_/g, ' ')} → ${completedAt}`
          : `Container activity: ${key.replace(/_/g, ' ')}`,
      ),
    }))
  },

  addCharge: (c) => {
    const localId = uid('ch')
    set((s) => ({ charges: [...s.charges, { ...c, id: localId }] }))
    const dbId = findDbId(get().bookings, c.bookingId)
    if (dbId) {
      ;(async () => {
        const { data, error } = await supabase
          .from('booking_charges')
          .insert({
            booking_id: dbId,
            charge_code_id: c.chargeCodeId,
            charge_name: c.chargeName,
            type: c.type,
            amount: c.amount,
            currency: c.currency,
            vendor_id: c.vendorId,
          })
          .select()
          .single()
        if (error || !data) {
          console.error('addCharge: failed to persist', error)
          return
        }
        set((s) => ({
          charges: s.charges.map((x) => (x.id === localId ? { ...x, dbId: data.id as string } : x)),
        }))
      })()
    }
  },

  removeCharge: (chargeId) => {
    const charge = get().charges.find((c) => c.id === chargeId)
    set((s) => ({ charges: s.charges.filter((c) => c.id !== chargeId) }))
    if (charge?.dbId) {
      ;(async () => {
        const { error } = await supabase.from('booking_charges').delete().eq('id', charge.dbId)
        if (error) console.error('removeCharge: failed to persist', error)
      })()
    }
  },

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

  fetchFfShipments: async () => {
    const { data, error } = await supabase
      .from('ff_shipments')
      .select('*')
      .order('created_at', { ascending: false })
    if (error || !data) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetched = (data as any[]).map(rowToFfShipment)
    set((s) => {
      const existingRefs = new Set(s.ffShipments.map((f) => f.ref))
      const newOnes = fetched.filter((f) => !existingRefs.has(f.ref))
      const patched = s.ffShipments.map((f) => {
        const match = fetched.find((x) => x.ref === f.ref)
        return match ? { ...f, dbId: match.dbId } : f
      })
      return { ffShipments: [...newOnes, ...patched] }
    })
  },

  createFfShipment: (s, vendorLines) => {
    const st = get()
    const maxSeq = st.ffShipments.reduce((max, x) => {
      const m = x.ref.match(/^KINFF-(\d{4})/)
      return m ? Math.max(max, +m[1]) : max
    }, 30)
    const ref = `KINFF-${String(maxSeq + 1).padStart(4, '0')}`
    const id = ref
    // Flow 1 credit gate: over the sell-amount limit → held for Finance
    // sign-off. Any Days of Credit at all is a second, separate trigger for
    // the same hold — that one needs Admin sign-off specifically.
    const overSellLimit = s.sellAmount > CREDIT_LIMIT_USD
    const hasCreditDays = (s.daysOfCredit ?? 0) > 0
    const creditHold = overSellLimit || hasCreditDays
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
    const holdReasons: string[] = []
    if (overSellLimit) holdReasons.push(`sell $${s.sellAmount.toLocaleString()} exceeds limit ($${CREDIT_LIMIT_USD.toLocaleString()}) — Finance sign-off`)
    if (hasCreditDays) holdReasons.push(`${s.daysOfCredit} days of credit requested — Admin sign-off`)

    set((state) => ({
      ffShipments: [shipment, ...state.ffShipments],
      approvals: creditHold
        ? [
            {
              id: uid('ap'),
              entityType: 'credit_hold' as const,
              entityId: id,
              bookingId: null,
              summary: `Credit clearance ${ref} — ${s.customerName}: ${holdReasons.join('; ')}`,
              requestedBy: 'System (credit gate)',
              requestedAt: now(),
              status: 'Pending' as const,
              // Marks this hold as Admin-only to decide (see ApprovalRow's
              // adminOnly check) — set whenever days-of-credit is part of
              // why it's held, even if the sell-limit reason is ALSO
              // present, since Admin can cover both.
              ...(hasCreditDays ? { fieldChange: { field: 'daysOfCredit', value: String(s.daysOfCredit) } } : {}),
            },
            ...state.approvals,
          ]
        : state.approvals,
      activities: log(
        state.activities,
        id,
        'BD/Ops',
        `FF booking ${ref} created (${s.mode})${creditHold ? ` — HELD: ${holdReasons.join('; ')}` : ''}${s.isConsolParent ? ' — LCL consolidation parent' : ''}`,
      ),
    }))

    // Persist to Supabase in the background — same optimistic pattern as
    // NVOCC's createBooking. Patches dbId onto the shipment on success and
    // inserts its vendor lines, ready for later actions/documents.
    ;(async () => {
      const { data, error } = await supabase
        .from('ff_shipments')
        .insert(ffShipmentToInsertRow(shipment))
        .select()
        .single()
      if (error || !data) {
        console.error('createFfShipment: failed to persist to Supabase', error)
        return
      }
      const dbId = data.id as string
      set((state) => ({
        ffShipments: state.ffShipments.map((x) => (x.id === id ? { ...x, dbId } : x)),
      }))
      // Inserted one at a time (not a batch) so each real row's id can be
      // matched back to its local line — needed later by ffMatchVendorBill.
      for (const v of shipment.vendorLines) {
        const { data: vRow, error: vErr } = await supabase
          .from('ff_vendor_lines')
          .insert({
            ff_shipment_id: dbId,
            role: v.role,
            vendor_id: v.vendorId,
            vendor_name: v.vendorName,
            buy_amount: v.buyAmount,
            billed_amount: v.billedAmount,
            variance_flag: v.varianceFlag,
          })
          .select()
          .single()
        if (vErr || !vRow) {
          console.error('createFfShipment: failed to persist a vendor line', vErr)
          continue
        }
        const vendorDbId = vRow.id as string
        set((state) => ({
          ffShipments: state.ffShipments.map((x) =>
            x.id === id
              ? { ...x, vendorLines: x.vendorLines.map((line) => (line.id === v.id ? { ...line, dbId: vendorDbId } : line)) }
              : x,
          ),
        }))
      }
    })()

    return id
  },

  addChildHbl: (parentId, child) => {
    const parent = get().ffShipments.find((f) => f.id === parentId)
    if (!parent || parent.consolClosed) return
    const childCount = get().ffShipments.filter((f) => f.parentId === parentId).length
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
    set((s) => ({
      ffShipments: [...s.ffShipments, shipment],
      activities: log(s.activities, parentId, 'Ops', `Child HBL ${ref} added — ${child.customerName} (manifest auto-updated)`),
    }))

    // Persist the child as its own ff_shipments row — same fire-and-forget
    // pattern as createFfShipment. Only proceeds if the parent itself has a
    // real dbId; a demo-data parent has nothing to link a child DB row to.
    if (parent.dbId) {
      ;(async () => {
        const { data, error } = await supabase
          .from('ff_shipments')
          .insert({ ...ffShipmentToInsertRow(shipment), parent_id: parent.dbId })
          .select()
          .single()
        if (error || !data) {
          console.error('addChildHbl: failed to persist to Supabase', error)
          return
        }
        const dbId = data.id as string
        set((s) => ({
          ffShipments: s.ffShipments.map((x) => (x.id === ref ? { ...x, dbId } : x)),
        }))
      })()
    }
  },

  closeConsolRun: (parentId) =>
    set((s) => {
      const parent = s.ffShipments.find((f) => f.id === parentId)
      const children = s.ffShipments.filter((f) => f.parentId === parentId)
      if (!parent || children.length === 0) return s
      // Container-level cost apportioned across child HBLs by revenue share
      const containerCost = buyTotal(parent)
      const totalSell = children.reduce((a, c) => a + c.sellAmount, 0) || 1

      persistFfUpdate(parent.dbId, { consol_closed: true }, 'closeConsolRun')

      return {
        ffShipments: s.ffShipments.map((f) => {
          if (f.id === parentId) return { ...f, consolClosed: true }
          if (f.parentId === parentId) {
            const share = Math.round(containerCost * (f.sellAmount / totalSell))
            const newLine = {
              id: uid('fv'),
              role: 'Carrier' as const,
              vendorId: 'vn1',
              vendorName: 'Apportioned container cost (by revenue share)',
              buyAmount: share,
              billedAmount: null,
              varianceFlag: false,
            }
            // Real insert for the new apportioned line, if this child has a
            // real dbId — mirrors createFfShipment's per-line insert so the
            // returned id can be patched back for later ffMatchVendorBill.
            if (f.dbId) {
              ;(async () => {
                const { data, error } = await supabase
                  .from('ff_vendor_lines')
                  .insert({
                    ff_shipment_id: f.dbId,
                    role: newLine.role,
                    vendor_id: newLine.vendorId,
                    vendor_name: newLine.vendorName,
                    buy_amount: newLine.buyAmount,
                    billed_amount: newLine.billedAmount,
                    variance_flag: newLine.varianceFlag,
                  })
                  .select()
                  .single()
                if (error || !data) {
                  console.error('closeConsolRun: failed to persist apportioned vendor line', error)
                  return
                }
                const vendorDbId = data.id as string
                set((state) => ({
                  ffShipments: state.ffShipments.map((x) =>
                    x.id === f.id
                      ? { ...x, vendorLines: x.vendorLines.map((v) => (v.id === newLine.id ? { ...v, dbId: vendorDbId } : v)) }
                      : x,
                  ),
                }))
              })()
            }
            return { ...f, vendorLines: [newLine] }
          }
          return f
        }),
        activities: log(s.activities, parentId, 'Ops', `Consolidation run closed — $${containerCost.toLocaleString()} apportioned across ${children.length} child HBL(s); container milestones now apply to all`),
      }
    }),

  ffConfirmCarrier: (id, opts) =>
    set((s) => {
      persistFfUpdate(
        findFfDbId(s.ffShipments, id),
        { linked_nvocc_ref: opts.linkedNvoccRef, carrier_name: opts.carrierName, agent_id: opts.agentId, rate_reconfirmed: true },
        'ffConfirmCarrier',
      )
      return {
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
      }
    }),

  ffPickupComplete: (id) =>
    set((s) => {
      persistFfUpdate(findFfDbId(s.ffShipments, id), { pickup_proof: true, stage: 'Documentation' }, 'ffPickupComplete')
      return {
        ffShipments: s.ffShipments.map((f) =>
          f.id === id ? { ...f, pickupProof: true, stage: 'Documentation' } : f,
        ),
        activities: log(s.activities, id, 'Transporter', 'Cargo collected — signed proof of collection logged as milestone'),
      }
    }),

  updateFfField: (shipmentId, field, value, actor) =>
    set((s) => {
      const f = s.ffShipments.find((x) => x.id === shipmentId)
      if (!f || (f[field] ?? '') === value) return s
      const column = String(field).replace(/([A-Z])/g, '_$1').toLowerCase()
      persistFfUpdate(f.dbId, { [column]: value }, 'updateFfField')
      return {
        ffShipments: s.ffShipments.map((x) => (x.id === shipmentId ? { ...x, [field]: value } : x)),
        activities: log(s.activities, shipmentId, actor, `${String(field)} updated`),
      }
    }),

  setFfWorkflowStatus: (shipmentId, status, actor) =>
    set((s) => {
      const f = s.ffShipments.find((x) => x.id === shipmentId)
      if (!f || f.workflowStatus === status) return s
      persistFfUpdate(f.dbId, { workflow_status: status }, 'setFfWorkflowStatus')
      return {
        ffShipments: s.ffShipments.map((x) => (x.id === shipmentId ? { ...x, workflowStatus: status } : x)),
        activities: log(s.activities, shipmentId, actor, `Shipment status → ${status}`),
      }
    }),

  setFfHazmatStatus: (shipmentId, status, actor) =>
    set((s) => {
      const f = s.ffShipments.find((x) => x.id === shipmentId)
      if (!f || f.hazmatStatus === status) return s
      persistFfUpdate(f.dbId, { hazmat_status: status }, 'setFfHazmatStatus')
      return {
        ffShipments: s.ffShipments.map((x) => (x.id === shipmentId ? { ...x, hazmatStatus: status } : x)),
        activities: log(s.activities, shipmentId, actor, `Product info: cargo marked ${status}`),
      }
    }),

  updateFfHazmatDetail: (shipmentId, field, value, actor) =>
    set((s) => {
      const f = s.ffShipments.find((x) => x.id === shipmentId)
      if (!f || (f.hazmatDetails?.[field] ?? '') === value) return s
      const nextDetails = { ...f.hazmatDetails, [field]: value }
      persistFfUpdate(f.dbId, { hazmat_details: nextDetails }, 'updateFfHazmatDetail')
      return {
        ffShipments: s.ffShipments.map((x) =>
          x.id === shipmentId ? { ...x, hazmatDetails: nextDetails } : x,
        ),
        activities: log(s.activities, shipmentId, actor, `Hazmat ${field} updated`),
      }
    }),

  ffDocAction: (id, action, releaseType) =>
    set((s) => {
      const f = s.ffShipments.find((x) => x.id === id)
      if (!f) return s
      let patchS: Partial<FfShipment> = {}
      let patchDb: Record<string, unknown> = {}
      let msg = ''
      switch (action) {
        case 'si_received':
          patchS = { siReceived: true }
          patchDb = { si_received: true }
          msg = 'Shipping Instructions received — completeness checked'
          break
        case 'weight_variance':
          patchS = { weightVarianceFlagged: true }
          patchDb = { weight_variance_flagged: true }
          msg = 'Weight/measure variance vs cargo receipt beyond tolerance — Ops sign-off required'
          break
        case 'mbl_uploaded':
          patchS = { mblUploaded: true }
          patchDb = { mbl_uploaded: true }
          msg = 'Master document (MBL/MAWB) received from carrier and uploaded'
          break
        case 'draft_house':
          patchS = { houseDocStatus: 'Draft', houseDocVersion: f.houseDocVersion + 1 }
          patchDb = { house_doc_status: 'Draft', house_doc_version: f.houseDocVersion + 1 }
          msg = `House ${f.mode === 'Air' ? 'AWB' : 'BL'} auto-drafted from SI + booking data (governed fields, clause library) — v${f.houseDocVersion + 1}`
          break
        case 'customer_edit':
          patchS = { houseDocStatus: 'Awaiting approval' }
          patchDb = { house_doc_status: 'Awaiting approval' }
          msg = 'Customer edit on governed fields — routed to Ops Approval Queue'
          break
        case 'release':
          patchS = { houseDocStatus: 'Released', houseReleaseType: releaseType ?? 'Original', stage: 'Export & Transit' }
          patchDb = { house_doc_status: 'Released', house_release_type: releaseType ?? 'Original', stage: 'Export & Transit' }
          msg = `House document RELEASED (${releaseType}) — locked; further edits need a formal Amendment`
          break
      }
      persistFfUpdate(f.dbId, patchDb, 'ffDocAction')
      const extra: Partial<DataState> = {}
      if (action === 'customer_edit') {
        // Approval itself stays local-only — no approvals table yet, same
        // as NVOCC's submitCustomerBlEdit.
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
      let patchDb: Record<string, unknown> = {}
      let msg = ''
      switch (action) {
        case 'broker':
          patchS = { brokerAssigned: true }
          patchDb = { broker_assigned: true }
          msg = 'Customs broker assigned — shipping bill / export declaration filed before cut-off'
          break
        case 'hold':
          patchS = { exportHold: true }
          patchDb = { export_hold: true }
          msg = 'EXPORT CUSTOMS HOLD — Ops + customer notified'
          break
        case 'resolve_hold':
          patchS = { exportHold: false }
          patchDb = { export_hold: false }
          msg = 'Export hold resolved with broker'
          break
        case 'let_export':
          patchS = { letExportReceived: true }
          patchDb = { let_export_received: true }
          msg = '"Let Export Order" / export clearance received'
          break
        case 'gate_in_vgm':
          patchS = { gateInDone: true, vgmDone: true }
          patchDb = { gate_in_done: true, vgm_done: true }
          msg = f.mode === 'Air' ? 'Cargo tendered to airline — final SI/chargeable weight submitted' : 'Gate-in done — VGM submitted with final SI before carrier cut-off'
          break
        case 'cutoff_met':
          patchS = { cutoffMet: true }
          patchDb = { cutoff_met: true }
          msg = 'Cut-off met — on schedule'
          break
        case 'cutoff_missed':
          patchS = { cutoffMet: false }
          patchDb = { cutoff_met: false }
          msg = 'CUT-OFF MISSED — delay flag raised, re-plan to next sailing/flight'
          break
        case 'depart':
          patchS = { departed: true, cutoffMet: true, stage: 'Arrival & Delivery' }
          patchDb = { departed: true, cutoff_met: true, stage: 'Arrival & Delivery' }
          msg = 'Departed — SOB/uplift confirmation received, notation added to released house document; in-transit vs ETA'
          break
      }
      persistFfUpdate(f.dbId, patchDb, 'ffExportAction')
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
      let patchDb: Record<string, unknown> = {}
      let msg = ''
      switch (action) {
        case 'arrival_notice':
          patchS = { arrivalNoticeSent: true }
          patchDb = { arrival_notice_sent: true }
          msg = 'Arrival Notice auto-generated → consignee/notify party; destination agent takes over'
          break
        case 'import_hold':
          patchS = { importHold: true }
          patchDb = { import_hold: true }
          msg = 'IMPORT CUSTOMS HOLD — Ops + customer notified'
          break
        case 'resolve_hold':
          patchS = { importHold: false }
          patchDb = { import_hold: false }
          msg = 'Import hold resolved with broker'
          break
        case 'out_of_charge':
          patchS = { outOfCharge: true }
          patchDb = { out_of_charge: true }
          msg = 'Bill of Entry filed, duty paid — "Out of Charge" customs release confirmed'
          break
        case 'dd_customer':
          patchS = { ddOutcome: 'Customer-billed' }
          patchDb = { dd_outcome: 'Customer-billed' }
          msg = 'Free time exceeded — D&D charge auto-drafted, customer-caused → billed to customer'
          break
        case 'dd_absorbed':
          patchS = { ddOutcome: 'Absorbed' }
          patchDb = { dd_outcome: 'Absorbed' }
          msg = 'Free time exceeded — carrier/Kinetic-caused → absorbed as operational cost'
          break
        case 'dd_none':
          patchS = { ddOutcome: 'None' }
          patchDb = { dd_outcome: 'None' }
          msg = 'Gate-out within free time — no D&D exposure'
          break
        case 'issue_do':
          patchS = { doIssued: true }
          patchDb = { do_issued: true }
          msg = 'Delivery Order issued — last-mile transport dispatched'
          break
        case 'pod':
          patchS = { podCaptured: true, stage: 'Financial Close' }
          patchDb = { pod_captured: true, stage: 'Financial Close' }
          msg = 'POD (signature/photo) captured — booking status → Delivered; financial closure begins'
          break
      }
      persistFfUpdate(f.dbId, patchDb, 'ffArrivalAction')
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
      persistFfUpdate(f.dbId, { client_invoiced: true }, 'ffInvoiceClient')
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
      persistFfVendorLineUpdate(line.dbId, { billed_amount: billedAmount, variance_flag: flag }, 'ffMatchVendorBill')
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
    set((s) => {
      persistFfUpdate(findFfDbId(s.ffShipments, id), { paid: true }, 'ffMarkPaid')
      return {
        ffShipments: s.ffShipments.map((x) => (x.id === id ? { ...x, paid: true } : x)),
        activities: log(s.activities, id, 'Finance', 'Client payment received in full — marked Paid'),
      }
    }),

  ffFinancialClose: (id) =>
    set((s) => {
      const f = s.ffShipments.find((x) => x.id === id)
      if (!f) return s
      const allMatched = f.vendorLines.length > 0 && f.vendorLines.every((v) => v.billedAmount !== null)
      if (!f.paid || !allMatched) return s
      persistFfUpdate(f.dbId, { stage: 'Closed' }, 'ffFinancialClose')
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
            // Approving the change request only merges the edit and un-locks it —
            // final BL approval ("Approve & lock") is a separate, Admin-only step,
            // even for a change Admin just cleared through this queue.
            blStates: s.blStates.map((b) =>
              b.bookingId === ap.bookingId
                ? { ...b, lifecycle: 'Edited', currentFields: { ...b.currentFields, ...ap.payload } }
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
        } else if (ap.entityType === 'booking_field_edit' && ap.bookingId && ap.fieldChange) {
          const { field, value } = ap.fieldChange
          const target = s.bookings.find((b) => b.id === ap.bookingId)
          const column = field.replace(/([A-Z])/g, '_$1').toLowerCase()
          const applied: string | number = NUMERIC_BOOKING_FIELDS.has(field) ? Number(value) || 0 : value
          persistBookingUpdate(target?.dbId, { [column]: applied }, 'decideApproval:booking_field_edit')
          patch = {
            bookings: s.bookings.map((b) => (b.id === ap.bookingId ? { ...b, [field]: applied } : b)),
          }
        } else if (ap.entityType === 'ff_field_edit' && ap.fieldChange) {
          const { field, value } = ap.fieldChange
          const target = s.ffShipments.find((f) => f.id === ap.entityId)
          const column = field.replace(/([A-Z])/g, '_$1').toLowerCase()
          persistFfUpdate(target?.dbId, { [column]: value }, 'decideApproval:ff_field_edit')
          patch = {
            ffShipments: s.ffShipments.map((f) => (f.id === ap.entityId ? { ...f, [field]: value } : f)),
          }
        }
      } else if (ap.entityType === 'bl_edit' && ap.bookingId) {
        patch = {
          blStates: s.blStates.map((b) =>
            b.bookingId === ap.bookingId ? { ...b, lifecycle: 'Edited' } : b,
          ),
        }
      }
      // ff_field_edit has no bookingId (it's FF-sourced) — log against
      // entityId (the FF shipment's local id) instead so the decision still
      // shows up in that shipment's activity log. credit_hold is FF-sourced
      // too but returns early above, so it never reaches here.
      const activityTarget = ap.bookingId ?? (ap.entityType === 'ff_field_edit' ? ap.entityId : null)
      return {
        ...patch,
        approvals: s.approvals.map((a) => (a.id === approvalId ? { ...a, status: decision } : a)),
        activities: activityTarget
          ? log(s.activities, activityTarget, 'Ops', `Approval ${decision.toLowerCase()}: ${ap.summary}`)
          : s.activities,
      }
    }),
}))
