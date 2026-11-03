import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Inbox, Check, X, Info } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { DOC_LABEL } from '../lib/documentTypes'
import { Button } from '../components/ui/Button'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { Tabs } from '../components/ui/Tabs'
import { TextInput } from '../components/ui/Field'
import { useAuthStore, useCurrentUser, useIsApprover } from '../store/useAuthStore'
import { supabase } from '../lib/supabaseClient'

interface BookingRequest {
  id: string
  status: string
  payload: Record<string, string>
  booking_id: string | null
  reject_reason: string | null
  decided_by: string | null
  created_at: string
  parties?: { display_name: string | null; legal_name: string } | null
  bookings?: { booking_ref: string } | null
}

interface DocInvoice {
  id: string
  invoice_no: string
  total_inr: number | string | null
  published_to_portal: boolean
  paid_at: string | null
  document_request_id: string
}

interface DocumentRequest {
  id: string
  booking_id: string
  released_file_name?: string | null
  status: string
  doc_type: string
  reject_reason: string | null
  decided_by: string | null
  created_at: string
  bookings?: { booking_ref: string } | null
}

const TONE: Record<string, BadgeTone> = {
  Submitted: 'warn',
  'Under review': 'info',
  Approved: 'success',
  'Invoice sent': 'info',
  Paid: 'success',
  'Ready to download': 'done',
  Rejected: 'danger',
}

/** The release tracker v2 asks for, in the order it describes. */
const DOC_STAGES = ['Submitted', 'Under review', 'Approved', 'Invoice sent', 'Paid', 'Ready to download']

/**
 * Requests from the portal (spec v2).
 *
 * Nothing a customer or agent enters goes live without an Admin, so what
 * arrives here is a PROPOSAL, not a booking. Approving a booking request is
 * what creates the real booking and allocates its reference -- and that
 * happens in one server call, because a reference allocated by the browser
 * and then not used would be burned on nothing.
 *
 * A rejection needs a reason, because v2 says the customer sees it. The
 * database refuses a blank one rather than trusting this screen to ask.
 */
export function RequestsPage() {
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? user?.role) === 'admin'
  // Admin, or an Approver an Admin appointed in this company. Staff may still
  // raise and publish an invoice; only an approver decides a request.
  const canDecide = useIsApprover()

  const [tab, setTab] = useState('bookings')
  const [bookingReqs, setBookingReqs] = useState<BookingRequest[]>([])
  const [docReqs, setDocReqs] = useState<DocumentRequest[]>([])
  const [docInvoices, setDocInvoices] = useState<DocInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const [b, d] = await Promise.all([
      supabase
        .from('booking_requests')
        .select('*, parties(display_name, legal_name), bookings(booking_ref)')
        .order('created_at', { ascending: false }),
      supabase
        .from('document_requests')
        .select('*, bookings(booking_ref)')
        .order('created_at', { ascending: false }),
    ])
    setBookingReqs((b.data as unknown as BookingRequest[]) ?? [])
    const docs = (d.data as unknown as DocumentRequest[]) ?? []
    setDocReqs(docs)
    if (docs.length > 0) {
      const { data: inv } = await supabase
        .from('invoices')
        .select('id, invoice_no, total_inr, published_to_portal, paid_at, document_request_id')
        .in('document_request_id', docs.map((x) => x.id))
      setDocInvoices((inv as DocInvoice[]) ?? [])
    } else {
      setDocInvoices([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openBookings = useMemo(
    () => bookingReqs.filter((r) => r.status === 'Submitted' || r.status === 'Under review'),
    [bookingReqs],
  )
  const openDocs = useMemo(
    () => docReqs.filter((r) => !['Ready to download', 'Rejected'].includes(r.status)),
    [docReqs],
  )

  const approve = async (r: BookingRequest) => {
    setBusy(r.id)
    setError(null)
    setNote(null)
    const { data, error: err } = await supabase.rpc('approve_booking_request', {
      p_request: r.id,
      p_decided_by: user?.name ?? 'Admin',
    })
    setBusy(null)
    if (err) {
      setError(err.message)
      return
    }
    setNote(`Approved. Booking ${data as string} created.`)
    await load()
  }

  const reject = async (r: BookingRequest) => {
    setBusy(r.id)
    setError(null)
    setNote(null)
    const { error: err } = await supabase.rpc('reject_booking_request', {
      p_request: r.id,
      p_reason: reasons[r.id] ?? '',
      p_decided_by: user?.name ?? 'Admin',
    })
    setBusy(null)
    if (err) {
      setError(err.message)
      return
    }
    await load()
  }

  /** Calls one of the document-release functions and shows its refusal.
      The database decides; this only reports, so a fee that still reads
      Test Data produces the database's own explanation, not a guess. */
  const docAction = async (id: string, fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(id)
    setError(null)
    setNote(null)
    const { error: err } = await fn()
    setBusy(null)
    if (err) {
      setError(err.message)
      return
    }
    await load()
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <Inbox size={20} className="text-primary" />
          <h1 className="text-2xl font-bold">Requests</h1>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          What customers and agents have asked for through the portal. Nothing here is live yet
          — approving a booking request is what creates the booking and allocates its reference.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {note && <p className="text-sm text-primary">{note}</p>}

      <Tabs
        tabs={[
          { key: 'bookings', label: 'Booking requests', badge: openBookings.length },
          { key: 'documents', label: 'Document requests', badge: openDocs.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'bookings' && (
        <>
          {bookingReqs.length === 0 && !loading ? (
            <EmptyNote>
              No booking requests yet. They arrive when a customer or agent submits one from the
              portal; a request never becomes a booking, or consumes a booking number, until an
              Admin approves it.
            </EmptyNote>
          ) : (
            <div className="space-y-3">
              {bookingReqs.map((r) => (
                <Card key={r.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {r.parties?.display_name || r.parties?.legal_name || 'Unknown party'}
                        </span>
                        <Badge tone={TONE[r.status] ?? 'neutral'} label={r.status} />
                        {r.bookings?.booking_ref && (
                          <Link
                            to={`/nvocc/${r.bookings.booking_ref}`}
                            className="font-mono text-xs text-link hover:underline"
                          >
                            {r.bookings.booking_ref}
                          </Link>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">
                        Asked {new Date(r.created_at).toLocaleString('en-GB')}
                        {r.decided_by ? ` · decided by ${r.decided_by}` : ''}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(r.payload ?? {})
                      .filter(([, v]) => v !== null && v !== '')
                      .map(([k, v]) => (
                        <div key={k} className="flex gap-1.5">
                          <dt className="text-muted">{humanise(k)}:</dt>
                          <dd className="text-heading">{String(v)}</dd>
                        </div>
                      ))}
                  </dl>

                  {r.reject_reason && (
                    <p className="mt-2 text-[13px] text-red-600">Rejected: {r.reject_reason}</p>
                  )}

                  {isAdmin && (r.status === 'Submitted' || r.status === 'Under review') && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                      <Button size="sm" disabled={busy === r.id} onClick={() => void approve(r)}>
                        <Check size={13} /> {busy === r.id ? 'Working…' : 'Approve and create booking'}
                      </Button>
                      <div className="w-64">
                        <TextInput
                          placeholder="Reason, which the customer sees"
                          value={reasons[r.id] ?? ''}
                          onChange={(e) => setReasons((s) => ({ ...s, [r.id]: e.target.value }))}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === r.id}
                        onClick={() => void reject(r)}
                      >
                        <X size={13} /> Reject
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'documents' && (
        <>
          <div className="flex items-start gap-2 rounded-card border border-line bg-surface-2 px-4 py-3 text-xs text-muted">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>
              A customer cannot request a document until the freight and locals invoice is paid,
              and cannot download one until that document&rsquo;s own invoice is paid. Both gates
              are enforced by the database, so neither can be skipped from a screen. There is no
              override.
            </p>
          </div>
          {docReqs.length === 0 && !loading ? (
            <EmptyNote>No document requests yet.</EmptyNote>
          ) : (
            <div className="space-y-3">
              {docReqs.map((r) => (
                <Card key={r.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{DOC_LABEL[r.doc_type] ?? humanise(r.doc_type)}</span>
                    <Badge tone={TONE[r.status] ?? 'neutral'} label={r.status} />
                    {r.bookings?.booking_ref && (
                      <Link
                        to={`/nvocc/${r.bookings.booking_ref}`}
                        className="font-mono text-xs text-link hover:underline"
                      >
                        {r.bookings.booking_ref}
                      </Link>
                    )}
                  </div>
                  <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                    {DOC_STAGES.map((stage) => {
                      const reached = DOC_STAGES.indexOf(r.status) >= DOC_STAGES.indexOf(stage)
                      return (
                        <li key={stage} className="flex items-center gap-1.5 text-[11px]">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              reached ? 'bg-primary' : 'bg-line'
                            }`}
                          />
                          <span className={reached ? 'text-body' : 'text-muted'}>{stage}</span>
                        </li>
                      )
                    })}
                  </ol>
                  {r.reject_reason && (
                    <p className="mt-2 text-[13px] text-red-600">Rejected: {r.reject_reason}</p>
                  )}

                  {(() => {
                    const inv = docInvoices.find((i) => i.document_request_id === r.id)
                    const open = r.status === 'Submitted' || r.status === 'Under review'
                    return (
                      <div className="mt-3 space-y-2 border-t border-line pt-3">
                        {inv && (
                          <p className="text-[13px]">
                            <span className="font-mono">{inv.invoice_no}</span>
                            <span className="ml-2 text-muted">
                              ₹{Number(inv.total_inr ?? 0).toLocaleString('en-IN')}
                            </span>
                            <span className="ml-2">
                              <Badge
                                tone={inv.paid_at ? 'success' : inv.published_to_portal ? 'info' : 'warn'}
                                label={inv.paid_at ? 'Paid' : inv.published_to_portal ? 'Published' : 'Not published'}
                              />
                            </span>
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          {open && canDecide && (
                            <>
                              <Button
                                size="sm"
                                disabled={busy === r.id}
                                onClick={() =>
                                  void docAction(r.id, () =>
                                    supabase.rpc('decide_document_request', { p_request: r.id, p_approve: true }),
                                  )
                                }
                              >
                                <Check size={13} /> Approve
                              </Button>
                              <div className="w-56">
                                <TextInput
                                  placeholder="Reason, which the customer sees"
                                  value={reasons[r.id] ?? ''}
                                  onChange={(e) => setReasons((x) => ({ ...x, [r.id]: e.target.value }))}
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy === r.id}
                                onClick={() =>
                                  void docAction(r.id, () =>
                                    supabase.rpc('decide_document_request', {
                                      p_request: r.id,
                                      p_approve: false,
                                      p_reason: reasons[r.id] ?? '',
                                    }),
                                  )
                                }
                              >
                                <X size={13} /> Reject
                              </Button>
                            </>
                          )}

                          {r.status === 'Approved' && !inv && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy === r.id}
                              onClick={() =>
                                void docAction(r.id, () =>
                                  supabase.rpc('raise_document_invoice', { p_request: r.id }),
                                )
                              }
                            >
                              Raise the document invoice
                            </Button>
                          )}

                          {inv && !inv.published_to_portal && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy === r.id}
                              onClick={() =>
                                void docAction(r.id, () =>
                                  supabase.rpc('publish_invoice', { p_invoice: inv.id }),
                                )
                              }
                            >
                              Publish to portal
                            </Button>
                          )}
                        </div>

                        {r.status === 'Paid' && (
                          <ReleaseFile
                            requestId={r.id}
                            bookingId={r.booking_id}
                            busy={busy === r.id}
                            onRelease={(path, name) =>
                              void docAction(r.id, () =>
                                supabase.rpc('release_document_request', {
                                  p_request: r.id,
                                  p_path: path,
                                  p_file_name: name,
                                }),
                              )
                            }
                            onError={setError}
                          />
                        )}
                        {r.status === 'Ready to download' && (
                          <p className="text-[11px] text-muted">
                            Released{r.released_file_name ? `: ${r.released_file_name}` : ''}. The customer can download it.
                          </p>
                        )}

                        {open && !canDecide && (
                          <p className="text-[11px] text-muted">
                            Only an Admin or an Approver can decide a request.
                          </p>
                        )}
                        {r.status === 'Approved' && !inv && (
                          <p className="text-[11px] text-muted">
                            The invoice is priced from the Document fees master. If that fee still
                            reads Test Data the database refuses it and says so.
                          </p>
                        )}
                      </div>
                    )
                  })()}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {loading && <p className="text-sm text-muted">Loading…</p>}

      {!isAdmin && (
        <p className="text-xs text-muted">
          Only an Admin can decide a request. The database refuses it from anyone else, so this
          is a reminder rather than the control.
        </p>
      )}
    </div>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <Card className="p-8 text-center text-sm text-muted">
      <Inbox size={22} className="mx-auto mb-2 opacity-60" />
      <p className="mx-auto max-w-xl">{children}</p>
    </Card>
  )
}

/** camelCase or snake_case into something readable, for payload keys. */
function humanise(key: string): string {
  const spaced = key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

/**
 * Attach the final file to a Paid document request, which releases it.
 *
 * The file is uploaded first, into the private generated-documents bucket
 * under the booking's id, and only then is the release function called; the
 * database checks the file really is there and that the request is Paid.
 */
function ReleaseFile({
  requestId,
  bookingId,
  busy,
  onRelease,
  onError,
}: {
  requestId: string
  bookingId: string
  busy: boolean
  onRelease: (path: string, name: string) => void
  onError: (m: string | null) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const go = async () => {
    if (!file) return
    onError(null)
    setUploading(true)
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${bookingId}/released/${requestId}_${safe}`
    const { error } = await supabase.storage
      .from('generated-documents')
      .upload(path, file, { contentType: file.type || 'application/pdf', upsert: true })
    setUploading(false)
    if (error) {
      onError(error.message)
      return
    }
    onRelease(path, file.name)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="file" accept="application/pdf" className="text-[11px]" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <Button size="sm" variant="secondary" disabled={!file || uploading || busy} onClick={() => void go()}>
        {uploading ? 'Uploading…' : 'Attach file and release'}
      </Button>
      <span className="text-[11px] text-muted">The invoice is paid; attach the final document to release it.</span>
    </div>
  )
}
