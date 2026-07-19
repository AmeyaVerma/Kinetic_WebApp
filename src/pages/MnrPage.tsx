import { useEffect, useMemo, useRef, useState } from 'react'
import { Container as ContainerIcon, Wrench, DollarSign, AlertTriangle, ClipboardCheck, Plus } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatKpi } from '../components/ui/StatKpi'
import { CsvButton } from '../components/ui/CsvButton'
import { StatusChip } from '../components/ui/StatusChip'
import { Tabs } from '../components/ui/Tabs'
import { Modal } from '../components/ui/Modal'
import { Field, Select, TextInput } from '../components/ui/Field'
import { JobDetail } from '../components/mnr/JobDetail'
import { useDataStore } from '../store/useDataStore'
import { latestEstimate } from '../lib/mnr'
import { mockDepots } from '../mocks/masters'
import type { ChipStatus, ContainerStatus, MnrJob } from '../lib/types'

const CONTAINER_CHIP: Record<ContainerStatus, ChipStatus> = {
  Available: 'Delivered',
  'On Hire': 'In Transit',
  'Under Repair': 'Documentation',
  'Off Hire': 'Draft',
  Hold: 'Pending',
  Scrapped: 'Cancelled',
  Lost: 'Overdue',
}

const STAGE_CHIP: Record<MnrJob['stage'], ChipStatus> = {
  'Initial Inspection': 'Pending',
  'Damage Survey': 'Documentation',
  Estimate: 'Draft',
  Approval: 'Pending',
  'Repair Execution': 'In Transit',
  'Quality Control': 'Documentation',
  'Finance Posting': 'BL Draft',
  Closed: 'Delivered',
}

export function MnrPage() {
  const [tab, setTab] = useState('jobs')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [gateInOpen, setGateInOpen] = useState(false)
  const { fleet, mnrJobs, approvals } = useDataStore()

  const kpis = useMemo(() => {
    const openJobs = mnrJobs.filter((j) => j.stage !== 'Closed')
    return {
      available: fleet.filter((f) => f.status === 'Available').length,
      underRepair: fleet.filter((f) => f.status === 'Under Repair').length,
      costMonth: mnrJobs.reduce((a, j) => a + (j.vendorBill ?? 0), 0),
      approvalQueue: approvals.filter((a) => a.entityType === 'repair_estimate' && a.status === 'Pending').length,
      openJobs: openJobs.length,
    }
  }, [fleet, mnrJobs, approvals])

  const selectedJob = mnrJobs.find((j) => j.id === selectedJobId) ?? null
  const jobDetailRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedJobId && jobDetailRef.current) {
      jobDetailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedJobId])

  const jobRows = useMemo(
    () =>
      mnrJobs.map((j) => {
        const est = latestEstimate(j)
        return {
          Container: j.containerNo,
          Booking: j.bookingRef ?? 'free-in',
          Depot: mockDepots.find((d) => d.id === j.depotId)?.name ?? j.depotId,
          'Damage points': j.damagePoints.length,
          'Estimate (USD)': est?.total ?? '',
          Stage: j.stage,
        }
      }),
    [mnrJobs],
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">MNR (Container)</h1>
          <p className="mt-1 text-sm text-muted">
            Maintenance & Repair — gate-in → inspection → survey → estimate → approval → repair → QC → finance → close.
          </p>
        </div>
        <Button onClick={() => setGateInOpen(true)}>
          <Plus size={15} /> Gate-in container
        </Button>
      </div>

      {/* KPI row (Requirements §7) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatKpi label="Containers Available" value={kpis.available} icon={<ContainerIcon size={17} />} tint="#ECFDF5" color="#10B981" />
        <StatKpi label="Under Repair" value={kpis.underRepair} icon={<Wrench size={17} />} tint="#FEF3C7" color="#B45309" />
        <StatKpi label="Repair Cost (posted)" value={`$${kpis.costMonth.toLocaleString()}`} icon={<DollarSign size={17} />} tint="#FFF7ED" color="#F97316" />
        <StatKpi label="Approval Queue" value={kpis.approvalQueue} icon={<ClipboardCheck size={17} />} tint="#EFF6FF" color="#3B82F6" />
        <StatKpi label="Open MNR Jobs" value={kpis.openJobs} icon={<AlertTriangle size={17} />} tint="#F5F3FF" color="#8B5CF6" />
      </div>

      <Tabs
        tabs={[
          { key: 'jobs', label: 'Repair jobs', badge: mnrJobs.filter((j) => j.stage !== 'Closed').length },
          { key: 'fleet', label: 'Fleet', badge: fleet.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'fleet' ? (
        <FleetTable />
      ) : (
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-end border-b border-line px-4 py-2.5">
              <CsvButton filename="mnr-repair-jobs" rows={jobRows} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-5 py-3 font-medium">Container</th>
                    <th className="px-3 py-3 font-medium">Booking</th>
                    <th className="px-3 py-3 font-medium">Depot</th>
                    <th className="px-3 py-3 font-medium">Damage pts</th>
                    <th className="px-3 py-3 font-medium">Estimate</th>
                    <th className="px-3 py-3 font-medium">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {mnrJobs.map((j) => {
                    const est = latestEstimate(j)
                    return (
                      <tr
                        key={j.id}
                        onClick={() => setSelectedJobId(j.id === selectedJobId ? null : j.id)}
                        className={`cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60 ${
                          selectedJobId === j.id ? 'bg-primary/5' : ''
                        }`}
                      >
                        <td className="px-5 py-3 font-mono text-xs font-medium text-link">{j.containerNo}</td>
                        <td className="px-3 py-3 font-mono text-xs text-body">{j.bookingRef ?? 'free-in'}</td>
                        <td className="px-3 py-3 text-xs text-body">
                          {mockDepots.find((d) => d.id === j.depotId)?.name ?? j.depotId}
                        </td>
                        <td className="px-3 py-3 text-xs text-body">
                          {j.damagePoints.length}
                          {j.engineeringRequired && (
                            <span className="ml-1.5 rounded-badge bg-[#FEE2E2] px-1.5 py-0.5 text-[10px] font-semibold text-[#DC2626]">
                              structural
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-body">
                          {est ? `$${est.total.toLocaleString()} (v${est.version})` : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <StatusChip status={STAGE_CHIP[j.stage]} />
                          <span className="ml-2 text-[11px] text-muted">{j.stage}</span>
                        </td>
                      </tr>
                    )
                  })}
                  {mnrJobs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted">
                        No MNR jobs — gate-in a container to start
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {selectedJob && (
            <div ref={jobDetailRef} className="scroll-mt-4">
              <JobDetail job={selectedJob} />
            </div>
          )}
        </div>
      )}

      <GateInModal open={gateInOpen} onClose={() => setGateInOpen(false)} onCreated={(id) => { setGateInOpen(false); setTab('jobs'); setSelectedJobId(id) }} />
    </div>
  )
}

function FleetTable() {
  const { fleet } = useDataStore()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | ContainerStatus>('All')
  const soon = (d: string) => new Date(d).getTime() - Date.now() < 90 * 86400000

  const q = query.trim().toLowerCase()
  const filtered = fleet.filter((f) => {
    if (statusFilter !== 'All' && f.status !== statusFilter) return false
    if (!q) return true
    return (
      f.containerNo.toLowerCase().includes(q) ||
      f.isoType.toLowerCase().includes(q) ||
      (mockDepots.find((d) => d.id === f.depotId)?.name ?? '').toLowerCase().includes(q)
    )
  })
  const shown = filtered.slice(0, 100)

  const fleetRows = filtered.map((f) => ({
    'Container No.': f.containerNo,
    Type: f.isoType,
    Ownership: f.ownership,
    'CSC Expiry': f.cscExpiry,
    'Location / Custodian': f.custodianBookingRef ?? mockDepots.find((d) => d.id === f.depotId)?.name ?? '',
    'Insured (USD)': f.insuredValue,
    Status: f.status,
  }))

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search container no., type or depot…"
          className="w-64 rounded-input border border-[#E5E7EB] dark:border-line bg-surface px-3 py-2 text-xs text-heading placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'All' | ContainerStatus)}
          className="rounded-input border border-[#E5E7EB] dark:border-line bg-surface px-3 py-2 text-xs text-body focus:border-primary focus:outline-none"
        >
          {(['All', 'Available', 'On Hire', 'Under Repair', 'Off Hire', 'Hold', 'Scrapped', 'Lost'] as const).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-muted">
          {filtered.length} container{filtered.length === 1 ? '' : 's'}
          {filtered.length > shown.length && ` · showing first ${shown.length}`}
        </span>
        <CsvButton filename="mnr-fleet" rows={fleetRows} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Container No.</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium">Ownership</th>
              <th className="px-3 py-3 font-medium">CSC expiry</th>
              <th className="px-3 py-3 font-medium">Location / custodian</th>
              <th className="px-3 py-3 font-medium">Insured</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <tr key={f.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                <td className="px-5 py-3 font-mono text-xs font-medium text-heading">{f.containerNo}</td>
                <td className="px-3 py-3 text-xs text-body">{f.isoType}{f.isReefer ? ' ❄' : ''}</td>
                <td className="px-3 py-3 text-xs text-body">
                  {f.ownership}
                  {f.lessor && <span className="block text-[10px] text-muted">{f.lessor}</span>}
                </td>
                <td className="px-3 py-3 font-mono text-xs">
                  <span className={soon(f.cscExpiry) ? 'font-semibold text-accent-coral' : 'text-body'}>
                    {f.cscExpiry}
                  </span>
                  {soon(f.cscExpiry) && (
                    <span className="ml-1.5 rounded-badge bg-[#FECACA] px-1.5 py-0.5 text-[10px] font-semibold text-[#B91C1C]">
                      &lt;90d
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-body">
                  {f.custodianBookingRef ? (
                    <span className="font-mono">{f.custodianBookingRef}</span>
                  ) : (
                    mockDepots.find((d) => d.id === f.depotId)?.name ?? '—'
                  )}
                </td>
                <td className="px-3 py-3 font-mono text-xs text-body">${f.insuredValue.toLocaleString()}</td>
                <td className="px-5 py-3"><StatusChip status={CONTAINER_CHIP[f.status]} /><span className="ml-2 text-[11px] text-muted">{f.status}</span></td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted">No containers match your filter</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ── Gate-in modal (flow 1: photo + EIR gates, seal check, OCR) ─ */

function GateInModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { fleet, bookings, registerGateIn } = useDataStore()
  const [containerNo, setContainerNo] = useState('')
  const [bookingRef, setBookingRef] = useState('')
  const [depotId, setDepotId] = useState('d4')
  const [importFull, setImportFull] = useState(false)
  const [sealIntact, setSealIntact] = useState(true)
  const [photos, setPhotos] = useState(0)
  const [eirSigned, setEirSigned] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  const knownContainer = fleet.some((f) => f.containerNo === containerNo)
  const matchedBooking = bookings.find((b) => b.bookingRef === bookingRef)
  const needsOverride = containerNo.length >= 11 && !matchedBooking && !bookingRef
  const canSubmit = containerNo.length >= 11 && photos >= 6 && eirSigned && (matchedBooking || overrideReason || bookingRef === 'FREE-IN')

  const reset = () => {
    setContainerNo(''); setBookingRef(''); setPhotos(0); setEirSigned(false); setOverrideReason(''); setImportFull(false); setSealIntact(true)
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title="Gate-in — depot arrival"
      subtitle="OCR/manual capture · seal check · min 6 photos · signed EIR (flow 1)"
      wide
      footer={
        <Button
          disabled={!canSubmit}
          className="disabled:opacity-50"
          onClick={() => {
            const id = registerGateIn({
              containerNo,
              bookingRef: matchedBooking ? matchedBooking.bookingRef : bookingRef === 'FREE-IN' ? null : bookingRef || null,
              depotId,
              sealIntact: importFull ? sealIntact : null,
              gateInPhotos: photos,
              eirSigned,
              overrideReason: overrideReason || null,
            })
            reset()
            if (id) onCreated(id)
          }}
        >
          Finalize gate-in
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Container number (OCR scan / manual)">
          <TextInput value={containerNo} onChange={(e) => setContainerNo(e.target.value.toUpperCase())} placeholder="e.g. DFSU2995398" />
        </Field>
        <Field label="Expected booking (auto-match)">
          <Select value={bookingRef} onChange={(e) => setBookingRef(e.target.value)}>
            <option value="">No match found…</option>
            <option value="FREE-IN">Free-in (new/leased unit, no booking)</option>
            {bookings.slice(0, 12).map((b) => (
              <option key={b.id} value={b.bookingRef}>{b.bookingRef} — {b.bookingPartyName}</option>
            ))}
          </Select>
        </Field>
        <Field label="Depot">
          <Select value={depotId} onChange={(e) => setDepotId(e.target.value)}>
            {mockDepots.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Import full container with sealed booking?">
          <Select value={importFull ? 'yes' : 'no'} onChange={(e) => setImportFull(e.target.value === 'yes')}>
            <option value="no">No — skip seal check</option>
            <option value="yes">Yes — check seal</option>
          </Select>
        </Field>
        {importFull && (
          <Field label="Seal intact / matches booking?">
            <Select value={sealIntact ? 'yes' : 'no'} onChange={(e) => setSealIntact(e.target.value === 'yes')}>
              <option value="yes">Yes — intact</option>
              <option value="no">No — broken/missing (raises cargo-claim event)</option>
            </Select>
          </Field>
        )}
        {needsOverride && (
          <Field label="OCR mismatch — manual override reason (flagged in audit log)">
            <TextInput value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Reason for override" />
          </Field>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-btn border border-line bg-surface-2/50 p-4">
          <p className="text-xs font-medium text-body">Gate-in photos (min 6: four sides + top + doors)</p>
          <div className="mt-2 flex items-center gap-3">
            <Button size="sm" variant="secondary" onClick={() => setPhotos((p) => p + 1)}>+ Capture photo</Button>
            <span className={`font-mono text-sm font-semibold ${photos >= 6 ? 'text-primary' : 'text-accent-coral'}`}>
              {photos}/6
            </span>
          </div>
          {photos < 6 && <p className="mt-2 text-[11px] text-muted">↻ gate-in cannot be finalized until minimum met</p>}
        </div>
        <div className="rounded-btn border border-line bg-surface-2/50 p-4">
          <p className="text-xs font-medium text-body">EIR — Equipment Interchange Receipt</p>
          <label className="mt-2.5 flex items-center gap-2 text-sm text-heading">
            <input type="checkbox" checked={eirSigned} onChange={(e) => setEirSigned(e.target.checked)} className="h-4 w-4 accent-[#10B981]" />
            Auto-generated EIR digitally signed by trucker at gate device
          </label>
          {knownContainer && <p className="mt-2 text-[11px] text-primary">✓ Container found in fleet master</p>}
        </div>
      </div>
    </Modal>
  )
}
