import { useEffect, useMemo, useState } from 'react'
import { Ship, LogOut, Lock, FileText, Receipt, Boxes, AlertTriangle } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Tabs } from '../components/ui/Tabs'
import { StatusChip } from '../components/ui/StatusChip'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Badge } from '../components/ui/Badge'
import { useAuthStore } from '../store/useAuthStore'
import { useUiStore } from '../store/useUiStore'
import { cyclePct, deriveStatus, toChipStatus, milestoneDefs } from '../lib/milestones'
import { ROLE_LABELS } from '../lib/rbac'
import {
  loadPortalIdentity,
  loadPortalData,
  type PortalIdentity,
  type PortalBooking,
  type PortalMilestone,
  type PortalDocument,
  type PortalInvoice,
} from '../lib/portal'
import type { AppUser } from '../store/useAuthStore'

const TH = 'px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted'
const TD = 'px-3 py-3 text-xs text-body'
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB') : '—')
const inr = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)

/**
 * The portal a customer or agent sees — a different building, not a
 * narrower door into this one.
 *
 * Everything here is read through row-level security: the queries ask for
 * all bookings and the database returns only this account's. That is the
 * point. The previous version filtered a list held in browser memory by
 * matching a name, which meant the isolation was a rendering decision and
 * the data was seeded. Both are now the database's job.
 */
export function ExternalPortal({ user }: { user: AppUser }) {
  const { signOut } = useAuthStore()
  const { theme, setTheme } = useUiStore()

  const [tab, setTab] = useState('shipments')
  const [identity, setIdentity] = useState<PortalIdentity | null>(null)
  const [bookings, setBookings] = useState<PortalBooking[]>([])
  const [milestones, setMilestones] = useState<PortalMilestone[]>([])
  const [documents, setDocuments] = useState<PortalDocument[]>([])
  const [invoices, setInvoices] = useState<PortalInvoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const who = await loadPortalIdentity()
      const data = await loadPortalData()
      if (cancelled) return
      setIdentity(who)
      setBookings(data.bookings)
      setMilestones(data.milestones)
      setDocuments(data.documents)
      setInvoices(data.invoices)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const refOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const b of bookings) map.set(b.id, b.bookingRef)
    return map
  }, [bookings])

  const outstanding = useMemo(
    () =>
      invoices
        .filter((i) => i.status !== 'Paid' && i.status !== 'Cancelled')
        .reduce((a, i) => a + i.totalInr, 0),
    [invoices],
  )

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur-md lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Ship size={19} strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold tracking-wide text-heading">KINETIC LINE</p>
            <p className="text-[10px] font-medium tracking-[0.12em] text-muted">
              {ROLE_LABELS[user.role].toUpperCase()} PORTAL
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex rounded-badge border border-line bg-surface p-1">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`rounded-badge px-2.5 py-1 text-[11px] font-medium capitalize ${
                  theme === t ? 'bg-primary text-white' : 'text-body hover:bg-surface-2'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-[13px] font-semibold text-heading">{user.name}</p>
            <p className="text-[11px] text-muted">{identity?.partyName ?? user.email}</p>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-btn border border-line bg-surface px-3 py-1.5 text-xs font-medium text-body hover:bg-surface-2"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-content px-4 py-8 lg:px-8">
        {!loading && !identity ? (
          <NotLinked />
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold">
                {identity?.kind === 'agent' ? 'Shipments you handle' : 'My shipments'}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                <Lock size={13} />
                {identity
                  ? `Scoped to ${identity.partyName} by the database, not by this page.`
                  : 'Loading your account…'}
              </p>
            </div>

            <div className="mt-5">
              <Tabs
                tabs={[
                  { key: 'shipments', label: 'Shipments', badge: bookings.length },
                  { key: 'documents', label: 'Documents', badge: documents.length },
                  ...(identity?.kind === 'customer'
                    ? [{ key: 'soa', label: 'Statement of account', badge: invoices.length }]
                    : []),
                ]}
                active={tab}
                onChange={setTab}
              />
            </div>

            {tab === 'shipments' && (
              <Card className="mt-5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line">
                        <th className={TH}>Booking ref</th>
                        <th className={TH}>POL → POD</th>
                        <th className={TH}>Vessel / voyage</th>
                        <th className={TH}>ETD</th>
                        <th className={TH}>ETA</th>
                        <th className={TH}>Progress</th>
                        <th className={TH}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => {
                        // deriveStatus and cyclePct only read key and
                        // completedAt. Who marked it is staff information and
                        // is deliberately not queried for the portal.
                        const mine = milestones
                          .filter((m) => m.bookingId === b.id)
                          .map((m) => ({
                            bookingId: b.id,
                            key: m.key,
                            completedAt: m.completedAt,
                            completedBy: null,
                          }))
                        const status = deriveStatus(b.direction, mine, b.cancelled)
                        const pct = cyclePct(b.direction, mine)
                        return (
                          <tr key={b.id} className="border-b border-line last:border-0">
                            <td className={`${TD} font-mono font-medium text-link`}>{b.bookingRef}</td>
                            <td className={TD}>
                              {b.pol || '—'} → {b.pod || '—'}
                            </td>
                            <td className={TD}>
                              {b.vesselName || '—'} / {b.voyageNo || '—'}
                            </td>
                            <td className={`${TD} font-mono`}>{day(b.etd)}</td>
                            <td className={`${TD} font-mono`}>{day(b.eta)}</td>
                            <td className="w-36 px-3 py-3">
                              <div className="flex items-center gap-2">
                                <ProgressBar pct={pct} color="#10B981" />
                                <span className="w-8 font-mono text-[11px] text-muted">{pct}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <StatusChip status={toChipStatus(status)} />
                            </td>
                          </tr>
                        )
                      })}
                      {!loading && bookings.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted">
                            No shipments under your account yet.
                          </td>
                        </tr>
                      )}
                      {loading && (
                        <tr>
                          <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted">
                            Loading…
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {tab === 'shipments' && bookings.length > 0 && (
              <Tracking bookings={bookings} milestones={milestones} />
            )}

            {tab === 'documents' && (
              <Card className="mt-5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line">
                        <th className={TH}>Booking</th>
                        <th className={TH}>Document</th>
                        <th className={TH}>Status</th>
                        <th className={TH}>Uploaded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((d) => (
                        <tr key={d.id} className="border-b border-line last:border-0">
                          <td className={`${TD} font-mono`}>{refOf.get(d.bookingId) ?? '—'}</td>
                          <td className={`${TD} font-medium`}>{d.docType}</td>
                          <td className={TD}>
                            <Badge tone={d.status === 'uploaded' ? 'success' : 'neutral'} label={d.status} />
                          </td>
                          <td className={`${TD} font-mono`}>{day(d.uploadedAt)}</td>
                        </tr>
                      ))}
                      {documents.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-5 py-10 text-center text-sm text-muted">
                            No documents have been shared with you yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="border-t border-line px-5 py-3 text-xs text-muted">
                  Downloading a file is not wired up yet — the storage bucket has its own
                  access rules and they have not been extended to portal accounts, so a link
                  here would fail rather than hand you the document.
                </p>
              </Card>
            )}

            {tab === 'soa' && (
              <div className="mt-5 space-y-4">
                <Card className="p-5">
                  <p className="text-xs uppercase tracking-wide text-muted">Outstanding</p>
                  <p className="mt-1 font-display text-2xl font-bold text-primary">
                    ₹{inr(outstanding)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Across {invoices.length} invoice{invoices.length === 1 ? '' : 's'} raised to you.
                  </p>
                </Card>
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-line">
                          <th className={TH}>Invoice</th>
                          <th className={TH}>Kind</th>
                          <th className={TH}>Date</th>
                          <th className={TH}>Due</th>
                          <th className={TH}>Amount (₹)</th>
                          <th className={TH}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((i) => (
                          <tr key={i.invoiceNo} className="border-b border-line last:border-0">
                            <td className={`${TD} font-mono font-medium`}>{i.invoiceNo}</td>
                            <td className={TD}>{i.docKind ?? '—'}</td>
                            <td className={`${TD} font-mono`}>{day(i.invoiceDate)}</td>
                            <td className={`${TD} font-mono`}>{day(i.dueDate)}</td>
                            <td className={`${TD} font-mono`}>{inr(i.totalInr)}</td>
                            <td className={TD}>
                              <Badge tone={i.status === 'Paid' ? 'success' : 'warn'} label={i.status} />
                            </td>
                          </tr>
                        ))}
                        {invoices.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted">
                              Nothing has been invoiced to you yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

/** Milestone tracking for each shipment — the "where is it" question. */
function Tracking({
  bookings,
  milestones,
}: {
  bookings: PortalBooking[]
  milestones: PortalMilestone[]
}) {
  return (
    <div className="mt-5 space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Boxes size={15} className="text-primary" /> Tracking
      </h2>
      {bookings.map((b) => {
        const defs = milestoneDefs(b.direction)
        const done = new Map(
          milestones.filter((m) => m.bookingId === b.id).map((m) => [m.key, m.completedAt]),
        )
        return (
          <Card key={b.id} className="p-4">
            <p className="font-mono text-xs font-semibold text-heading">
              {b.bookingRef}
              <span className="ml-2 font-sans font-normal text-muted">
                {b.pol || '—'} → {b.pod || '—'}
              </span>
            </p>
            <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {defs.map((d) => {
                const at = done.get(d.key)
                return (
                  <li key={d.key} className="flex items-center gap-1.5 text-[11px]">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${at ? 'bg-primary' : 'bg-line'}`}
                    />
                    <span className={at ? 'text-body' : 'text-muted'}>{d.label}</span>
                    {at && <span className="font-mono text-muted">{day(at)}</span>}
                  </li>
                )
              })}
            </ol>
          </Card>
        )
      })}
    </div>
  )
}

/**
 * A portal login with no account row.
 *
 * Said plainly rather than shown as an empty shipment list, because the two
 * look identical and mean completely different things: one is "you have no
 * shipments", the other is "nobody has told us who you are".
 */
function NotLinked() {
  return (
    <Card className="mx-auto max-w-xl p-8 text-center">
      <AlertTriangle size={28} className="mx-auto text-amber-500" />
      <h1 className="mt-3 text-xl font-bold">Your portal account is not linked yet</h1>
      <p className="mt-2 text-sm text-muted">
        Your sign-in works, but nobody has yet said which customer or agent you speak for, so
        there is nothing we can safely show you. An administrator links your account on the
        Users and Roles screen, and your shipments appear here immediately afterwards.
      </p>
      <div className="mt-5 flex justify-center gap-6 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <FileText size={13} /> Documents
        </span>
        <span className="flex items-center gap-1.5">
          <Boxes size={13} /> Tracking
        </span>
        <span className="flex items-center gap-1.5">
          <Receipt size={13} /> Statement of account
        </span>
      </div>
    </Card>
  )
}
