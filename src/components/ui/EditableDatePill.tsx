import { useEffect, useState } from 'react'

/** "YYYY-MM-DDTHH:mm" (datetime-local's format) from any date-ish string —
    a plain "2025-05-13" date, or a full timestamp. Reads/writes in UTC
    (not the viewer's local timezone) so the same value displays the same
    way for everyone, matching how these fields behaved before time was
    added — this only widens what was date-only into date+time, it
    doesn't introduce per-viewer timezone shifting. */
function toInputValue(v: string): string {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** Date+time field editable by typing or via the native calendar/clock
    picker; saves on blur. */
export function EditableDatePill({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const [draft, setDraft] = useState(toInputValue(value))
  useEffect(() => setDraft(toInputValue(value)), [value])

  return (
    <label className="block rounded-btn border border-line bg-surface-2/60 px-3 py-2 focus-within:border-primary">
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <input
        type="datetime-local"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft && draft !== toInputValue(value)) onChange(draft)
        }}
        className="mt-0.5 w-full bg-transparent text-[13px] text-heading focus:outline-none"
      />
    </label>
  )
}

/** Plain calendar-date field (no time component) editable via typing or the
    native date picker; saves on blur. */
export function EditableDateOnlyPill({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  return (
    <label className="block rounded-btn border border-line bg-surface-2/60 px-3 py-2 focus-within:border-primary">
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <input
        type="date"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onChange(draft)
        }}
        className="mt-0.5 w-full bg-transparent text-[13px] text-heading focus:outline-none"
      />
    </label>
  )
}
