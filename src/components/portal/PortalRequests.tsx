import { useCallback, useEffect, useState } from 'react'
import { Send, FileText, PackagePlus, Download } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge, type BadgeTone } from '../ui/Badge'
import { Field, Select, TextInput } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'
import type { PortalBooking, PortalIdentity } from '../../lib/portal'

/**
 * What a portal user can ask for.
 *
 * Portal users write REQUESTS, never bookings or BLs: a booking request
 * becomes a real booking only when an Admin approves it, and a document
 * request becomes a download only after staff approve it, an invoice for it is
 * paid, and it is released. Every refusal on this screen is the database's
 * own message, not a guess by the page.
 *
 * Document names come from the Document fees master, because that is the list
 * the price lookup understands; the portal cannot read the prices.
 */

const DOC_TYPES: { key: string; label: string }[] = [
  { key: 'obl_original', label: 'OBL original copy' },
  { key: 'obl_scan', label: 'OBL scan copy' },
  { key: 'surrender', label: 'Surrender BL' },
  { key: 'onboard', label: 'Onboard Confirmation' },
  { key: 'cro', label: 'Container Release Order' },
  { key: 'do', label: 'Delivery Order' },
  { key: 'can', label: 'Cargo Arrival Notice' },
  { key: 'offloading', label: 'Off Loading Letter' },
  { key: 'other', label: 'Other document' },
]
const DOC_LABEL = Object.fromEntries(DOC_TYPES.map((d) => [d.key, d.label]))

/** The v2 tracker, in order. Rejected sits outside it. */
const STEPS = ['Submitted', 'Approved', 'Invoice sent', 'Paid', 'Ready to download'] as const

const REQ_TONE: Record<string, BadgeTone> = {
  Submitted: 'attention',
  'Under review': 'info',
  Approved: 'success',
  'Invoice sent': 'info',
  Paid: 'success',
  'Ready to download': 'done',
  Rejected: 'danger',
}

interface BookingReq {
  id: string
  status: string
  payload: { pol?: string; pod?: string; commodity?: string; direction?: string }
  reject_reason: string | null
  created_at: string
}
interface DocReq {
  id: string
  booking_id: string
  doc_type: string
  status: string
  reject_reason: string | null
  created_at: string
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB')

export function PortalRequests({
  userId,
  identity,
  bookings,
}: {
  userId: string
  identity: PortalIdentity
  bookings: PortalBooking[]
}) {
  const [bookingReqs, setBookingReqs] = useState<BookingReq[]>([])
  const [docReqs, setDocReqs] = useState<DocReq[]>([])
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [b, d] = await Promise.all([
      supabase
        .from('booking_requests')
        .select('id, status, payload, reject_reason, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('document_requests')
        .select('id, booking_id, doc_type, status, reject_reason, created_at')
        .order('created_at', { ascending: false }),
    ])
    setBookingReqs((b.data as BookingReq[]) ?? [])
    setDocReqs((d.data as DocReq[]) ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Ask the server for a link. It checks the whole release chain again, so a
      stale screen cannot fetch a file that has since been blocked. The link
      lasts about a minute. */
  const download = async (requestId: string) => {
    setError(null)
    const { data, error: err } = await supabase.functions.invoke('portal-download', {
      body: { request_id: requestId },
    })
    if (err) {
      // A refusal comes back as an HTTP error whose body holds the reason.
      let message = err.message
      try {
        const body = await (err as unknown as { context?: Response }).context?.json()
        if (body?.error) message = body.error
      } catch {
        /* keep the generic message */
      }
      setError(message)
      return
    }
    if (data?.url) window.location.href = data.url as string
  }

  const refOf = (id: string) => bookings.find((b) => b.id === id)?.bookingRef ?? '—'

  return (
    <div className="mt-5 space-y-5">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {note && <p className="text-sm text-primary">{note}</p>}

      {identity.kind === 'customer' && (
        <BookingRequestForm
          userId={userId}
          partyId={identity.partyId}
          onError={setError}
          onDone={async () => {
            setError(null)
            setNote('Request sent. It becomes a booking once Kinetic approves it.')
            await load()
          }}
        />
      )}

      <DocumentRequestForm
        userId={userId}
        bookings={bookings}
        onError={setError}
        onDone={async () => {
          setError(null)
          setNote('Request sent.')
          await load()
        }}
      />

      {identity.kind === 'customer' && (
        <Card className="space-y-3 p-5">
          <h3 className="text-[15px] font-semibold">Your booking requests</h3>
          {bookingReqs.length === 0 && <p className="text-sm text-muted">None yet.</p>}
          <ul className="space-y-2">
            {bookingReqs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={REQ_TONE[r.status] ?? 'neutral'} label={r.status} />
                <span>
                  {r.payload.direction ?? ''} {r.payload.pol ?? '—'} → {r.payload.pod ?? '—'}
                  {r.payload.commodity ? `, ${r.payload.commodity}` : ''}
                </span>
                <span className="font-mono text-[11px] text-muted">{day(r.created_at)}</span>
                {r.reject_reason && <span className="text-xs text-red-600">Rejected: {r.reject_reason}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="space-y-3 p-5">
        <h3 className="text-[15px] font-semibold">Your document requests</h3>
        {docReqs.length === 0 && <p className="text-sm text-muted">None yet.</p>}
        <ul className="space-y-4">
          {docReqs.map((r) => {
            const at = STEPS.indexOf(r.status as (typeof STEPS)[number])
            return (
              <li key={r.id} className="space-y-1.5">
                <p className="text-sm">
                  <span className="font-medium">{DOC_LABEL[r.doc_type] ?? r.doc_type}</span>
                  <span className="ml-2 font-mono text-xs text-muted">{refOf(r.booking_id)}</span>
                  <span className="ml-2 font-mono text-[11px] text-muted">{day(r.created_at)}</span>
                </p>
                {r.status === 'Rejected' ? (
                  <p className="text-xs text-red-600">
                    Rejected{r.reject_reason ? `: ${r.reject_reason}` : '.'}
                  </p>
                ) : (
                  <ol className="flex flex-wrap gap-x-4 gap-y-1">
                    {STEPS.map((s, i) => (
                      <li key={s} className="flex items-center gap-1.5 text-[11px]">
                        <span className={`h-2 w-2 rounded-full ${i <= at ? 'bg-primary' : 'bg-line'}`} />
                        <span className={i <= at ? 'text-body' : 'text-muted'}>{s}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {r.status === 'Ready to download' && (
                  <Button size="sm" variant="secondary" onClick={() => void download(r.id)}>
                    <Download size={13} /> Download
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}

function BookingRequestForm({
  userId,
  partyId,
  onError,
  onDone,
}: {
  userId: string
  partyId: string
  onError: (m: string | null) => void
  onDone: () => Promise<void>
}) {
  const [f, setF] = useState({
    direction: 'Export',
    pol: '',
    pod: '',
    commodity: '',
    containerType: '',
    containerQty: '',
    packages: '',
    packageType: '',
    grossWeightKg: '',
    shipper: '',
    consignee: '',
    notifyParty: '',
    customerReference: '',
  })
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((x) => ({ ...x, [k]: e.target.value }))

  const submit = async () => {
    onError(null)
    if (!f.pol.trim() || !f.pod.trim() || !f.commodity.trim()) {
      onError('Port of loading, port of discharge and the cargo are needed.')
      return
    }
    setSaving(true)
    // Empty fields are left out so the booking is not created with blank text.
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim() !== ''))
    const { error } = await supabase
      .from('booking_requests')
      .insert({ requested_by_user: userId, party_id: partyId, status: 'Submitted', payload })
    setSaving(false)
    if (error) {
      onError(error.message)
      return
    }
    setOpen(false)
    await onDone()
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold">
          <PackagePlus size={16} className="text-primary" /> Request a booking
        </h3>
        <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? 'Close' : 'New request'}
        </Button>
      </div>
      {open && (
        <>
          <p className="text-xs text-muted">
            This is a request, not a booking. Kinetic reviews it and, once approved, creates the booking and
            its number. Vessel, depots and rates are set by Kinetic.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Direction">
              <Select value={f.direction} onChange={set('direction')}>
                <option>Export</option>
                <option>Import</option>
              </Select>
            </Field>
            <Field label="Port of loading" required>
              <TextInput value={f.pol} onChange={set('pol')} />
            </Field>
            <Field label="Port of discharge" required>
              <TextInput value={f.pod} onChange={set('pod')} />
            </Field>
            <Field label="Cargo" required>
              <TextInput value={f.commodity} onChange={set('commodity')} />
            </Field>
            <Field label="Container type">
              <TextInput value={f.containerType} onChange={set('containerType')} />
            </Field>
            <Field label="Number of containers">
              <TextInput inputMode="numeric" value={f.containerQty} onChange={set('containerQty')} />
            </Field>
            <Field label="Packages">
              <TextInput inputMode="numeric" value={f.packages} onChange={set('packages')} />
            </Field>
            <Field label="Package type">
              <TextInput value={f.packageType} onChange={set('packageType')} />
            </Field>
            <Field label="Gross weight (kg)">
              <TextInput inputMode="decimal" value={f.grossWeightKg} onChange={set('grossWeightKg')} />
            </Field>
            <Field label="Shipper">
              <TextInput value={f.shipper} onChange={set('shipper')} />
            </Field>
            <Field label="Consignee">
              <TextInput value={f.consignee} onChange={set('consignee')} />
            </Field>
            <Field label="Notify party">
              <TextInput value={f.notifyParty} onChange={set('notifyParty')} />
            </Field>
            <Field label="Your reference">
              <TextInput value={f.customerReference} onChange={set('customerReference')} />
            </Field>
          </div>
          <Button size="sm" disabled={saving} onClick={() => void submit()}>
            <Send size={13} /> {saving ? 'Sending…' : 'Send request'}
          </Button>
        </>
      )}
    </Card>
  )
}

function DocumentRequestForm({
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
  const [bookingId, setBookingId] = useState('')
  const [docType, setDocType] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    onError(null)
    setSaving(true)
    const { error } = await supabase.from('document_requests').insert({
      requested_by_user: userId,
      booking_id: bookingId,
      doc_type: docType,
      status: 'Submitted',
    })
    setSaving(false)
    if (error) {
      // The database explains itself, for example when the freight invoice
      // has not been paid yet.
      onError(error.message)
      return
    }
    setDocType('')
    await onDone()
  }

  return (
    <Card className="space-y-3 p-5">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold">
        <FileText size={16} className="text-primary" /> Request a document
      </h3>
      <p className="text-xs text-muted">
        A document can be requested once the freight and locals invoice for the shipment is paid. Kinetic
        approves the request, sends an invoice for the document, and releases it when that is paid.
      </p>
      <div className="flex flex-wrap items-end gap-3">
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
        <Field label="Document">
          <Select value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="">Choose a document…</option>
            {DOC_TYPES.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <Button size="sm" disabled={!bookingId || !docType || saving} onClick={() => void submit()}>
          <Send size={13} /> {saving ? 'Sending…' : 'Request'}
        </Button>
      </div>
    </Card>
  )
}
