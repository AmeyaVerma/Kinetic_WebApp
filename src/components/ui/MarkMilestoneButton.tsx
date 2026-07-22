import { useState } from 'react'
import { CalendarDays, Check, X } from 'lucide-react'
import { Button } from './Button'

/** Replaces a plain "Mark" action — reveals a calendar date-picker so a
    milestone/activity can be completed with a specific (or backdated) date
    rather than always defaulting to right now. */
export function MarkMilestoneButton({ onConfirm }: { onConfirm: (date: string) => void }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <CalendarDays size={13} /> Mark
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        autoFocus
        className="rounded-btn border border-primary bg-surface px-2 py-1 text-xs text-heading focus:outline-none"
      />
      <button
        type="button"
        onClick={() => { onConfirm(date); setOpen(false) }}
        title="Confirm date"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-btn bg-primary text-white hover:bg-primary-hover"
      >
        <Check size={13} />
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        title="Cancel"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-btn text-muted hover:bg-surface-2"
      >
        <X size={13} />
      </button>
    </div>
  )
}
