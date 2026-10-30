import { useState } from 'react'

export interface MonthBar {
  key: string
  label: string
  value: number
}

/**
 * Counts over time, one series.
 *
 * Deliberately one measure and one hue: a second y-scale on the same frame
 * would make two different things look comparable, and the spec's whole
 * complaint about this app's numbers is that figures were being compared
 * that had no business being compared.
 *
 * Bars carry a value label only where there is room for one, so the chart
 * does not turn into a table with decoration.
 */
export function MonthBars({ bars, unit }: { bars: MonthBar[]; unit: string }) {
  const [hover, setHover] = useState<string | null>(null)
  const peak = Math.max(1, ...bars.map((b) => b.value))

  if (bars.length === 0) {
    return <p className="px-5 py-8 text-center text-sm text-muted">Nothing in this period.</p>
  }

  return (
    <div className="px-5 pb-4 pt-5">
      <div className="flex h-44 items-end gap-[2px]">
        {bars.map((b) => {
          const pct = (b.value / peak) * 100
          const active = hover === b.key
          return (
            <div
              key={b.key}
              className="group relative flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setHover(b.key)}
              onMouseLeave={() => setHover(null)}
            >
              {active && (
                <div className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-btn border border-line bg-surface px-2 py-1 text-[11px] shadow-card">
                  <span className="font-semibold text-heading">{b.value}</span>{' '}
                  <span className="text-muted">
                    {unit}
                    {b.value === 1 ? '' : 's'} · {b.label}
                  </span>
                </div>
              )}
              {b.value > 0 && pct > 22 && (
                <span className="mb-1 text-center text-[10px] font-semibold text-muted">
                  {b.value}
                </span>
              )}
              <div
                className="rounded-t-[4px] transition-colors"
                style={{
                  height: `${Math.max(b.value > 0 ? 3 : 0, pct)}%`,
                  backgroundColor: active ? 'var(--primary-hover)' : 'var(--primary)',
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-[2px]">
        {bars.map((b) => (
          <div key={b.key} className="flex-1 text-center text-[9px] uppercase text-muted">
            {b.label.slice(0, 3)}
          </div>
        ))}
      </div>
    </div>
  )
}
