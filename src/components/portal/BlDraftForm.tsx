import { useState } from 'react'
import { FileText, Send } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Field, Select, TextInput } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'
import type { PortalBooking } from '../../lib/portal'

const EMPTY = {
  shipper: '',
  consignee: '',
  notifyParty: '',
  cargoDescription: '',
  packages: '',
  packageType: '',
  grossWeightKg: '',
  containers: '',
}

const AREA = 'w-full rounded-input border border-line bg-surface px-3 py-2 text-sm'

/**
 * The inputs for a House BL, from a customer or agent.
 *
 * This is not a BL: it has no MTD number and no signature, and nothing on the
 * booking changes until Kinetic approves it. Only House BL inputs are offered
 * here; the Master BL and a Surrender BL are Kinetic's.
 */
export function BlDraftForm({
  userId,
  bookings,
  onError,
  onDone,
}: {
  userId: string
  bookings: PortalBooking[]
  onError: (m: string | null) => void
  onDone: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [bookingId, setBookingId] = useState('')
  const [f, setF] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setF((x) => ({ ...x, [k]: e.target.value }))

  const submit = async () => {
    onError(null)
    if (!bookingId) {
      onError('Choose a shipment.')
      return
    }
    // Empty fields are left out, so they change nothing when approved.
    const inputs = Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim() !== ''))
    if (Object.keys(inputs).length === 0) {
      onError('Fill in at least one field.')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('bl_draft_inputs')
      .insert({ booking_id: bookingId, requested_by_user: userId, status: 'Submitted', inputs })
    setSaving(false)
    if (error) {
      onError(error.message)
      return
    }
    setOpen(false)
    setF(EMPTY)
    await onDone()
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold">
          <FileText size={16} className="text-primary" /> Draft your Bill of Lading
        </h3>
        <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? 'Close' : 'Start'}
        </Button>
      </div>
      {open && (
        <>
          <p className="text-xs text-muted">
            These are inputs for a House BL, not a BL. Nothing is numbered or signed, and the shipment changes
            only when Kinetic approves them. Leave out anything you don&rsquo;t want to change.
          </p>
          <Field label="Shipment">
            <Select value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
              <option value="">Choose a shipment…</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bookingRef} · {b.pol || '—'} → {b.pod || '—'}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Shipper">
              <textarea className={AREA} rows={3} value={f.shipper} onChange={set('shipper')} />
            </Field>
            <Field label="Consignee">
              <textarea className={AREA} rows={3} value={f.consignee} onChange={set('consignee')} />
            </Field>
            <Field label="Notify party">
              <textarea className={AREA} rows={3} value={f.notifyParty} onChange={set('notifyParty')} />
            </Field>
          </div>
          <Field label="Cargo description">
            <textarea className={AREA} rows={2} value={f.cargoDescription} onChange={set('cargoDescription')} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Packages">
              <TextInput inputMode="numeric" value={f.packages} onChange={set('packages')} />
            </Field>
            <Field label="Package type">
              <TextInput value={f.packageType} onChange={set('packageType')} />
            </Field>
            <Field label="Gross weight (kg)">
              <TextInput inputMode="decimal" value={f.grossWeightKg} onChange={set('grossWeightKg')} />
            </Field>
          </div>
          <Field label="Container numbers (separate with commas or spaces)">
            <TextInput value={f.containers} onChange={set('containers')} />
          </Field>
          <Button size="sm" disabled={saving} onClick={() => void submit()}>
            <Send size={13} /> {saving ? 'Sending…' : 'Send for approval'}
          </Button>
        </>
      )}
    </Card>
  )
}
