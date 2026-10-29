import type { Booking, ContainerLineItem } from '../types'
import type { BlSnapshot, ContainerSheetRow } from './blSnapshot'
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
  logoSrc,
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
  /** Signed URL for the logo, when it has been uploaded. */
  logoSrc?: string
  /** Fields edited on the BL itself. They never write back to the booking. */
  overrides?: Partial<BlSnapshot>
}): BlSnapshot {
  const lines = containerLines(booking)

  const base: BlSnapshot = {
    blNumber,
    blType,
    // Spec F15. Scan Copy is a photocopy of an ORIGINAL, so it means nothing
    // on a Draft, Telex or Seaway BL. The mode was stored on the BL and kept
    // applying after the type changed, which turned every later type black
    // and white until someone switched back to Original and turned it off --
    // and the control is only shown on Original, so there was no way to see
    // what was wrong. Derived here instead of trusted, so the type always
    // wins.
    printMode: blType === 'Original' ? printMode : 'Original',
    shipmentReference: booking.bookingRef ?? '',

    consignor: booking.shipper ?? '',
    consignee: booking.consignee ?? '',
    notifyAddress: booking.notifyParty ?? '',
    // Resolved from destination_agent_id by the caller, which has the party
    // master loaded; the id alone is not printable.
    deliveryAgent: '',

    preCarriageBy: booking.preCarriageBy ?? '',
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
    containers: buildContainerRows(booking),
    packagesAndDescription: describeCargo(booking),
    grossWeightKgs: lines.grossTotal,
    measurementM3: booking.measurementM3 ? String(booking.measurementM3) : '',

    freightTerms: booking.freightTerms ?? '',
    freightPayableAt: booking.freightPayableAt ?? '',
    // The blank format stamps place and date only when the BL is issued.
    placeAndDateOfIssue: issuedAt
      ? company.place_of_issue + ', ' + fmtDate(issuedAt)
      : '',
    otherParticulars: booking.otherParticulars ?? '',

    company: {
      legalName: company.legal_name,
      tagline: company.tagline,
      addressLines: splitAddress(company.corporate_address),
      telEmailLine: 'TEL: ' + company.tel + '  EMAIL: ' + company.email.toUpperCase(),
      webLine: 'WEB : ' + company.website.toUpperCase(),
      mtoRegistration: company.mto_registration,
      logoSrc,
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

/**
 * Rows for the container attach sheet, one per container with a number.
 *
 * Containers without a number are skipped rather than printed blank: the
 * sheet's totals row states a container count, and counting empty
 * placeholder rows would overstate the shipment.
 */
function buildContainerRows(booking: Booking): ContainerSheetRow[] {
  const details = booking.containerDetails ?? []
  return details
    .filter((d) => (d.containerNo ?? '').trim() !== '')
    .map((d) => {
      const { size, type } = splitSizeType(d.containerType ?? '', booking)
      const gross = num(d.grossWeight)
      const net = num(d.netWeight)
      const pkgs = num(d.noOfPkgs)
      return {
        containerNo: (d.containerNo ?? '').toUpperCase(),
        size,
        type,
        // No SOC column exists in container_details yet; carrier-owned is
        // the normal case for this trade. See ContainerSheetRow.
        soc: 'N' as const,
        sealNo: (d.sealNo ?? '').toUpperCase(),
        grossWeight: gross ? fmtWeight(gross) : '',
        netWeight: net ? fmtWeight(net) : '',
        packages: pkgs ? String(pkgs) : '',
        grossRaw: gross,
        netRaw: net,
        packagesRaw: pkgs,
      }
    })
}

/**
 * The sample sheet prints size and type in separate columns ("20 FT" / "HD")
 * while the booking stores one string ("20 ft dry", "40 ft OT"). Split on the
 * leading digits; whatever follows is the type, upper-cased.
 *
 * Imperfect by nature -- the type strings are free-ish text -- so anything
 * unrecognised falls back to the booking's own containerType rather than
 * printing an empty column.
 */
function splitSizeType(raw: string, booking: Booking): { size: string; type: string } {
  const source = raw.trim() || booking.containerType || ''
  const m = source.match(/^\s*(\d{2})\s*(?:ft|')?\s*(.*)$/i)
  if (!m) return { size: '', type: source.toUpperCase() }
  const rest = m[2].trim().toUpperCase()
  return { size: m[1] + ' FT', type: rest }
}

/** "100 CARTONS\nGENERAL CARGO" -- packages and kind, then the commodity. */
function describeCargo(booking: Booking): string {
  const count = booking.packages
  const kind = booking.packageType ?? ''
  const head = count ? [String(count), kind].filter(Boolean).join(' ') : kind
  // cargoDescription is the one value Siddharth wants typed by hand, so it
  // wins over the booking's commodity wherever it has been written.
  const described = (booking.cargoDescription || booking.commodity || '').trim()
  return [head, described].filter((x) => x && x !== ',').join('\n')
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
