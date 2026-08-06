import { useEffect, useState } from 'react'

const cellInputCls =
  'w-full min-w-[92px] rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-heading focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

/** Weight input: free typing while focused, reformatted to 2 decimals with
    a "kg" suffix on blur — so entering "19076" settles into "19076.00 kg"
    without fighting the user mid-keystroke. Shared by NVOCC's container
    table + both modules' Product info (Cargo weight). */
export function WeightCell({
  value,
  onChange,
  disabled,
  bare,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  /** Use transparent/borderless styling for nesting inside an outer pill
      (Product info) instead of the boxed table-cell look (Container info). */
  bare?: boolean
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  const commit = () => {
    if (draft.trim() === '') {
      if (value !== '') onChange('')
      return
    }
    const n = parseFloat(draft)
    const formatted = Number.isFinite(n) ? n.toFixed(2) : draft
    setDraft(formatted)
    if (formatted !== value) onChange(formatted)
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        className={
          bare
            ? 'w-full bg-transparent pr-8 text-[13px] text-heading focus:outline-none disabled:cursor-not-allowed disabled:opacity-60'
            : `${cellInputCls} pr-8 disabled:cursor-not-allowed disabled:opacity-60`
        }
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">
        kg
      </span>
    </div>
  )
}
