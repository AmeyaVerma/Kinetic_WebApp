import { Pencil, Save, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { useBookingEdit } from './BookingEditContext'

/**
 * Edit / Save / Cancel for the whole booking.
 *
 * Deliberately one control for the booking rather than per tab: a correction
 * usually spans tabs -- fix the consignee on Parties, the IGM on Shipment
 * details -- and saving each tab separately would leave a booking half
 * updated if someone stopped partway.
 */
export function BookingEditBar() {
  const { editing, isAdmin, dirtyCount, saving, error, begin, cancel, save } = useBookingEdit()

  if (!isAdmin) return null

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={begin}>
          <Pencil size={14} /> Edit booking
        </Button>
        <span className="text-xs text-muted">
          Fields are read-only until you start editing.
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-primary/40 bg-primary/5 px-3 py-2">
      <span className="text-sm font-medium">Editing</span>
      <span className="text-xs text-muted">
        {dirtyCount === 0
          ? 'No changes yet'
          : dirtyCount + (dirtyCount === 1 ? ' field changed' : ' fields changed')}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>
          <X size={14} /> Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          <Save size={14} />
          {saving ? 'Saving…' : dirtyCount === 0 ? 'Done' : 'Save changes'}
        </Button>
      </div>

      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  )
}
