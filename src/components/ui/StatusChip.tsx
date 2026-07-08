import type { ChipStatus } from '../../lib/types'

/* Exact chip colours from the design spec — bg / text pairs. */
const CHIP_STYLES: Record<ChipStatus, { bg: string; text: string }> = {
  Booked: { bg: '#DCFCE7', text: '#15803D' },
  'In Transit': { bg: '#DBEAFE', text: '#1D4ED8' },
  Documentation: { bg: '#FEF3C7', text: '#B45309' },
  Delivered: { bg: '#ECFDF5', text: '#047857' },
  Arrived: { bg: '#DCFCE7', text: '#15803D' },
  Cancelled: { bg: '#FEE2E2', text: '#DC2626' },
  Draft: { bg: '#F3F4F6', text: '#6B7280' },
  'BL Draft': { bg: '#FEE2E2', text: '#DC2626' },
  Pending: { bg: '#FFF7ED', text: '#EA580C' },
  Overdue: { bg: '#FECACA', text: '#B91C1C' },
}

export function StatusChip({ status }: { status: ChipStatus }) {
  const s = CHIP_STYLES[status] ?? CHIP_STYLES.Draft
  return (
    <span
      className="inline-flex items-center rounded-badge px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {status}
    </span>
  )
}
