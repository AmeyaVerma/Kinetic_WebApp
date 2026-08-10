import type { DocStatus } from '../../lib/docStatus'

const CHIP_STYLES: Record<DocStatus, { bg: string; text: string }> = {
  Draft: { bg: '#F3F4F6', text: '#6B7280' },
  Sent: { bg: '#FFF7ED', text: '#EA580C' },
  Approved: { bg: '#DBEAFE', text: '#1D4ED8' },
  Released: { bg: '#ECFDF5', text: '#047857' },
}

export function DocStatusChip({ status }: { status: DocStatus }) {
  const s = CHIP_STYLES[status]
  return (
    <span
      className="inline-flex items-center rounded-badge px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {status}
    </span>
  )
}
