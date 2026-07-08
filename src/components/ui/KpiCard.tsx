import type { ReactNode } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'

export interface KpiTint {
  bg: string // card background tint
  iconBg: string // icon circle
  text: string // accent text (value stays heading colour except delta)
}

/* Soft tinted KPI backgrounds from the design spec */
export const KPI_TINTS = {
  total: { bg: '#ECFDF5', iconBg: '#D1FAE5', text: '#10B981' },
  transit: { bg: '#EFF6FF', iconBg: '#DBEAFE', text: '#3B82F6' },
  delivered: { bg: '#F5F3FF', iconBg: '#EDE9FE', text: '#8B5CF6' },
  revenue: { bg: '#FFF7ED', iconBg: '#FED7AA', text: '#F97316' },
  blDraft: { bg: '#FEFCE8', iconBg: '#FEF9C3', text: '#F59E0B' },
} satisfies Record<string, KpiTint>

interface Props {
  label: string
  value: string
  deltaPct: number
  tint: KpiTint
  icon: ReactNode
}

export function KpiCard({ label, value, deltaPct, tint, icon }: Props) {
  const up = deltaPct >= 0
  return (
    <div
      className="relative rounded-card border p-5 shadow-card dark:!bg-surface"
      style={{ backgroundColor: tint.bg, borderColor: 'transparent' }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-medium text-[#334155] dark:text-body">
            {label}
          </p>
          <p
            className="mt-2 font-display text-[30px] font-bold leading-none"
            style={{ color: tint.text }}
          >
            {value}
          </p>
          <p
            className="mt-3 flex items-center gap-1 text-xs font-semibold"
            style={{ color: up ? '#10B981' : '#EF4444' }}
          >
            {up ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
            {Math.abs(deltaPct)}%
          </p>
        </div>
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: tint.iconBg, color: tint.text }}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}
