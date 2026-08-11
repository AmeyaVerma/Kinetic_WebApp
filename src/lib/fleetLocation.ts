import type { Booking, ContainerActivity, ContainerReportLocation } from './types'
import { CONTAINER_ACTIVITY_DEFS } from '../mocks/seed'

const DISCHARGE_INDEX = CONTAINER_ACTIVITY_DEFS.findIndex((d) => d.key === 'discharge')

/** Best-effort text match against the report's 7 location codes — same
    matching used to seed the Containers master's report_location. */
function matchReportLocation(text: string | null | undefined): ContainerReportLocation | null {
  if (!text) return null
  const t = text.toUpperCase()
  if (t.includes('SOHAR')) return 'SOHAR'
  if (t.includes('MUNDRA')) return 'MUN'
  if (t.includes('JEBEL ALI')) return 'JEA'
  if (t.includes('BANDAR ABBAS')) return 'BND'
  if (t.includes('NHAVA SHEVA') || t.includes('NSA')) return 'NSA'
  if (t.includes('BND STAR')) return 'BND_STAR_MARINE'
  if (t.includes('AL MARSA')) return 'AL_MARSA'
  return null
}

/** A Fleet container's current location, derived from the booking it's out
    on (custodianBookingRef) — its furthest-completed container activity
    decides whether it's still origin-side (Port of Receipt / Port of
    Loading) or has moved destination-side (Final Place of Discharge /
    Port of Destination) past "discharge", then that port's free text is
    matched against the report's 7 codes. Null when there's no booking, no
    activity data, or the port text doesn't match any of the 7. */
export function deriveBookingLocation(
  booking: Booking | undefined,
  activities: ContainerActivity[] | undefined,
): ContainerReportLocation | null {
  if (!booking) return null
  const completedIdx = (activities ?? [])
    .filter((a) => a.completedAt)
    .map((a) => CONTAINER_ACTIVITY_DEFS.findIndex((d) => d.key === a.key))
    .reduce((max, i) => Math.max(max, i), -1)

  const pastDischarge = DISCHARGE_INDEX >= 0 && completedIdx >= DISCHARGE_INDEX
  const primary = pastDischarge ? booking.finalPlaceOfDischarge : booking.portOfReceipt
  const fallback = pastDischarge ? booking.pod : booking.pol
  return matchReportLocation(primary) ?? matchReportLocation(fallback)
}
