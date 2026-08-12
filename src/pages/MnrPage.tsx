import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Container as ContainerIcon,
  Wrench,
  AlertTriangle,
  ClipboardCheck,
  Plus,
  FileBarChart,
  DollarSign,
  TrendingUp,
  ShieldAlert,
  X,
} from 'lucide-react'
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
import { useCurrentUser } from '../store/useAuthStore'
import { latestEstimate } from '../lib/mnr'
import { deriveBookingLocation } from '../lib/fleetLocation'
import { mockDepots } from '../mocks/masters'
import { CONTAINER_REPORT_LOCATIONS } from '../lib/types'
import type { Booking, ChipStatus, ContainerActivity, ContainerStatus, FleetContainer, MnrJob } from '../lib/types'

const DAY_MS = 86400000
const cscExpiringSoon = (f: FleetContainer) => new Date(f.cscExpiry).getTime() - Date.now() < 90 * DAY_MS
const isIdle6Months = (f: FleetContainer) => Date.now() - new Date(f.lastUsedDate).getTime() > 182 * DAY_MS

/** A Fleet container's location for display — when it's out on a booking,
    derived from that booking's furthest-completed activity (see
    lib/fleetLocation); otherwise its depot. `code` is the matched report
    location (or null if out on a booking whose port text didn't match any
    of the 7), used to group the Fleet-by-location summary. */
function fleetLocation(
  f: FleetContainer,
  bookings: Booking[],
  containerActivities: Record<string, ContainerActivity[]>,
) {
  if (!f.custodianBookingRef) {
    return { code: null as string | null, label: mockDepots.find((d) => d.id === f.depotId)?.name ?? '—' }
  }
  const booking = bookings.find((b) => b.bookingRef === f.custodianBookingRef)
  const code = deriveBookingLocation(booking, booking ? containerActivities[booking.id] : undefined)
  const codeLabel = code ? CONTAINER_REPORT_LOCATIONS.find((l) => l.value === code)?.label : null
  return { code, label: codeLabel ? `${codeLabel} · ${f.custodianBookingRef}` : f.custodianBookingRef }
}

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
      approvalQueue: approvals.filter((a) => a.entityType === 'repair_estimate' && a.status === 'Pending').length,
      openJobs: openJobs.length,
    }
  }, [fleet, mnrJobs, approvals])

  const alertCount = useMemo(
    () => fleet.filter((f) => cscExpiringSoon(f) || isIdle6Months(f)).length,
    [fleet],
  )

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
        <div className="flex items-center gap-2">
          <Link to="/mnr/container-report">
            <Button variant="secondary">
              <FileBarChart size={15} /> Container report
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI row (Requirements §7) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatKpi label="Containers Available" value={kpis.available} icon={<ContainerIcon size={17} />} tint="#ECFDF5" color="#10B981" />
        <StatKpi label="Under Repair" value={kpis.underRepair} icon={<Wrench size={17} />} tint="#FEF3C7" color="#B45309" />
        <StatKpi label="Approval Queue" value={kpis.approvalQueue} icon={<ClipboardCheck size={17} />} tint="#EFF6FF" color="#3B82F6" />
        <StatKpi label="Open MNR Jobs" value={kpis.openJobs} icon={<AlertTriangle size={17} />} tint="#F5F3FF" color="#8B5CF6" />
      </div>

      <Tabs
        tabs={[
          { key: 'fleet', label: 'Fleet', badge: fleet.length },
          { key: 'jobs', label: 'Repair jobs', badge: mnrJobs.filter((j) => j.stage !== 'Closed').length },
          { key: 'alerts', label: 'Alerts', badge: alertCount },
          { key: 'cost', label: 'Repair cost sheet' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'fleet' && <FleetTable />}
      {tab === 'alerts' && <AlertsTable />}
      {tab === 'cost' && <RepairCostSheet />}
      {tab === 'jobs' && (
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
  const { fleet, bookings, containerActivities, fetchBookings, fetchContainerActivities } = useDataStore()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | ContainerStatus>('All')

  useEffect(() => {
    fetchBookings()
    fetchContainerActivities()
  }, [fetchBookings, fetchContainerActivities])

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
    Location: fleetLocation(f, bookings, containerActivities).label,
    Status: f.status,
  }))

  const locationSummary = useMemo(() => {
    const onBooking = fleet.filter((f) => f.custodianBookingRef)
    const counts = CONTAINER_REPORT_LOCATIONS.map((loc) => ({
      label: loc.label,
      count: onBooking.filter((f) => fleetLocation(f, bookings, containerActivities).code === loc.value).length,
    }))
    const unassigned = onBooking.filter((f) => !fleetLocation(f, bookings, containerActivities).code).length
    return { counts, unassigned, total: onBooking.length }
  }, [fleet, bookings, containerActivities])

  return (
    <div className="space-y-4">
      {locationSummary.total > 0 && (
        <Card className="p-4">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
            Fleet by location — {locationSummary.total} containers currently out on a booking
          </p>
          <div className="flex flex-wrap gap-2">
            {locationSummary.counts.map((c) => (
              <span
                key={c.label}
                className="rounded-badge border border-line bg-surface-2/60 px-2.5 py-1 text-xs text-body"
              >
                {c.label} <span className="font-mono font-semibold text-heading">{c.count}</span>
              </span>
            ))}
            {locationSummary.unassigned > 0 && (
              <span className="rounded-badge border border-accent-orange/30 bg-accent-orange/10 px-2.5 py-1 text-xs text-accent-orange">
                Unmatched port text <span className="font-mono font-semibold">{locationSummary.unassigned}</span>
              </span>
            )}
          </div>
        </Card>
      )}
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
              <th className="px-3 py-3 font-medium">Location</th>
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
                <td className="px-3 py-3 text-xs text-body">
                  {f.custodianBookingRef ? (
                    <span className="font-mono">{fleetLocation(f, bookings, containerActivities).label}</span>
                  ) : (
                    mockDepots.find((d) => d.id === f.depotId)?.name ?? '—'
                  )}
                </td>
                <td className="px-5 py-3"><StatusChip status={CONTAINER_CHIP[f.status]} /><span className="ml-2 text-[11px] text-muted">{f.status}</span></td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted">No containers match your filter</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
    </div>
  )
}

/* ── Alerts — CSC expiry within 90 days, and containers idle 6+ months ── */

function AlertsTable() {
  const { fleet, bookings, containerActivities, fetchBookings, fetchContainerActivities } = useDataStore()

  useEffect(() => {
    fetchBookings()
    fetchContainerActivities()
  }, [fetchBookings, fetchContainerActivities])

  const cscAlerts = useMemo(
    () => fleet.filter(cscExpiringSoon).sort((a, b) => a.cscExpiry.localeCompare(b.cscExpiry)),
    [fleet],
  )
  const idleAlerts = useMemo(
    () => fleet.filter(isIdle6Months).sort((a, b) => a.lastUsedDate.localeCompare(b.lastUsedDate)),
    [fleet],
  )
  const daysUntil = (d: string) => Math.round((new Date(d).getTime() - Date.now()) / DAY_MS)
  const daysAgo = (d: string) => Math.round((Date.now() - new Date(d).getTime()) / DAY_MS)
  const locationOf = (f: FleetContainer) => fleetLocation(f, bookings, containerActivities).label

  const cscRows = cscAlerts.map((f) => ({
    'Container No.': f.containerNo,
    Type: f.isoType,
    'CSC Expiry': f.cscExpiry,
    'Days left': daysUntil(f.cscExpiry),
    'Location': locationOf(f),
  }))
  const idleRows = idleAlerts.map((f) => ({
    'Container No.': f.containerNo,
    Type: f.isoType,
    Status: f.status,
    'Last Used': f.lastUsedDate,
    'Days Idle': daysAgo(f.lastUsedDate),
    'Location': locationOf(f),
  }))

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-accent-coral" />
            <h3 className="text-sm font-semibold text-heading">CSC expiry within 90 days</h3>
            <span className="rounded-badge bg-[#FEE2E2] px-1.5 py-0.5 text-[11px] font-semibold text-[#DC2626]">
              {cscAlerts.length}
            </span>
          </div>
          <CsvButton filename="mnr-alerts-csc-expiry" rows={cscRows} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Container No.</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">CSC expiry</th>
                <th className="px-3 py-3 font-medium">Location</th>
              </tr>
            </thead>
            <tbody>
              {cscAlerts.map((f) => (
                <tr key={f.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                  <td className="px-5 py-3 font-mono text-xs font-medium text-heading">{f.containerNo}</td>
                  <td className="px-3 py-3 text-xs text-body">{f.isoType}</td>
                  <td className="px-3 py-3 font-mono text-xs">
                    <span className="font-semibold text-accent-coral">{f.cscExpiry}</span>
                    <span className="ml-1.5 rounded-badge bg-[#FECACA] px-1.5 py-0.5 text-[10px] font-semibold text-[#B91C1C]">
                      {daysUntil(f.cscExpiry) < 0 ? 'expired' : `${daysUntil(f.cscExpiry)}d left`}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-body">{locationOf(f)}</td>
                </tr>
              ))}
              {cscAlerts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-muted">
                    No containers have a CSC expiry coming up in the next 90 days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-accent-orange" />
            <h3 className="text-sm font-semibold text-heading">Idle 6+ months</h3>
            <span className="rounded-badge bg-[#FFF7ED] px-1.5 py-0.5 text-[11px] font-semibold text-[#EA580C]">
              {idleAlerts.length}
            </span>
          </div>
          <CsvButton filename="mnr-alerts-idle" rows={idleRows} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Container No.</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Last used</th>
                <th className="px-3 py-3 font-medium">Location</th>
              </tr>
            </thead>
            <tbody>
              {idleAlerts.map((f) => (
                <tr key={f.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                  <td className="px-5 py-3 font-mono text-xs font-medium text-heading">{f.containerNo}</td>
                  <td className="px-3 py-3 text-xs text-body">{f.isoType}</td>
                  <td className="px-3 py-3"><StatusChip status={CONTAINER_CHIP[f.status]} /></td>
                  <td className="px-3 py-3 font-mono text-xs">
                    <span className="text-body">{f.lastUsedDate}</span>
                    <span className="ml-1.5 rounded-badge bg-[#FFF7ED] px-1.5 py-0.5 text-[10px] font-semibold text-[#EA580C]">
                      {daysAgo(f.lastUsedDate)}d ago
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-body">{locationOf(f)}</td>
                </tr>
              ))}
              {idleAlerts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted">
                    No containers have gone 6+ months without activity.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

/* ── Repair cost sheet — per-container spend vs a settable limit ─ */

const COST_LIMIT_KEY = 'mnr-repair-cost-limit'
const DEFAULT_COST_LIMIT = 2000

function CostBar({ value, max, limit, over }: { value: number; max: number; limit: number; over: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const limitPct = max > 0 ? Math.min(100, (limit / max) * 100) : 0
  return (
    <div className="relative h-[7px] w-full overflow-hidden rounded-badge bg-surface-2">
      <div
        className="h-full rounded-badge transition-all"
        style={{ width: `${pct}%`, backgroundColor: over ? '#DC2626' : '#10B981' }}
      />
      {limitPct > 0 && limitPct < 100 && (
        <div
          className="absolute top-0 h-full w-[2px] bg-heading/60"
          style={{ left: `${limitPct}%` }}
          title={`Limit: $${limit.toLocaleString()}`}
        />
      )}
    </div>
  )
}

function RepairCostSheet() {
  const { mnrJobs, fleet } = useDataStore()
  const [limit, setLimit] = useState<number>(() => {
    const saved = Number(localStorage.getItem(COST_LIMIT_KEY))
    return saved > 0 ? saved : DEFAULT_COST_LIMIT
  })
  const [limitDraft, setLimitDraft] = useState(String(limit))
  const [sortBy, setSortBy] = useState<'cost' | 'avg' | 'jobs'>('cost')

  useEffect(() => {
    localStorage.setItem(COST_LIMIT_KEY, String(limit))
  }, [limit])

  const rows = useMemo(() => {
    const byContainer = new Map<string, MnrJob[]>()
    for (const j of mnrJobs) {
      const list = byContainer.get(j.containerNo) ?? []
      list.push(j)
      byContainer.set(j.containerNo, list)
    }
    return Array.from(byContainer.entries()).map(([containerNo, jobs]) => {
      const jobCosts = jobs.map((j) => j.vendorBill ?? latestEstimate(j)?.total ?? 0)
      const totalCost = jobCosts.reduce((a, b) => a + b, 0)
      const container = fleet.find((f) => f.containerNo === containerNo)
      return {
        containerNo,
        type: container?.isoType ?? '—',
        jobCount: jobs.length,
        totalCost,
        avgCost: totalCost / jobs.length,
        overLimit: totalCost > limit,
        hasActual: jobs.some((j) => j.vendorBill !== null),
        latestStage: jobs[jobs.length - 1]?.stage,
      }
    })
  }, [mnrJobs, fleet, limit])

  const sorted = useMemo(() => {
    const list = [...rows]
    if (sortBy === 'cost') list.sort((a, b) => b.totalCost - a.totalCost)
    if (sortBy === 'avg') list.sort((a, b) => b.avgCost - a.avgCost)
    if (sortBy === 'jobs') list.sort((a, b) => b.jobCount - a.jobCount)
    return list
  }, [rows, sortBy])

  const summary = useMemo(() => {
    const totalSpend = rows.reduce((a, r) => a + r.totalCost, 0)
    const overCount = rows.filter((r) => r.overLimit).length
    return {
      totalSpend,
      overCount,
      underCount: rows.length - overCount,
      avgPerContainer: rows.length ? totalSpend / rows.length : 0,
      maxCost: rows.reduce((m, r) => Math.max(m, r.totalCost), 0),
      count: rows.length,
    }
  }, [rows])

  const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  const csvRows = sorted.map((r) => ({
    'Container No.': r.containerNo,
    Type: r.type,
    Jobs: r.jobCount,
    'Total Cost (USD)': r.totalCost.toFixed(2),
    'Avg Cost / Job (USD)': r.avgCost.toFixed(2),
    'Vs Limit': r.overLimit ? 'Over' : 'Under',
    'Latest Stage': r.latestStage,
  }))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatKpi label="Total repair spend" value={money(summary.totalSpend)} icon={<DollarSign size={17} />} tint="#FFF7ED" color="#F97316" />
        <StatKpi label="Containers repaired" value={summary.count} icon={<ContainerIcon size={17} />} tint="#EFF6FF" color="#3B82F6" />
        <StatKpi label="Avg cost / container" value={money(summary.avgPerContainer)} icon={<TrendingUp size={17} />} tint="#F5F3FF" color="#8B5CF6" />
        <StatKpi label="Over limit" value={summary.overCount} icon={<ShieldAlert size={17} />} tint="#FEF2F2" color="#DC2626" />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Repair cost limit, per container</p>
            <p className="mt-0.5 text-[11px] text-muted">Total repair spend above this flags the container as over limit.</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-input border border-[#E5E7EB] dark:border-line bg-surface px-3 py-2">
            <span className="text-sm text-muted">$</span>
            <input
              type="number"
              min={0}
              value={limitDraft}
              onChange={(e) => setLimitDraft(e.target.value)}
              onBlur={() => {
                const n = Number(limitDraft)
                if (n > 0) setLimit(n)
                else setLimitDraft(String(limit))
              }}
              className="w-28 bg-transparent text-sm text-heading focus:outline-none"
            />
          </div>
          <div className="ml-auto flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-body">
              <span className="h-2 w-2 rounded-full bg-[#DC2626]" /> {summary.overCount} over limit
            </span>
            <span className="flex items-center gap-1.5 text-body">
              <span className="h-2 w-2 rounded-full bg-[#10B981]" /> {summary.underCount} under limit
            </span>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'cost' | 'avg' | 'jobs')}
            className="rounded-input border border-[#E5E7EB] dark:border-line bg-surface px-3 py-2 text-xs text-body focus:border-primary focus:outline-none"
          >
            <option value="cost">Sort: Total cost</option>
            <option value="avg">Sort: Avg cost / job</option>
            <option value="jobs">Sort: Job count</option>
          </select>
          <span className="ml-auto text-xs text-muted">{sorted.length} containers</span>
          <CsvButton filename="mnr-repair-cost-sheet" rows={csvRows} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Container No.</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Jobs</th>
                <th className="px-3 py-3 font-medium">Total cost</th>
                <th className="px-3 py-3 font-medium">Avg / job</th>
                <th className="px-3 py-3 font-medium">Spend vs limit</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.containerNo} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                  <td className="px-5 py-3 font-mono text-xs font-medium text-heading">{r.containerNo}</td>
                  <td className="px-3 py-3 text-xs text-body">{r.type}</td>
                  <td className="px-3 py-3 text-xs text-body">{r.jobCount}</td>
                  <td className="px-3 py-3 font-mono text-xs font-semibold text-heading">
                    {money(r.totalCost)}
                    {!r.hasActual && (
                      <span className="ml-1.5 rounded-badge bg-[#EFF6FF] px-1.5 py-0.5 text-[10px] font-medium text-[#3B82F6]">
                        est.
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-body">{money(r.avgCost)}</td>
                  <td className="w-40 px-3 py-3">
                    <CostBar value={r.totalCost} max={summary.maxCost} limit={limit} over={r.overLimit} />
                  </td>
                  <td className="px-5 py-3">
                    {r.overLimit ? (
                      <span className="inline-flex items-center gap-1 rounded-badge bg-[#FEE2E2] px-2 py-1 text-[11px] font-semibold text-[#DC2626]">
                        <ShieldAlert size={11} /> Over limit
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-badge bg-[#DCFCE7] px-2 py-1 text-[11px] font-semibold text-[#15803D]">
                        Under limit
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted">
                    No repair jobs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

/* ── Gate-in modal (flow 1: photo + EIR gates, seal check, OCR) ─ */

function GateInModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { fleet, bookings, registerGateIn, uploadGateInPhoto } = useDataStore()
  const currentUser = useCurrentUser()
  const [containerNo, setContainerNo] = useState('')
  const [bookingRef, setBookingRef] = useState('')
  const [depotId, setDepotId] = useState('d4')
  const [importFull, setImportFull] = useState(false)
  const [sealIntact, setSealIntact] = useState(true)
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [eirSigned, setEirSigned] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const knownContainer = fleet.some((f) => f.containerNo === containerNo)
  const matchedBooking = bookings.find((b) => b.bookingRef === bookingRef)
  const needsOverride = containerNo.length >= 11 && !matchedBooking && !bookingRef
  const canSubmit =
    containerNo.length >= 11 && photos.length >= 6 && eirSigned && (matchedBooking || overrideReason || bookingRef === 'FREE-IN')

  const reset = () => {
    setContainerNo(''); setBookingRef(''); setEirSigned(false); setOverrideReason(''); setImportFull(false); setSealIntact(true)
    photoPreviews.forEach((url) => URL.revokeObjectURL(url))
    setPhotos([]); setPhotoPreviews([])
  }

  const addPhotos = (files: FileList | null) => {
    if (!files) return
    const list = Array.from(files)
    setPhotos((p) => [...p, ...list])
    setPhotoPreviews((p) => [...p, ...list.map((f) => URL.createObjectURL(f))])
  }

  const removePhoto = (i: number) => {
    URL.revokeObjectURL(photoPreviews[i])
    setPhotos((p) => p.filter((_, idx) => idx !== i))
    setPhotoPreviews((p) => p.filter((_, idx) => idx !== i))
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
          disabled={!canSubmit || submitting}
          className="disabled:opacity-50"
          onClick={async () => {
            const id = registerGateIn({
              containerNo,
              bookingRef: matchedBooking ? matchedBooking.bookingRef : bookingRef === 'FREE-IN' ? null : bookingRef || null,
              depotId,
              sealIntact: importFull ? sealIntact : null,
              gateInPhotos: photos.length,
              eirSigned,
              overrideReason: overrideReason || null,
            })
            if (!id) return
            setSubmitting(true)
            const results = await Promise.all(
              photos.map((file) => uploadGateInPhoto(id, containerNo, file, currentUser?.name ?? 'Depot clerk')),
            )
            setSubmitting(false)
            const failed = results.filter((r) => r.error).length
            if (failed > 0) {
              window.alert(`${failed} of ${photos.length} photos failed to upload — the gate-in itself still went through.`)
            }
            reset()
            onCreated(id)
          }}
        >
          {submitting ? 'Uploading photos…' : 'Finalize gate-in'}
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
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-body">Gate-in photos (min 6: four sides + top + doors)</p>
            <span className={`font-mono text-sm font-semibold ${photos.length >= 6 ? 'text-primary' : 'text-accent-coral'}`}>
              {photos.length}/6
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { addPhotos(e.target.files); e.target.value = '' }}
          />
          {photoPreviews.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {photoPreviews.map((url, i) => (
                <div key={url} className="group relative aspect-square overflow-hidden rounded-btn border border-line">
                  <img src={url} alt={`Gate-in photo ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    title="Remove photo"
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => fileInputRef.current?.click()}>
            <Plus size={13} /> Add photo{photoPreviews.length > 0 ? 's' : ''}
          </Button>
          {photos.length < 6 && <p className="mt-2 text-[11px] text-muted">↻ gate-in cannot be finalized until minimum met</p>}
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
