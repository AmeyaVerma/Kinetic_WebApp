import { useState } from 'react'
import { Link2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'

interface LinkableBl {
  id: string
  role: 'House' | 'Master'
  bl_number: string | null
  status: string
  master_bl_id: string | null
  mbl_number: string | null
  carrier_name: string | null
  carrier_booking_no: string | null
}

/**
 * Which House BLs a Master BL covers, and the carrier side of it.
 *
 * On a Master BL: tick the House BLs it covers (each House BL points at one
 * Master through master_bl_id) and enter the carrier, the carrier's booking
 * number and the MBL number. On a House BL: show which Master, if any, covers
 * it. Nothing here is invented -- a House BL with no Master simply reads
 * "not covered".
 *
 * An issued or released Master is not edited from here; the BL is a legal
 * document once issued, and changing it is an amendment.
 */
export function BlMasterLink({
  bl,
  all,
  disabled,
  onChanged,
}: {
  bl: LinkableBl
  all: LinkableBl[]
  disabled: boolean
  onChanged: () => Promise<void> | void
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [carrier, setCarrier] = useState(bl.carrier_name ?? '')
  const [mbl, setMbl] = useState(bl.mbl_number ?? '')
  const [carrierBooking, setCarrierBooking] = useState(bl.carrier_booking_no ?? '')

  const label = (b: LinkableBl) => b.bl_number ?? 'Unnumbered draft'

  if (bl.role === 'House') {
    const master = all.find((b) => b.id === bl.master_bl_id)
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Link2 size={12} />
        {master ? `Covered by Master BL ${label(master)}` : 'Not covered by a Master BL'}
      </p>
    )
  }

  const houses = all.filter((b) => b.role === 'House' && b.status !== 'Cancelled')

  const toggle = async (house: LinkableBl) => {
    setError(null)
    setBusy(true)
    const covered = house.master_bl_id === bl.id
    const { error: err, count } = await supabase
      .from('bls')
      .update({ master_bl_id: covered ? null : bl.id }, { count: 'exact' })
      .eq('id', house.id)
    setBusy(false)
    if (err) setError(err.message)
    else if (!count) setError('That change was not saved. You may not have permission.')
    else await onChanged()
  }

  const saveCarrier = async () => {
    setError(null)
    setBusy(true)
    const { error: err, count } = await supabase
      .from('bls')
      .update(
        {
          carrier_name: carrier.trim() || null,
          mbl_number: mbl.trim() || null,
          carrier_booking_no: carrierBooking.trim() || null,
        },
        { count: 'exact' },
      )
      .eq('id', bl.id)
    setBusy(false)
    if (err) setError(err.message)
    else if (!count) setError('That change was not saved. You may not have permission.')
    else await onChanged()
  }

  return (
    <div className="space-y-3 rounded-btn border border-line p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Link2 size={14} className="text-primary" /> House BLs covered by this Master
      </p>

      {houses.length === 0 && <p className="text-xs text-muted">There is no House BL to cover.</p>}
      <ul className="space-y-1">
        {houses.map((h) => {
          const mine = h.master_bl_id === bl.id
          const other = h.master_bl_id && !mine
          return (
            <li key={h.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={mine}
                  disabled={disabled || busy || !!other}
                  onChange={() => void toggle(h)}
                />
                <span className="font-mono text-xs">{label(h)}</span>
                <span className="text-[11px] text-muted">{h.status}</span>
                {other && <span className="text-[11px] text-muted">already on another Master</span>}
              </label>
            </li>
          )
        })}
      </ul>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted">
          Carrier
          <TextInput className="mt-1" value={carrier} disabled={disabled} onChange={(e) => setCarrier(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Carrier booking no.
          <TextInput
            className="mt-1"
            value={carrierBooking}
            disabled={disabled}
            onChange={(e) => setCarrierBooking(e.target.value)}
          />
        </label>
        <label className="text-xs text-muted">
          MBL number
          <TextInput className="mt-1" value={mbl} disabled={disabled} onChange={(e) => setMbl(e.target.value)} />
        </label>
      </div>
      {!disabled && (
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void saveCarrier()}>
          Save carrier details
        </Button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
