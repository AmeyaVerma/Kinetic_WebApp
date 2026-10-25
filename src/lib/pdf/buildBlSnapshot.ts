import type { Booking, ContainerLineItem } from '../types'
import type { BlSnapshot } from './blSnapshot'
import type { BlType } from './strings/bl'
import { fmtDate, fmtWeight } from './format'

/**
 * Company values the snapshot freezes alongside the booking data. Sourced
 * from company_settings so a later address change does not alter an issued
 * BL.
 */
export interface CompanySettingsLite {
  legal_name: string
  tagline: string
  corporate_address: string
  tel: string
  email: string
  website: string
  mto_registration: string
  place_of_issue: string
}

/**
 * Builds the printed values for a BL from a booking.
 *
 * Called on every render while the BL is a Draft (so the draft tracks the
 * booking live) and exactly once on Issue, where the result is written to
 * document_versions and never rebuilt.
 */
export function buildBlSnapshot({
  booking,
  company,
  blNumber,
  blType,
  printMode,
  useContainerSheet,
  issuedAt,
  overrides,
}: {
  booking: Booking
  company: CompanySettingsLite
  blNumber: string
  blType: BlType
  printMode: 'Original' | 'Scan'
  useContainerSheet: boolean
  /** Stamped on Issue; a Draft leaves the issue box empty. */
  issuedAt?: string | null
  /** Fields edited on the BL itself. They never write back to the booking. */
  overrides?: Partial<BlSnapshot>
}): BlSnapshot {
  const lines = containerLines(booking)

  const base: BlSnapshot = {
    blNumber,
    blType,
    printMode,
    shipmentReference: booking.bookingRef ?? '',

    consignor: booking.shipper ?? '',
    consignee: booking.consignee ?? '',
    notifyAddress: booking.notifyParty ?? '',
    // Resolved from destination_agent_id by the caller, which has the party
    // master loaded; the id alone is not printable.
    deliveryAgent: '',

    preCarriageBy: '',
    portOfReceipt: booking.portOfReceipt ?? '',
    oceanVessel: booking.vesselName ?? '',
    voyageNo: booking.voyageNo ?? '',
    portOfLoading: booking.pol ?? '',
    portOfDischarge: booking.pod ?? '',
    finalPortOfDelivery: booking.finalPlaceOfDischarge ?? '',
    modeOfTransport: 'Sea',
    // Only a transhipment booking names a transshipment place.
    routeOrTransshipment:
      booking.transhipment === 'Yes' ? (booking.transshipmentAgent ?? '') : '',

    marksAndNumbers: lines.marks,
    useContainerSheet,
    packagesAndDescription: describeCargo(booking),
    grossWeightKgs: lines.grossTotal,
    measurementM3: '',

    freightTerms: booking.freightTerms ?? '',
    freightPayableAt: '',
    // The blank format stamps place and date only when the BL is issued.
    placeAndDateOfIssue: issuedAt
      ? company.place_of_issue + ', ' + fmtDate(issuedAt)
      : '',
    otherParticulars: '',

    company: {
      legalName: company.legal_name,
      tagline: company.tagline,
      addressLines: splitAddress(company.corporate_address),
      telEmailLine: 'TEL: ' + company.tel + '  EMAIL: ' + company.email.toUpperCase(),
      webLine: 'WEB : ' + company.website.toUpperCase(),
      mtoRegistration: company.mto_registration,
    },
  }

  return { ...base, ...overrides }
}

/**
 * The container column: one line per container, "number / seal / size-type",
 * plus the gross-weight total for the weight column.
 *
 * Falls back to the flat containerNos list when containerDetails has not been
 * filled in -- older bookings only carry the flat array.
 */
function containerLines(booking: Booking): { marks: string; grossTotal: string } {
  const details: ContainerLineItem[] = booking.containerDetails ?? []
  const filled = details.filter((d) => (d.containerNo ?? '').trim() !== '')

  if (filled.length > 0) {
    const marks = filled
      .map((d) =>
        [d.containerNo, d.sealNo, d.containerType].filter(Boolean).join(' / '),
      )
      .join('\n')
    const total = filled.reduce((a, d) => a + num(d.grossWeight), 0)
    return {
      marks,
      grossTotal: total > 0 ? fmtWeight(total) : fmtWeight(booking.grossWeightKg),
    }
  }

  const nos = (booking.containerNos ?? []).filter(Boolean)
  const marks = nos.length
    ? nos.map((n) => [n, booking.sealNo, booking.containerType].filter(Boolean).join(' / ')).join('\n')
    : ''
  return { marks, grossTotal: fmtWeight(booking.grossWeightKg) }
}

/** "100 CARTONS\nGENERAL CARGO" -- packages and kind, then the commodity. */
function describeCargo(booking: Booking): string {
  const count = booking.packages
  const kind = booking.packageType ?? ''
  const head = count ? [String(count), kind].filter(Boolean).join(' ') : kind
  const commodity = (booking.commodity ?? '').trim()
  return [head, commodity].filter((x) => x && x !== ',').join('\n')
}

function splitAddress(address: string): string[] {
  // The blank format prints the corporate address over four short lines
  // rather than wrapping one long one.
  return address
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .reduce<string[]>((lines, part) => {
      const last = lines[lines.length - 1]
      if (last && (last + ', ' + part).length <= 52) {
        lines[lines.length - 1] = last + ', ' + part
      } else {
        lines.push(part)
      }
      return lines
    }, [])
    .map((l) => l.toUpperCase())
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}
