import { useState } from 'react'
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
import { ContainerActivitiesTab } from '../components/booking/ContainerActivitiesTab'
import { useDataStore } from '../store/useDataStore'
import { cyclePct, deriveStatus, milestoneDefs, statusSequence } from '../lib/milestones'
import { StageStepper } from '../components/ui/StageStepper'
import { EditableDatePill } from '../components/ui/EditableDatePill'
import { EditableTextPill } from '../components/ui/EditableTextPill'
import { MarkMilestoneButton } from '../components/ui/MarkMilestoneButton'
import {
  BOOKING_WORKFLOW_STATUSES,
  WORKFLOW_STATUS_CHIP,
  workflowStatusOf,
} from '../lib/bookingStatus'
import { mockAgents, mockDepots, mockVendors } from '../mocks/masters'
import { HAZMAT_FIELD_LABELS } from '../lib/types'
import type { BookingWorkflowStatus, HazmatDetails, HazmatStatus } from '../lib/types'

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
    updatePlannedDate,
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
            onMark={(key, completedAt) => markMilestone(booking.id, key, 'Ops', completedAt)}
            onDateChange={(dates) => updateShipmentDates(booking.id, dates, 'Ops')}
            onPlannedDateChange={(field, value) => updatePlannedDate(booking.id, field, value, 'Ops')}
          />
        )}
        {tab === 'agents' && <AgentDetailsTab booking={booking} />}
        {tab === 'yard' && <ContainerYardTab booking={booking} />}
        {tab === 'activities' && <ContainerActivitiesTab recordId={booking.id} />}
        {tab === 'invoicing' && <InvoicingTab booking={booking} />}
        {tab === 'documents' && <DocumentsTab booking={booking} />}
      </Card>

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
  const { updateContainerInfoField } = useDataStore()
  const setField = (field: 'numberOfContainers' | 'sizeOfContainer' | 'sealNo' | 'customSealNo') =>
    (v: string) => updateContainerInfoField(booking.id, field, v, 'Ops')

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <FieldPill label="Container type" value={booking.containerType} />
      <FieldPill label="Quantity" value={String(booking.containerQty)} />
      <EditableTextPill
        label="Number of containers"
        value={booking.numberOfContainers ?? ''}
        onChange={setField('numberOfContainers')}
      />
      <EditableTextPill
        label="Size of container"
        value={booking.sizeOfContainer ?? ''}
        onChange={setField('sizeOfContainer')}
      />
      <EditableTextPill label="Seal No." value={booking.sealNo} onChange={setField('sealNo')} />
      <EditableTextPill
        label="Custom Seal No."
        value={booking.customSealNo ?? ''}
        onChange={setField('customSealNo')}
      />
      <FieldPill label="Free days (origin)" value={`${booking.freeDaysOrigin} days`} />
      <FieldPill label="Free days (destination)" value={`${booking.freeDaysDest} days`} />
    </div>
  )
}

/* ── Tab: Product info ───────────────────────────────────────── */

function ProductInfoTab({ booking }: { booking: import('../lib/types').Booking }) {
  const { setHazmatStatus, updateHazmatDetail } = useDataStore()
  const hazStatus: HazmatStatus = booking.hazmatStatus ?? 'Non-Haz'
  const details = booking.hazmatDetails ?? {}

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <FieldPill label="Commodity" value={booking.commodity} />
        <FieldPill label="HS code" value={booking.hsCode} />
        <FieldPill label="Packages" value={`${booking.packages} ${booking.packageType.toLowerCase()}`} />
        <FieldPill label="Gross weight" value={`${booking.grossWeightKg.toLocaleString()} kg`} />
        <FieldPill label="Freight terms" value={booking.freightTerms} />
        <FieldPill label="Principal" value={booking.principal} />
        <label className="block rounded-btn border border-line bg-surface-2/60 px-3 py-2 focus-within:border-primary">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Haz / Non-Haz</p>
          <select
            value={hazStatus}
            onChange={(e) => setHazmatStatus(booking.id, e.target.value as HazmatStatus, 'Ops')}
            className="mt-0.5 w-full bg-transparent text-[13px] text-heading focus:outline-none"
          >
            <option value="Non-Haz" className="bg-surface text-heading">Non-Haz</option>
            <option value="Haz" className="bg-surface text-heading">Haz</option>
          </select>
        </label>
      </div>

      {hazStatus === 'Haz' && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            IMDG / hazardous cargo details
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(HAZMAT_FIELD_LABELS) as (keyof HazmatDetails)[]).map((field) => (
              <EditableTextPill
                key={field}
                label={HAZMAT_FIELD_LABELS[field]}
                value={details[field] ?? ''}
                onChange={(v) => updateHazmatDetail(booking.id, field, v, 'Ops')}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Tab: Shipment details + milestone tracker (doc §6) ──────── */

function ShipmentDetailsTab({
  booking,
  entries,
  onMark,
  onDateChange,
  onPlannedDateChange,
}: {
  booking: import('../lib/types').Booking
  entries: import('../lib/types').MilestoneEntry[]
  onMark: (key: string, completedAt: string) => void
  onDateChange: (dates: { etd?: string; eta?: string }) => void
  onPlannedDateChange: (
    field: 'plannedGateOpen' | 'plannedGateClose' | 'plannedSiCutoff' | 'plannedVgmCutoff' | 'plannedCyCutoff',
    value: string,
  ) => void
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
        <EditableDatePill
          label="Gate open (planned)"
          value={booking.plannedGateOpen ?? ''}
          onChange={(v) => onPlannedDateChange('plannedGateOpen', v)}
        />
        <EditableDatePill
          label="Gate close (planned)"
          value={booking.plannedGateClose ?? ''}
          onChange={(v) => onPlannedDateChange('plannedGateClose', v)}
        />
        <EditableDatePill
          label="SI cut-off (planned)"
          value={booking.plannedSiCutoff ?? ''}
          onChange={(v) => onPlannedDateChange('plannedSiCutoff', v)}
        />
        <EditableDatePill
          label="VGM cut-off (planned)"
          value={booking.plannedVgmCutoff ?? ''}
          onChange={(v) => onPlannedDateChange('plannedVgmCutoff', v)}
        />
        <EditableDatePill
          label="CY cut-off (planned)"
          value={booking.plannedCyCutoff ?? ''}
          onChange={(v) => onPlannedDateChange('plannedCyCutoff', v)}
        />
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
                  <MarkMilestoneButton onConfirm={(date) => onMark(d.key, date)} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Tab: Agent details ──────────────────────────────────────── */

function AgentDetailsTab({ booking }: { booking: import('../lib/types').Booking }) {
  const { updateTransshipmentAgent } = useDataStore()
  const origin = mockAgents.find((a) => a.id === booking.originAgentId)
  const dest = mockAgents.find((a) => a.id === booking.destinationAgentId)
  const surveyor = mockVendors.find((v) => v.id === booking.surveyorId)
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FieldPill label="Origin agent" value={origin ? `${origin.name} (${origin.country})` : ''} />
      <FieldPill label="Destination agent" value={dest ? `${dest.name} (${dest.country})` : ''} />
      <EditableTextPill
        label="Transshipment agent"
        value={booking.transshipmentAgent ?? ''}
        onChange={(v) => updateTransshipmentAgent(booking.id, v, 'Ops')}
      />
      <FieldPill label="Surveyor" value={surveyor?.name ?? ''} />
      <FieldPill label="Shipper" value={booking.shipper} />
      <FieldPill label="Consignee" value={booking.consignee} />
      <FieldPill label="Notify party" value={booking.notifyParty} />
    </div>
  )
}

/* ── Tab: Container yard — CRO workflow (doc §3) ─────────────── */

function ContainerYardTab({ booking }: { booking: import('../lib/types').Booking }) {
  const { cros, generateCro, croPickup, updateEmptyYardField } = useDataStore()
  const cro = cros.find((c) => c.bookingId === booking.id)
  const depot = mockDepots.find((d) => d.id === booking.emptyYardId)
  const [containerNo, setContainerNo] = useState('')

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <FieldPill label="Empty container yard" value={depot ? `${depot.name} — ${depot.location}` : ''} />
        <FieldPill label="CRO status" value={cro?.status ?? 'Not generated'} />
        <EditableTextPill
          label="Empty container yard origin"
          value={booking.emptyContainerYardOrigin ?? ''}
          onChange={(v) => updateEmptyYardField(booking.id, 'emptyContainerYardOrigin', v, 'Ops')}
        />
        <EditableTextPill
          label="Empty container yard destination"
          value={booking.emptyContainerYardDestination ?? ''}
          onChange={(v) => updateEmptyYardField(booking.id, 'emptyContainerYardDestination', v, 'Ops')}
        />
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

