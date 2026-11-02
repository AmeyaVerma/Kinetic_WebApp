import { useCallback, useEffect, useState } from 'react'
import { FileText, Upload, Info } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { TextInput, Select } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'
import type { Booking } from '../../lib/types'

interface InvoiceRecord {
  id: string
  invoice_no: string
  zoho_invoice_id: string | null
  kind: 'freight_and_locals' | 'document' | null
  subtotal: number | string | null
  total_inr: number | string | null
  currency: string | null
  party_name: string | null
  pdf_path: string | null
  published_to_portal: boolean
  paid_at: string | null
  paid_method: string | null
  paid_reference: string | null
}

const KIND_LABEL: Record<string, string> = {
  freight_and_locals: 'Freight and locals',
  document: 'Document',
}

/**
 * The invoices on a booking, as v2 wants them: a RECORD of an invoice raised
 * in Zoho, not an invoicing engine.
 *
 * "Zoho is the books ... The ERP never changes Zoho ... Staff raise the GST
 * invoice in Zoho by hand." So this holds the Zoho number, type, amount,
 * currency, bill-to, the Zoho PDF and a paid state, and does no GST
 * calculation and makes no accounting entry. There is no button here that
 * reaches Zoho, and no token that could.
 *
 * Marking an invoice Paid is a REQUEST that goes to the Approvals queue,
 * because document release depends on it: an Admin or Approver agrees, and
 * approving it is what applies the payment. The page says "waiting for
 * approval" rather than pretending the invoice is already paid.
 *
 * The PDF goes in the private booking-documents bucket. A portal user cannot
 * read it from there yet -- the short-lived download link is not built -- so
 * publishing an invoice makes its record visible to the customer but not its
 * file, and the screen says so.
 */
export function InvoiceRecords({ booking }: { booking: Booking }) {
  const [rows, setRows] = useState<InvoiceRecord[]>([])
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [payFor, setPayFor] = useState<string | null>(null)

  const dbId = booking.dbId

  const load = useCallback(async () => {
    if (!dbId) return
    setLoading(true)
    const [inv, pend] = await Promise.all([
      supabase
        .from('invoices')
        .select(
          'id, invoice_no, zoho_invoice_id, kind, subtotal, total_inr, currency, party_name, pdf_path, published_to_portal, paid_at, paid_method, paid_reference',
        )
        .eq('booking_id', dbId)
        .order('created_at', { ascending: false }),
      supabase
        .from('approvals')
        .select('entity_id')
        .eq('entity_type', 'mark_as_paid')
        .eq('status', 'Pending'),
    ])
    setRows((inv.data as InvoiceRecord[]) ?? [])
    setPending(new Set(((pend.data as { entity_id: string }[]) ?? []).map((p) => p.entity_id)))
    setLoading(false)
  }, [dbId])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok?: string) => {
    setError(null)
    setNote(null)
    const { error: err } = await fn()
    if (err) {
      setError(err.message)
      return false
    }
    if (ok) setNote(ok)
    await load()
    return true
  }

  const openPdf = async (path: string) => {
    const { data } = await supabase.storage.from('booking-documents').createSignedUrl(path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else setError('Could not open that PDF.')
  }

  if (!dbId) return null

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-semibold">
            <FileText size={16} className="text-primary" /> Invoice records
          </h3>
          <p className="mt-1 max-w-2xl text-xs text-muted">
            The invoices for this booking. Each is raised in Zoho by hand; this holds its record
            and the Zoho PDF. Nothing here calculates GST or posts to Zoho.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Close' : 'Add invoice record'}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {note && <p className="text-sm text-primary">{note}</p>}

      {adding && (
        <AddRecord
          booking={booking}
          onDone={async (message) => {
            setAdding(false)
            setNote(message)
            await load()
          }}
          onError={setError}
        />
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-medium">Zoho no.</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Bill-to</th>
              <th className="px-3 py-2 font-medium">PDF</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const waiting = pending.has(r.id)
              return (
                <tr key={r.id} className="border-b border-line align-top last:border-0">
                  <td className="px-3 py-2.5">
                    <p className="font-mono text-xs">{r.zoho_invoice_id ?? '—'}</p>
                    <p className="text-[10px] text-muted">ERP ref {r.invoice_no}</p>
                  </td>
                  <td className="px-3 py-2.5 text-xs">{r.kind ? KIND_LABEL[r.kind] : '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    {r.currency === 'USD' ? '$' : '₹'}
                    {Number(r.subtotal ?? r.total_inr ?? 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-2.5 text-xs">{r.party_name ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {r.pdf_path ? (
                      <button className="text-link hover:underline" onClick={() => void openPdf(r.pdf_path!)}>
                        View
                      </button>
                    ) : (
                      <span className="text-muted">none</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {r.paid_at ? (
                        <Badge tone="success" label={`Paid · ${r.paid_method ?? ''}`} />
                      ) : waiting ? (
                        <Badge tone="info" label="Payment awaiting approval" />
                      ) : (
                        <Badge tone="warn" label="Unpaid" />
                      )}
                      <Badge
                        tone={r.published_to_portal ? 'info' : 'neutral'}
                        label={r.published_to_portal ? 'On portal' : 'Not on portal'}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {!r.published_to_portal && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            void run(
                              () => supabase.rpc('publish_invoice', { p_invoice: r.id }),
                              'Published to the portal.',
                            )
                          }
                        >
                          Publish to portal
                        </Button>
                      )}
                      {!r.paid_at && !waiting && (
                        <Button size="sm" variant="ghost" onClick={() => setPayFor(payFor === r.id ? null : r.id)}>
                          Mark as paid
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted">
                  No invoice recorded yet. Raise it in Zoho, then add its record here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {payFor && (
        <MarkPaid
          invoice={rows.find((r) => r.id === payFor)!}
          bookingDbId={dbId}
          onCancel={() => setPayFor(null)}
          onDone={async () => {
            setPayFor(null)
            setNote('Payment recorded. It is waiting for an Admin or Approver to agree, and the invoice stays Unpaid until then.')
            await load()
          }}
          onError={setError}
        />
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-muted">
        <Info size={12} className="mt-0.5 shrink-0" />
        Publishing shows the invoice record to the customer. Its PDF stays in private storage and
        is not downloadable from the portal yet.
      </p>
    </Card>
  )
}

function AddRecord({
  booking,
  onDone,
  onError,
}: {
  booking: Booking
  onDone: (message: string) => Promise<void>
  onError: (m: string | null) => void
}) {
  const [kind, setKind] = useState<'freight_and_locals' | 'document'>('freight_and_locals')
  const [zoho, setZoho] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR')
  const [billTo, setBillTo] = useState(booking.bookingPartyName ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    onError(null)
    setSaving(true)
    let pdfPath: string | null = null
    if (file) {
      // Folder one is the booking id, which is what the bucket's policies key on.
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      pdfPath = `${booking.dbId}/invoices/${Date.now()}_${safe}`
      const { error: upErr } = await supabase.storage
        .from('booking-documents')
        .upload(pdfPath, file, { contentType: file.type || 'application/pdf' })
      if (upErr) {
        setSaving(false)
        onError(upErr.message)
        return
      }
    }
    const { data, error: err } = await supabase.rpc('create_invoice_record', {
      p_booking: booking.dbId,
      p_kind: kind,
      p_zoho_no: zoho,
      p_amount: Number(amount),
      p_currency: currency,
      p_bill_to: billTo,
      p_pdf_path: pdfPath,
    })
    setSaving(false)
    if (err) {
      // Do not leave an orphan file behind a record that was refused.
      if (pdfPath) await supabase.storage.from('booking-documents').remove([pdfPath])
      onError(err.message)
      return
    }
    await onDone(`Recorded as ${data as string}.`)
  }

  return (
    <div className="grid gap-3 rounded-btn border border-line bg-surface-2/40 p-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-xs text-muted">
        Type
        <Select className="mt-1" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="freight_and_locals">Freight and locals</option>
          <option value="document">Document</option>
        </Select>
      </label>
      <label className="text-xs text-muted">
        Zoho invoice number
        <TextInput className="mt-1" value={zoho} onChange={(e) => setZoho(e.target.value)} placeholder="As shown in Zoho" />
      </label>
      <label className="text-xs text-muted">
        Bill-to
        <TextInput className="mt-1" value={billTo} onChange={(e) => setBillTo(e.target.value)} />
      </label>
      <label className="text-xs text-muted">
        Amount
        <TextInput className="mt-1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label className="text-xs text-muted">
        Currency
        <Select className="mt-1" value={currency} onChange={(e) => setCurrency(e.target.value as 'INR' | 'USD')}>
          <option value="INR">INR</option>
          <option value="USD">USD</option>
        </Select>
      </label>
      <label className="text-xs text-muted">
        Zoho PDF
        <span className="mt-1 flex items-center gap-1.5 rounded-btn border border-line bg-surface px-2.5 py-1.5 text-xs text-heading">
          <Upload size={12} />
          <input
            type="file"
            accept="application/pdf"
            className="w-full text-[11px]"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </span>
      </label>
      <div className="sm:col-span-2 lg:col-span-3">
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save record'}
        </Button>
      </div>
    </div>
  )
}

function MarkPaid({
  invoice,
  bookingDbId,
  onCancel,
  onDone,
  onError,
}: {
  invoice: InvoiceRecord
  bookingDbId: string
  onCancel: () => void
  onDone: () => Promise<void>
  onError: (m: string | null) => void
}) {
  const [method, setMethod] = useState('Kinetic bank')
  const [amount, setAmount] = useState(String(invoice.subtotal ?? invoice.total_inr ?? ''))
  const [reference, setReference] = useState('')
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10))
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    onError(null)
    setSaving(true)
    let proof: string | null = null
    if (file) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      proof = `${bookingDbId}/payment-proof/${Date.now()}_${safe}`
      const { error: upErr } = await supabase.storage.from('booking-documents').upload(proof, file)
      if (upErr) {
        setSaving(false)
        onError(upErr.message)
        return
      }
    }
    const { error: err } = await supabase.rpc('request_mark_paid', {
      p_invoice: invoice.id,
      p_method: method,
      p_amount: Number(amount),
      p_reference: reference,
      p_paid_on: paidOn,
      p_proof_path: proof,
    })
    setSaving(false)
    if (err) {
      if (proof) await supabase.storage.from('booking-documents').remove([proof])
      onError(err.message)
      return
    }
    await onDone()
  }

  return (
    <div className="space-y-3 rounded-btn border border-line bg-surface-2/40 p-3">
      <p className="text-sm font-medium">
        Mark {invoice.zoho_invoice_id ?? invoice.invoice_no} as paid
      </p>
      <p className="text-[11px] text-muted">
        This marks it paid in the ERP only; the receipt is entered in Zoho separately. Because
        document release depends on it, an Admin or Approver has to agree.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-muted">
          How it was paid
          <Select className="mt-1" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option>Kinetic bank</option>
            <option>Payment gateway</option>
            <option>Other bank</option>
          </Select>
        </label>
        <label className="text-xs text-muted">
          Amount
          <TextInput className="mt-1" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          UTR or receipt reference
          <TextInput className="mt-1" value={reference} onChange={(e) => setReference(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Date
          <input
            type="date"
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
            className="mt-1 w-full rounded-input border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="block text-xs text-muted">
        Proof of payment
        <input
          type="file"
          className="mt-1 block text-[11px]"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <div className="flex gap-2">
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? 'Sending…' : 'Send for approval'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
