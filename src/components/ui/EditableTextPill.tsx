import { useEffect, useState } from 'react'

/** Free-text (alphanumeric) field that saves on blur — same interaction as EditableDatePill. */
export function EditableTextPill({
  label,
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  /** Small note shown under the field, e.g. a pending-approval notice. */
  hint?: string
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  return (
    <label className="block rounded-btn border border-line bg-surface-2/60 px-3 py-2 focus-within:border-primary">
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <input
        type="text"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onChange(draft)
        }}
        placeholder="—"
        className="mt-0.5 w-full bg-transparent text-[13px] text-heading placeholder:text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      />
      {hint && <p className="mt-1 text-[11px] text-accent-orange">{hint}</p>}
    </label>
  )
}
