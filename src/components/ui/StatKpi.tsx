import type { ReactNode } from 'react'

interface Props {
  label: string
  value: number | string
  icon: ReactNode
  tint: string
  color: string
}

/** Compact KPI tile for per-module dashboard rows (no delta — modules show live totals, not trend). */
export function StatKpi({ label, value, icon, tint, color }: Props) {
  return (
    <div className="rounded-card border border-transparent p-4 shadow-card dark:!bg-surface" style={{ backgroundColor: tint }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[#334155] dark:text-body">{label}</p>
        <span style={{ color }}>{icon}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
}
