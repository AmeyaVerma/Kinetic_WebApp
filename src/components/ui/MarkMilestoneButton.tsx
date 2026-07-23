import { useState } from 'react'
import { CalendarDays, Check, Pencil, X } from 'lucide-react'
import { Button } from './Button'

/** Replaces a plain "Mark" action — reveals a calendar date-picker so a
    milestone/activity can be completed with a specific (or backdated) date
    rather than always defaulting to right now.

    Pass `initialDate` to switch this into "edit an already-completed date"
    mode (a small pencil icon instead of the "Mark" button) — callers should
    only pass it for Admins, since once marked the date is otherwise final. */
export function MarkMilestoneButton({
  onConfirm,
  initialDate,
}: {
  onConfirm: (date: string) => void
  initialDate?: string
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(() => initialDate ?? new Date().toISOString().slice(0, 10))

  if (!open) {
    return initialDate ? (
      <button
        type="button"
        onClick={() => { setDate(initialDate); setOpen(true) }}
        title="Correct this date (Admin only)"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-btn text-muted hover:bg-surface-2 hover:text-heading"
      >
        <Pencil size={12} />
      </button>
    ) : (
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
