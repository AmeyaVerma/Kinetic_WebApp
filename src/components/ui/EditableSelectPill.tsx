/** Same pill styling as EditableTextPill, but a constrained <select> instead
    of free text — saves immediately on change (no blur step needed). */
export function EditableSelectPill({
  label,
  value,
  options,
  onChange,
  disabled,
  hint,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (v: string) => void
  disabled?: boolean
  /** Small note shown under the field, e.g. a pending-approval notice. */
  hint?: string
}) {
  return (
    <label className="block rounded-btn border border-line bg-surface-2/60 px-3 py-2 focus-within:border-primary">
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full bg-transparent text-[13px] text-heading focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        {!options.includes(value) && value && <option value={value}>{value}</option>}
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      {hint && <p className="mt-1 text-[11px] text-accent-orange">{hint}</p>}
    </label>
  )
}
