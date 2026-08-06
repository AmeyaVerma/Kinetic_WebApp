import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { StatusChip } from '../components/ui/StatusChip'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Tabs } from '../components/ui/Tabs'
import { FieldPill } from '../components/ui/Field'
import { EditableDatePill, EditableDateOnlyPill } from '../components/ui/EditableDatePill'
import { EditableTextPill } from '../components/ui/EditableTextPill'
import { EditableSelectPill } from '../components/ui/EditableSelectPill'
import { WeightCell } from '../components/ui/WeightCell'
import { StageStepper } from '../components/ui/StageStepper'
import { ContainerActivitiesTab } from '../components/booking/ContainerActivitiesTab'
import { FfDocumentsTab } from '../components/booking/FfDocumentsTab'
import { FfDetail } from '../components/ff/FfDetail'
import { useDataStore } from '../store/useDataStore'
import { useAuthStore, useCurrentUser } from '../store/useAuthStore'
import { FF_STAGES } from '../lib/ff'
import { BOOKING_WORKFLOW_STATUSES, WORKFLOW_STATUS_CHIP } from '../lib/bookingStatus'
import { HAZMAT_FIELD_LABELS } from '../lib/types'
import { mockAgents } from '../mocks/masters'
import type { BookingWorkflowStatus, FfShipment, HazmatDetails, HazmatStatus } from '../lib/types'

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

export function FfDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState('container')
  const { ffShipments, activities, setFfWorkflowStatus, fetchFfShipments } = useDataStore()

  useEffect(() => {
    fetchFfShipments()
  }, [fetchFfShipments])

  const shipment = ffShipments.find((f) => f.id === id)
  if (!shipment) {
    return (
      <div className="py-16 text-center text-sm text-muted">
        FF shipment not found.{' '}
        <Link to="/freight" className="text-link hover:underline">
          Back to Freight FWD
        </Link>
      </div>
    )
  }

  const shipmentActivities = activities.filter((a) => a.bookingId === shipment.id)
  const latestActivity = [...shipmentActivities].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  )[0]
  const workflowStatus: BookingWorkflowStatus = shipment.workflowStatus ?? 'Booked'
  const stageIndex = FF_STAGES.indexOf(shipment.stage)
  const pct = Math.round((stageIndex / (FF_STAGES.length - 1)) * 100)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/freight" className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-heading">
              <ArrowLeft size={13} /> Freight FWD shipments
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-xl font-bold">{shipment.ref}</h1>
              <div className="flex items-center gap-2">
                <StatusChip status={WORKFLOW_STATUS_CHIP[workflowStatus]} />
                <label className="flex items-center gap-1.5 text-[11px] text-muted">
                  Shipment status
                  <select
                    value={workflowStatus}
                    onChange={(e) =>
                      setFfWorkflowStatus(shipment.id, e.target.value as BookingWorkflowStatus, 'Ops')
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
              {shipment.customerName} · {shipment.origin} → {shipment.destination} · {shipment.mode}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1">
            <ProgressBar pct={pct} color="#10B981" height={7} />
          </div>
          <span className="font-mono text-xs font-semibold text-heading">{pct}%</span>
          <span className="text-[11px] text-muted">cycle — computed from FF stage</span>
        </div>

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

        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            FF lifecycle roadmap
          </p>
          <StageStepper stages={FF_STAGES} currentIndex={stageIndex} />
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <Card className="p-5">
        {tab === 'container' && <FfContainerInfoTab shipment={shipment} />}
        {tab === 'product' && <FfProductInfoTab shipment={shipment} />}
        {tab === 'shipment' && <FfShipmentDetailsTab shipment={shipment} />}
        {tab === 'agents' && <FfAgentDetailsTab shipment={shipment} />}
        {tab === 'yard' && <FfContainerYardTab shipment={shipment} />}
        {tab === 'activities' && <ContainerActivitiesTab recordId={shipment.id} />}
        {tab === 'documents' && <FfDocumentsTab shipment={shipment} />}
      </Card>

      {/* FF's own multi-vendor workflow (Carrier/Docs/Export/Arrival/Financial Close) — kept as-is inside Invoicing */}
      {tab === 'invoicing' && <FfDetail shipment={shipment} />}
    </div>
  )
}

/* ── Tab: Container info ──────────────────────────────────────── */

function FfContainerInfoTab({ shipment: f }: { shipment: FfShipment }) {
  const { updateFfField } = useDataStore()
  const setField = (field: 'containerType' | 'numberOfContainers' | 'sizeOfContainer' | 'sealNo' | 'customSealNo') =>
    (v: string) => updateFfField(f.id, field, v, 'Ops')

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <EditableTextPill label="Container type" value={f.containerType ?? ''} onChange={setField('containerType')} />
      <EditableTextPill label="Number of containers" value={f.numberOfContainers ?? ''} onChange={setField('numberOfContainers')} />
      <EditableTextPill label="Size of container" value={f.sizeOfContainer ?? ''} onChange={setField('sizeOfContainer')} />
      <EditableTextPill label="Seal No." value={f.sealNo ?? ''} onChange={setField('sealNo')} />
      <EditableTextPill label="Custom Seal No." value={f.customSealNo ?? ''} onChange={setField('customSealNo')} />
    </div>
  )
}

/* ── Tab: Product info ───────────────────────────────────────── */

function FfProductInfoTab({ shipment: f }: { shipment: FfShipment }) {
  const { updateFfField, requestFfFieldChange, setFfHazmatStatus, updateFfHazmatDetail, approvals } = useDataStore()
  const currentUser = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? currentUser?.role) === 'admin'
  const actor = currentUser?.name ?? 'Ops'
  const hazStatus: HazmatStatus = f.hazmatStatus ?? 'Non-Haz'
  const details = f.hazmatDetails ?? {}

  const pendingFor = (field: string) =>
    approvals.find((a) => a.entityId === f.id && a.status === 'Pending' && a.fieldChange?.field === field)
  const hintFor = (field: string) => {
    const p = pendingFor(field)
    return p ? `Pending Admin approval → ${p.fieldChange!.value}` : undefined
  }

  // Same split as NVOCC's Product info: Admin edits apply immediately,
  // anyone else's edit raises an Admin-approval request instead.
  const editField = (
    field: 'commodity' | 'hsCode' | 'packages' | 'packageType' | 'grossWeightKg' | 'freightTerms',
    label: string,
  ) =>
    (v: string) =>
      isAdmin
        ? updateFfField(f.id, field, v, actor)
        : requestFfFieldChange(f.id, field, label, v, actor)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <EditableTextPill
          label="Commodity"
          value={f.commodity ?? ''}
          disabled={!!pendingFor('commodity')}
          hint={hintFor('commodity')}
          onChange={editField('commodity', 'Commodity')}
        />
        <EditableTextPill
          label="HS code"
          value={f.hsCode ?? ''}
          disabled={!!pendingFor('hsCode')}
          hint={hintFor('hsCode')}
          onChange={editField('hsCode', 'HS code')}
        />
        <EditableTextPill
          label="Packages"
          value={f.packages ?? ''}
          disabled={!!pendingFor('packages')}
          hint={hintFor('packages')}
          onChange={editField('packages', 'Packages')}
        />
        {/* Unlike NVOCC (where package type is set once in the booking
            wizard and shown read-only here), the FF wizard never captures
            it — so it stays separately editable rather than a dead field. */}
        <EditableTextPill
          label="Package type"
          value={f.packageType ?? ''}
          disabled={!!pendingFor('packageType')}
          hint={hintFor('packageType')}
          onChange={editField('packageType', 'Package type')}
        />
        <label className="block rounded-btn border border-line bg-surface-2/60 px-3 py-2 focus-within:border-primary">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Cargo weight</p>
          <WeightCell
            value={f.grossWeightKg ?? ''}
            onChange={editField('grossWeightKg', 'Cargo weight')}
            disabled={!!pendingFor('grossWeightKg')}
            bare
          />
          {hintFor('grossWeightKg') && <p className="mt-1 text-[11px] text-accent-orange">{hintFor('grossWeightKg')}</p>}
        </label>
        <label className="block rounded-btn border border-line bg-surface-2/60 px-3 py-2 focus-within:border-primary">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Freight terms</p>
          <select
            value={f.freightTerms || 'Prepaid'}
            disabled={!!pendingFor('freightTerms')}
            onChange={(e) => editField('freightTerms', 'Freight terms')(e.target.value)}
            className="mt-0.5 w-full bg-transparent text-[13px] text-heading focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="Prepaid">Prepaid</option>
            <option value="Collect">Collected</option>
          </select>
          {hintFor('freightTerms') && <p className="mt-1 text-[11px] text-accent-orange">{hintFor('freightTerms')}</p>}
        </label>
        <label className="block rounded-btn border border-line bg-surface-2/60 px-3 py-2 focus-within:border-primary">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Haz / Non-Haz</p>
          <select
            value={hazStatus}
            onChange={(e) => setFfHazmatStatus(f.id, e.target.value as HazmatStatus, actor)}
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
                onChange={(v) => updateFfHazmatDetail(f.id, field, v, actor)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Tab: Shipment details (O+D) ─────────────────────────────── */

function FfShipmentDetailsTab({ shipment: f }: { shipment: FfShipment }) {
  const { updateFfField } = useDataStore()
  const setField = (field: keyof FfShipment) => (v: string) => updateFfField(f.id, field, v, 'Ops')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <FieldPill label="Place of Loading" value={f.origin} />
        <FieldPill label="Place of Discharge" value={f.destination} />
        {f.linkedNvoccRef && <FieldPill label="Linked NVOCC master" value={f.linkedNvoccRef} />}
        <EditableTextPill label="Vessel" value={f.vesselName ?? ''} onChange={setField('vesselName')} />
        <EditableTextPill label="Voyage" value={f.voyageNo ?? ''} onChange={setField('voyageNo')} />
        <EditableDatePill label="ETD" value={f.etd ?? ''} onChange={setField('etd')} />
        <EditableDatePill label="ETA" value={f.eta ?? ''} onChange={setField('eta')} />
        <EditableTextPill label="Terminal" value={f.terminal ?? ''} onChange={setField('terminal')} />
        <EditableTextPill label="MBL No." value={f.mblNo ?? ''} onChange={setField('mblNo')} />
        <EditableDatePill label="Gate open (planned)" value={f.plannedGateOpen ?? ''} onChange={setField('plannedGateOpen')} />
        <EditableDatePill label="Gate close (planned)" value={f.plannedGateClose ?? ''} onChange={setField('plannedGateClose')} />
        <EditableDatePill label="SI cut-off (planned)" value={f.plannedSiCutoff ?? ''} onChange={setField('plannedSiCutoff')} />
        <EditableDatePill label="Dock Cutoff" value={f.plannedVgmCutoff ?? ''} onChange={setField('plannedVgmCutoff')} />
        <EditableDatePill label="CY cut-off (planned)" value={f.plannedCyCutoff ?? ''} onChange={setField('plannedCyCutoff')} />
      </div>
      <p className="text-xs text-muted">
        FF's step-by-step progress (gate-in, VGM, cut-off, departure…) is tracked on the Invoicing tab's workflow
        panels rather than a separate milestone list, since it already drives the buy/sell costing there.
      </p>
    </div>
  )
}

/* ── Tab: Agent details ──────────────────────────────────────── */

function FfAgentDetailsTab({ shipment: f }: { shipment: FfShipment }) {
  const { updateFfField } = useDataStore()
  const linkedAgent = mockAgents.find((a) => a.id === f.agentId)
  const setField = (field: 'originAgentName' | 'destinationAgentName' | 'transshipmentAgent' | 'surveyorName') =>
    (v: string) => updateFfField(f.id, field, v, 'Ops')

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {linkedAgent && <FieldPill label="Linked agent (Agency module)" value={`${linkedAgent.name} (${linkedAgent.country})`} />}
      <EditableTextPill label="Origin agent" value={f.originAgentName ?? ''} onChange={setField('originAgentName')} />
      <EditableTextPill label="Destination agent" value={f.destinationAgentName ?? ''} onChange={setField('destinationAgentName')} />
      <EditableTextPill label="Transshipment agent" value={f.transshipmentAgent ?? ''} onChange={setField('transshipmentAgent')} />
      <EditableTextPill label="Surveyor" value={f.surveyorName ?? ''} onChange={setField('surveyorName')} />
    </div>
  )
}

/* ── Tab: Container yard ─────────────────────────────────────── */

function FfContainerYardTab({ shipment: f }: { shipment: FfShipment }) {
  const { updateFfField } = useDataStore()
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <EditableTextPill
          label="Empty container yard origin"
          value={f.emptyContainerYardOrigin ?? ''}
          onChange={(v) => updateFfField(f.id, 'emptyContainerYardOrigin', v, 'Ops')}
        />
        <EditableDateOnlyPill
          label="CRO Valid till"
          value={f.croValidTill ?? ''}
          onChange={(v) => updateFfField(f.id, 'croValidTill', v, 'Ops')}
        />
      </div>
    </div>
  )
}
