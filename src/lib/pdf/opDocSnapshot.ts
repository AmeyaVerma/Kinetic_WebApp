import type { Booking } from '../types'
import { fmtDate, fmtWeight } from './format'

/**
 * The frozen printed values for the five operational documents (CRO, Onboard
 * Confirmation, CAN, Delivery Order, Off Loading Letter).
 *
 * One type rather than five: the documents overlap by roughly three quarters
 * -- company block, booking reference, vessel and voyage, the four ports,
 * the container list, shipper and consignee -- and five near-identical types
 * would drift apart under editing. Each template reads the subset it prints
 * and ignores the rest; the per-document fields are grouped and labelled
 * below so it stays obvious which document owns what.
 *
 * As with the BL, the renderer reads ONLY from a snapshot. A generated
 * document keeps printing what it said even after the booking, the depot
 * master or the company address changes.
 */

export type OpDocType = 'cro' | 'onboard' | 'can' | 'do' | 'offloading'

export interface DocCompany {
  legalName: string
  /** CRO and Off Loading print "Principal", which may differ in spelling. */
  principalName: string
  corporateAddress: string
  gstAddress: string
  tel: string
  email: string
  website: string
}

export interface DocContainerRow {
  containerNo: string
  size: string
  type: string
  sealNo: string
  grossWeight: string
  netWeight: string
  packages: string
  /** Delivery Order: Laden or Empty. */
  status: string
  /** Off Loading Letter: entered per container, no auto rule. */
  acceptUpto: string
}

/** An address block resolved for printing, with the tax ids these docs show. */
export interface DocParty {
  name: string
  address: string
  gstin: string
  iec: string
  trn: string
  contactName: string
  email: string
  phone: string
}

export interface OpDocSnapshot {
  docType: OpDocType
  /** Stamped when the version is generated. */
  date: string
  company: DocCompany

  bookingRef: string
  /** Customer's own reference, distinct from bookingRef. */
  customerReference: string
  principal: string

  shipper: DocParty
  consignee: DocParty

  vessel: string
  voyage: string
  shippingLine: string
  terminal: string
  portOfReceipt: string
  pol: string
  pod: string
  finalDestination: string
  etd: string
  eta: string
  sob: string
  gateOpen: string
  gateCutOff: string

  commodity: string
  packages: string
  packageType: string
  netWeightKgs: string
  grossWeightKgs: string
  containers: DocContainerRow[]
  shipmentType: string
  shipmentTerms: string
  freeDays: string
  cfs: string

  hblNo: string
  hblDate: string
  mblNo: string
  mblDate: string

  igmNo: string
  igmDate: string
  itemNumber: string

  /** CRO ------------------------------------------------------------- */
  depotName: string
  depotAddress: string
  depotAttn: string
  depotPhone: string
  depotEmail: string
  /** Editable per CRO; seeded from the depot master's default lines. */
  instructions: string[]
  /** "2X20 GP" -- one CRO per equipment group. */
  equipmentGroup: string
  surveyorName: string
  surveyorAddress: string
  surveyorPhone: string
  validTill: string

  /** Delivery Order -------------------------------------------------- */
  doNumber: string
  doTo: string
  chaName: string
  arrivalDate: string
  destuffingType: string
  placeOfSurvey: string
  validUpto: string
  /** The depot the empties go back to; printed inside the terms bullet. */
  returnDepot: string

  /** Off Loading ------------------------------------------------------ */
  doType: string

  /** Onboard ----------------------------------------------------------- */
  printedBy: string
  sbNumber: string
  sbDate: string
}

/** Required before a document should be generated, per document. */
const REQUIRED: Record<OpDocType, { key: keyof OpDocSnapshot; label: string }[]> = {
  cro: [
    { key: 'depotName', label: 'Depot (To)' },
    { key: 'equipmentGroup', label: 'Equipment group' },
    { key: 'shipper', label: 'Shipper' },
    { key: 'pod', label: 'Port of discharge' },
  ],
  onboard: [
    { key: 'shipper', label: 'Shipper' },
    { key: 'consignee', label: 'Consignee' },
    { key: 'vessel', label: 'Vessel' },
    { key: 'sob', label: 'Shipped on board date' },
  ],
  can: [
    { key: 'consignee', label: 'Consignee' },
    { key: 'vessel', label: 'Vessel' },
    { key: 'pod', label: 'Port of discharge' },
    { key: 'hblNo', label: 'B/L number' },
  ],
  do: [
    { key: 'chaName', label: 'CHA' },
    { key: 'validUpto', label: 'Valid upto date' },
    { key: 'consignee', label: 'Consignee' },
    { key: 'doNumber', label: 'DO number' },
  ],
  offloading: [
    { key: 'depotName', label: 'Depot (To)' },
    { key: 'consignee', label: 'Consignee' },
  ],
}

/**
 * Required fields still empty. The five documents warn and allow generation
 * anyway (brief 8.3) -- unlike the BL, which blocks -- so this returns a
 * list to show rather than a gate.
 */
export function missingDocFields(snapshot: OpDocSnapshot): string[] {
  return REQUIRED[snapshot.docType]
    .filter((f) => {
      const v = snapshot[f.key]
      if (v && typeof v === 'object' && 'name' in v) return !(v as DocParty).name.trim()
      return typeof v !== 'string' || v.trim() === ''
    })
    .map((f) => f.label)
}

/** Groups a booking's containers into equipment groups: "2X20", "1X40". */
export function equipmentGroups(booking: Booking): { code: string; size: string; count: number }[] {
  const details = booking.containerDetails ?? []
  const counts = new Map<string, number>()
  for (const d of details) {
    const size = (d.containerType ?? booking.containerType ?? '').match(/\d{2}/)?.[0]
    if (!size) continue
    counts.set(size, (counts.get(size) ?? 0) + 1)
  }
  if (counts.size === 0 && booking.containerType) {
    const size = booking.containerType.match(/\d{2}/)?.[0]
    if (size) counts.set(size, booking.containerQty || 1)
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([size, count]) => ({ code: count + 'X' + size, size, count }))
}

export interface BuildOpDocInput {
  docType: OpDocType
  booking: Booking
  company: DocCompany
  /** CRO only: which equipment group this document covers. */
  equipmentGroup?: string
  printedBy?: string
  overrides?: Partial<OpDocSnapshot>
}

/**
 * Builds printed values from a booking. Everything not derivable from the
 * booking today -- CHA, surveyor, depot contact details, IGM, shipping bill
 * -- comes back empty and is filled in on the document itself, which is why
 * every document is editable before generation.
 */
export function buildOpDocSnapshot({
  docType,
  booking,
  company,
  equipmentGroup = '',
  printedBy = '',
  overrides,
}: BuildOpDocInput): OpDocSnapshot {
  const rows: DocContainerRow[] = (booking.containerDetails ?? [])
    .filter((d) => (d.containerNo ?? '').trim() !== '')
    .map((d) => ({
      containerNo: (d.containerNo ?? '').toUpperCase(),
      size: (d.containerType ?? '').match(/\d{2}/)?.[0] ?? '',
      type: (d.containerType ?? '').replace(/\d{2}\s*(ft|')?/i, '').trim().toUpperCase(),
      sealNo: (d.sealNo ?? '').toUpperCase(),
      grossWeight: d.grossWeight ? fmtWeight(d.grossWeight) : '',
      netWeight: d.netWeight ? fmtWeight(d.netWeight) : '',
      packages: d.noOfPkgs ?? '',
      status: d.emptyLaden ?? 'Laden',
      acceptUpto: '',
    }))

  const emptyParty: DocParty = {
    name: '',
    address: '',
    gstin: '',
    iec: '',
    trn: '',
    contactName: '',
    email: '',
    phone: '',
  }

  const base: OpDocSnapshot = {
    docType,
    date: fmtDate(new Date()),
    company,

    bookingRef: booking.bookingRef ?? '',
    customerReference: '',
    principal: company.principalName,

    // shipper/consignee are plain text on bookings today, so the address and
    // tax ids cannot be resolved until the party links exist.
    shipper: { ...emptyParty, name: booking.shipper ?? '' },
    consignee: { ...emptyParty, name: booking.consignee ?? '' },

    vessel: booking.vesselName ?? '',
    voyage: booking.voyageNo ?? '',
    shippingLine: '',
    terminal: booking.terminal ?? '',
    portOfReceipt: booking.portOfReceipt ?? '',
    pol: booking.pol ?? '',
    pod: booking.pod ?? '',
    finalDestination: booking.finalPlaceOfDischarge ?? '',
    etd: fmtDate(booking.etd),
    eta: fmtDate(booking.eta),
    sob: '',
    gateOpen: fmtDate(booking.plannedGateOpen),
    gateCutOff: fmtDate(booking.plannedGateClose),

    commodity: booking.commodity ?? '',
    packages: booking.packages ? String(booking.packages) : '',
    packageType: booking.packageType ?? '',
    netWeightKgs: '',
    grossWeightKgs: booking.grossWeightKg ? fmtWeight(booking.grossWeightKg) : '',
    containers: rows,
    shipmentType: 'FCL',
    shipmentTerms: '',
    freeDays: String(
      booking.direction === 'Import' ? (booking.freeDaysDest ?? '') : (booking.freeDaysOrigin ?? ''),
    ),
    cfs: '',

    hblNo: booking.hblNo ?? '',
    hblDate: '',
    mblNo: booking.mblNo ?? '',
    mblDate: '',

    igmNo: '',
    igmDate: '',
    itemNumber: '',

    depotName: '',
    depotAddress: '',
    depotAttn: '',
    depotPhone: '',
    depotEmail: '',
    instructions: [],
    equipmentGroup,
    surveyorName: '',
    surveyorAddress: '',
    surveyorPhone: '',
    validTill: '',

    // O2: defaults to the booking reference, editable per DO.
    doNumber: booking.bookingRef ?? '',
    doTo: 'THE MANAGER',
    chaName: '',
    arrivalDate: fmtDate(booking.eta),
    destuffingType: '',
    placeOfSurvey: '',
    validUpto: '',
    returnDepot: '',

    doType: '',

    printedBy,
    sbNumber: '',
    sbDate: '',
  }

  return { ...base, ...overrides }
}
