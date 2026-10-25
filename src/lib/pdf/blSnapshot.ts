import type { BlType } from './strings/bl'

/**
 * The frozen set of printed values for one BL version.
 *
 * The renderer reads ONLY from here -- never from the booking, the masters or
 * the store. That is what makes an issued BL immutable: editing the booking
 * afterwards cannot reach a snapshot that was already written, so reprinting
 * version 2 a year later produces exactly what was sent.
 *
 * While the BL is a Draft the snapshot is rebuilt from the booking on every
 * render, so a draft tracks the booking live. On Issue it is written to
 * document_versions and never rebuilt.
 */
export interface BlSnapshot {
  blNumber: string
  blType: BlType
  printMode: 'Original' | 'Scan'
  shipmentReference: string

  /** Address blocks print as entered, newlines preserved. */
  consignor: string
  consignee: string
  notifyAddress: string
  deliveryAgent: string

  preCarriageBy: string
  portOfReceipt: string
  oceanVessel: string
  voyageNo: string
  portOfLoading: string
  portOfDischarge: string
  finalPortOfDelivery: string
  modeOfTransport: string
  routeOrTransshipment: string

  /** Left column of the cargo block: container no / seal / size-type. */
  marksAndNumbers: string
  /** Replaced by "AS PER ATTACHED CONTAINER SHEET" when the sheet is used. */
  useContainerSheet: boolean
  packagesAndDescription: string
  grossWeightKgs: string
  measurementM3: string

  freightTerms: string
  freightPayableAt: string
  placeAndDateOfIssue: string
  otherParticulars: string

  /** Company block, resolved from company_settings at snapshot time. */
  company: {
    legalName: string
    addressLines: string[]
    telEmailLine: string
    webLine: string
    mtoRegistration: string
    tagline: string
  }
}

/** Fields that must be present before a non-Draft BL may be issued. */
export const BL_REQUIRED_FIELDS: { key: keyof BlSnapshot; label: string }[] = [
  { key: 'consignor', label: 'Shipper' },
  { key: 'consignee', label: 'Consignee' },
  { key: 'notifyAddress', label: 'Notify party' },
  { key: 'portOfLoading', label: 'Port of loading' },
  { key: 'portOfDischarge', label: 'Port of discharge' },
  { key: 'oceanVessel', label: 'Vessel' },
  { key: 'voyageNo', label: 'Voyage' },
  { key: 'marksAndNumbers', label: 'At least one container with seal' },
  { key: 'packagesAndDescription', label: 'Cargo description and packages' },
  { key: 'grossWeightKgs', label: 'Gross weight' },
  { key: 'freightTerms', label: 'Freight terms' },
]

/**
 * Returns the labels of the required fields that are still empty.
 *
 * Issue is blocked while this is non-empty; a Draft may be generated with
 * gaps, which is why this returns a list to show rather than a boolean.
 */
export function missingBlFields(snapshot: BlSnapshot): string[] {
  return BL_REQUIRED_FIELDS.filter((f) => {
    // The container column is satisfied by the attach sheet too -- the
    // containers are then listed there instead of in the BL body.
    if (f.key === 'marksAndNumbers' && snapshot.useContainerSheet) return false
    const v = snapshot[f.key]
    return typeof v !== 'string' || v.trim() === ''
  }).map((f) => f.label)
}

/**
 * KLNVO + financial-year code + 6-digit sequence, e.g. KLNVO2627000531.
 * The sequence comes from next_document_number() in Postgres, which
 * allocates atomically; this only formats it.
 */
export function formatBlNumber(fyCode: string, sequence: number): string {
  return `KLNVO${fyCode}${String(sequence).padStart(6, '0')}`
}

/** Financial year runs 1 April to 31 March. Mirrors public.fy_code(). */
export function fyCodeFor(date = new Date()): string {
  const y = date.getFullYear()
  const startYear = date.getMonth() + 1 >= 4 ? y : y - 1
  const two = (n: number) => String(n % 100).padStart(2, '0')
  return `${two(startYear)}${two(startYear + 1)}`
}
