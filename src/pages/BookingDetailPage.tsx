import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Check, Container as ContainerIcon, Ban } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusChip } from '../components/ui/StatusChip'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Tabs } from '../components/ui/Tabs'
import { FieldPill, TextInput } from '../components/ui/Field'
import { DocumentsTab } from '../components/booking/DocumentsTab'
import { InvoicingTab } from '../components/booking/InvoicingTab'
import { CustomFieldsCard } from '../components/booking/CustomFieldsCard'
import { useDataStore } from '../store/useDataStore'
import { cyclePct, deriveStatus, milestoneDefs, statusSequence } from '../lib/milestones'
import { StageStepper } from '../components/ui/StageStepper'
import {
  BOOKING_WORKFLOW_STATUSES,
  WORKFLOW_STATUS_CHIP,
  workflowStatusOf,
} from '../lib/bookingStatus'
import { mockAgents, mockDepots, mockVendors } from '../mocks/masters'
import { CONTAINER_ACTIVITY_DEFS } from '../mocks/seed'
import type { BookingWorkflowStatus } from '../lib/types'

const TABS = [
  { key: 'container', label: 'Container info' },
  { key: 'product', label: 'Product info' },
  { key: 'shipment', label: 'Shipment details (O+D)' },
  { key: 'agents', label: 'Agent details' },
  { key: 'yard', label: 'Container yard' },
  { key: 'activities', label: 'Container activities' },
  { key: 'invoicing', label: 'Invoicing' },
  { key: 'documents', label: 'Documents' },
]

export function BookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState('container')
  const {
    bookings,
    milestones,
    markMilestone,
    activities,
    cancelBooking,
    updateShipmentDates,
    setBookingWorkflowStatus,
  } = useDataStore()

  const booking = bookings.find((b) => b.id === id)
  if (!booking) {
    return (
      <div className="py-16 text-center text-sm text-muted">
        Booking not found.{' '}
        <Link to="/nvocc" className="text-link hover:underline">
          Back to NVOCC
        </Link>
      </div>
    )
  }

  const entries = milestones.filter((m) => m.bookingId === booking.id)
  const pct = cyclePct(booking.direction, entries)
  const bookingActivities = activities.filter((a) => a.bookingId === booking.id)
  const workflowStatus = workflowStatusOf(booking)
  const latestActivity = [...bookingActivities].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  )[0]
  const roadmap = statusSequence(booking.direction)
  const lifecycleStatus = deriveStatus(booking.direction, entries, booking.cancelled)
  const roadmapIndex = roadmap.indexOf(lifecycleStatus)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/nvocc" className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-heading">
              <ArrowLeft size={13} /> NVOCC bookings
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-xl font-bold">{booking.bookingRef}</h1>
              <div className="flex items-center gap-2">
                <StatusChip status={WORKFLOW_STATUS_CHIP[workflowStatus]} />
                <label className="flex items-center gap-1.5 text-[11px] text-muted">
                  Booking status
                  <select
                    value={workflowStatus}
                    onChange={(e) =>
                      setBookingWorkflowStatus(booking.id, e.target.value as BookingWorkflowStatus, 'Ops')
                    }
                    className="rounded-btn border border-line bg-surface px-2.5 py-1 text-xs font-medium text-heading focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {BOOKING_WORKFLOW_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <p className="mt-1 text-sm text-body">
              {booking.bookingPartyName} · {booking.pol} → {booking.pod} · {booking.vesselName} / {booking.voyageNo}
              {booking.hblNo && (
                <>
                  {' · HBL '}
                  <span className="font-mono">{booking.hblNo}</span>
                </>
              )}
            </p>
          </div>
          {!booking.cancelled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cancelBooking(booking.id, 'Ops request')}
              className="text-accent-coral"
            >
              <Ban size={13} /> Void booking
            </Button>
          )}
        </div>
        {/* Cycle progress (doc §6 — computed, never manual) */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1">
            <ProgressBar pct={pct} color="#10B981" height={7} />
          </div>
          <span className="font-mono text-xs font-semibold text-heading">{pct}%</span>
          <span className="text-[11px] text-muted">cycle — computed from milestones</span>
        </div>
        {/* Latest update (Workflow v3 §9) */}
        <p className="mt-1.5 text-[11px] text-muted">
          Latest update:{' '}
          {latestActivity ? (
            <>
              <span className="text-body">{latestActivity.action}</span>
              {' · '}
              {new Date(latestActivity.at).toLocaleString()}
            </>
          ) : (
            '—'
          )}
        </p>

        {/* Lifecycle roadmap (Workflow §12 — relocated from FF) */}
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            {booking.direction} lifecycle roadmap — computed from milestones
          </p>
          <StageStepper stages={roadmap} currentIndex={roadmapIndex} />
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <Card className="p-5">
        {tab === 'container' && <ContainerInfoTab booking={booking} />}
        {tab === 'product' && <ProductInfoTab booking={booking} />}
        {tab === 'shipment' && (
          <ShipmentDetailsTab
            booking={booking}
            entries={entries}
            onMark={(key) => markMilestone(booking.id, key, 'Ops')}
            onDateChange={(dates) => updateShipmentDates(booking.id, dates, 'Ops')}
          />
        )}
        {tab === 'agents' && <AgentDetailsTab booking={booking} />}
        {tab === 'yard' && <ContainerYardTab booking={booking} />}
        {tab === 'activities' && <ContainerActivitiesTab bookingId={booking.id} />}
        {tab === 'invoicing' && <InvoicingTab booking={booking} />}
        {tab === 'documents' && <DocumentsTab booking={booking} />}
      </Card>

      {/* Custom fields (Workflow §11 — user-defined) */}
      <CustomFieldsCard bookingId={booking.id} />

      {/* Activity log — append-only audit */}
      <Card>
        <div className="px-5 pb-2 pt-5">
          <h3 className="text-[15px] font-semibold">Activity log</h3>
          <p className="text-xs text-muted">Append-only — every action, actor, timestamp</p>
        </div>
        <div className="space-y-0 px-5 pb-5">
          {bookingActivities.map((a) => (
            <div key={a.id} className="flex items-start gap-3 border-b border-line py-2.5 text-xs last:border-0">
              <span className="w-36 shrink-0 font-mono text-muted">{new Date(a.at).toLocaleString()}</span>
              <span className="w-32 shrink-0 font-medium text-heading">{a.actor}</span>
              <span className="text-body">{a.action}</span>
            </div>
          ))}
          {bookingActivities.length === 0 && (
            <p className="py-4 text-center text-sm text-muted">No activity yet</p>
          )}
        </div>
      </Card>
    </div>
  )
}

/* ── Tab: Container info ─────────────────────────────────────── */

function ContainerInfoTab({ booking }: { booking: import('../lib/types').Booking }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <FieldPill label="Container type" value={booking.containerType} />
      <FieldPill label="Quantity" value={String(booking.containerQty)} />
      <FieldPill label="Container numbers" value={booking.containerNos.join(', ') || 'Not yet assigned (via CRO)'} />
      <FieldPill label="Seal no." value={booking.sealNo} />
      <FieldPill label="Free days (origin)" value={`${booking.freeDaysOrigin} days`} />
      <FieldPill label="Free days (destination)" value={`${booking.freeDaysDest} days`} />
    </div>
  )
}

/* ── Tab: Product info ───────────────────────────────────────── */

function ProductInfoTab({ booking }: { booking: import('../lib/types').Booking }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <FieldPill label="Commodity" value={booking.commodity} />
      <FieldPill label="HS code" value={booking.hsCode} />
      <FieldPill label="Packages" value={`${booking.packages} ${booking.packageType.toLowerCase()}`} />
      <FieldPill label="Gross weight" value={`${booking.grossWeightKg.toLocaleString()} kg`} />
      <FieldPill label="Freight terms" value={booking.freightTerms} />
      <FieldPill label="Principal" value={booking.principal} />
    </div>
  )
}

/* ── Tab: Shipment details + milestone tracker (doc §6) ──────── */

function ShipmentDetailsTab({
  booking,
  entries,
  onMark,
  onDateChange,
}: {
  booking: import('../lib/types').Booking
  entries: import('../lib/types').MilestoneEntry[]
  onMark: (key: string) => void
  onDateChange: (dates: { etd?: string; eta?: string }) => void
}) {
  const defs = milestoneDefs(booking.direction)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <FieldPill label="POL" value={booking.pol} />
        <FieldPill label="POD" value={booking.pod} />
        <FieldPill label="Vessel / voyage" value={`${booking.vesselName} / ${booking.voyageNo}`} />
        <EditableDatePill label="ETD / SOB" value={booking.etd} onChange={(v) => onDateChange({ etd: v })} />
        <EditableDatePill label="ETA" value={booking.eta} onChange={(v) => onDateChange({ eta: v })} />
        <FieldPill label="Terminal" value={booking.terminal ?? ''} />
        <FieldPill label="MBL No." value={booking.mblNo ?? ''} />
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          {booking.direction} milestone sequence — date-stamped, drives status & cycle %
        </p>
        <div className="space-y-1.5">
          {defs.map((d, i) => {
            const entry = entries.find((e) => e.key === d.key && e.completedAt)
            return (
              <div
                key={d.key}
                className={`flex items-center gap-3 rounded-btn border px-4 py-2.5 ${
                  entry ? 'border-primary/30 bg-primary/5' : 'border-line bg-surface'
                }`}
              >
                <span className="w-6 font-mono text-[11px] text-muted">{String(i + 1).padStart(2, '0')}</span>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full ${
                    entry ? 'bg-primary text-white' : 'border border-line text-transparent'
                  }`}
                >
                  <Check size={12} />
                </span>
                <span className={`flex-1 text-[13px] ${entry ? 'font-medium text-heading' : 'text-body'}`}>
                  {d.label}
                </span>
                {entry ? (
                  <span className="font-mono text-[11px] text-muted">
                    {new Date(entry.completedAt!).toLocaleDateString()} · {entry.completedBy}
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => onMark(d.key)}>
                    Mark
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Date field editable by typing or via the native calendar picker; saves on blur. */
function EditableDatePill({
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
          if (draft && draft !== value) onChange(draft)
        }}
        className="mt-0.5 w-full bg-transparent text-[13px] text-heading focus:outline-none"
      />
    </label>
  )
}

/* ── Tab: Agent details ──────────────────────────────────────── */

function AgentDetailsTab({ booking }: { booking: import('../lib/types').Booking }) {
  const origin = mockAgents.find((a) => a.id === booking.originAgentId)
  const dest = mockAgents.find((a) => a.id === booking.destinationAgentId)
  const surveyor = mockVendors.find((v) => v.id === booking.surveyorId)
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FieldPill label="Origin agent" value={origin ? `${origin.name} (${origin.country})` : ''} />
      <FieldPill label="Destination agent" value={dest ? `${dest.name} (${dest.country})` : ''} />
      <FieldPill label="Surveyor" value={surveyor?.name ?? ''} />
      <FieldPill label="Shipper" value={booking.shipper} />
      <FieldPill label="Consignee" value={booking.consignee} />
      <FieldPill label="Notify party" value={booking.notifyParty} />
    </div>
  )
}

/* ── Tab: Container yard — CRO workflow (doc §3) ─────────────── */

function ContainerYardTab({ booking }: { booking: import('../lib/types').Booking }) {
  const { cros, generateCro, croPickup } = useDataStore()
  const cro = cros.find((c) => c.bookingId === booking.id)
  const depot = mockDepots.find((d) => d.id === booking.emptyYardId)
  const [containerNo, setContainerNo] = useState('')

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <FieldPill label="Empty container yard" value={depot ? `${depot.name} — ${depot.location}` : ''} />
        <FieldPill label="CRO status" value={cro?.status ?? 'Not generated'} />
      </div>

      <div className="rounded-card border border-line bg-surface-2/40 p-5">
        <div className="flex items-center gap-2">
          <ContainerIcon size={17} className="text-accent-orange" />
          <h3 className="text-[15px] font-semibold">CRO — Container Release Order (MNR action)</h3>
        </div>
        <p className="mt-1.5 text-xs text-muted">
          Auto-fills from booking: shipper, container type/size, empty yard, free days, validity. MNR enters the
          container number on pickup — which logs a gate-out activity and advances the cycle.
        </p>

        {!cro && (
          <Button size="sm" className="mt-4" onClick={() => generateCro(booking.id)}>
            Generate CRO from booking
          </Button>
        )}

        {cro?.status === 'Issued' && (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="w-56">
              <p className="mb-1.5 text-xs font-medium text-body">Container number (on pickup)</p>
              <TextInput
                value={containerNo}
                onChange={(e) => setContainerNo(e.target.value.toUpperCase())}
                placeholder="e.g. KLCU4001234"
              />
            </div>
            <Button
              size="sm"
              disabled={containerNo.length < 8}
              className="disabled:opacity-50"
              onClick={() => croPickup(booking.id, containerNo)}
            >
              Confirm pickup — gate-out
            </Button>
          </div>
        )}

        {cro?.status === 'Container picked up' && (
          <p className="mt-4 flex items-center gap-2 text-sm text-primary">
            <Check size={15} /> Container <span className="font-mono font-semibold">{cro.containerNo}</span> picked
            up — gate-out logged, milestone marked
          </p>
        )}
      </div>
    </div>
  )
}

/* ── Tab: Container activities (doc §2 — origin + destination) ─ */

function ContainerActivitiesTab({ bookingId }: { bookingId: string }) {
  const { containerActivities, markContainerActivity } = useDataStore()
  const acts =
    containerActivities[bookingId] ?? CONTAINER_ACTIVITY_DEFS.map((d) => ({ ...d, completedAt: null }))

  const sections = [
    { key: 'origin' as const, label: 'Origin activities' },
    { key: 'destination' as const, label: 'Destination activities' },
  ]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {sections.map((sec) => (
        <div key={sec.key}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{sec.label}</p>
          <div className="space-y-1.5">
            {acts
              .filter((a) => a.section === sec.key)
              .map((a) => (
                <div
                  key={a.key}
                  className={`flex items-center gap-3 rounded-btn border px-4 py-2.5 ${
                    a.completedAt ? 'border-primary/30 bg-primary/5' : 'border-line bg-surface'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${
                      a.completedAt ? 'bg-primary text-white' : 'border border-line text-transparent'
                    }`}
                  >
                    <Check size={12} />
                  </span>
                  <span className={`flex-1 text-[13px] ${a.completedAt ? 'font-medium text-heading' : 'text-body'}`}>
                    {a.label}
                  </span>
                  {a.completedAt ? (
                    <span className="font-mono text-[11px] text-muted">
                      {new Date(a.completedAt).toLocaleDateString()}
                    </span>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => markContainerActivity(bookingId, a.key)}>
                      Mark
                    </Button>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
