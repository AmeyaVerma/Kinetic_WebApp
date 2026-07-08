import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  TrendingUp,
  Truck,
  CheckCircle2,
  DollarSign,
  FileText,
  Ship,
  Users2,
  BarChart3,
} from 'lucide-react'
import { fetchDashboard } from '../lib/api'
import type { DashboardData } from '../lib/types'
import { Card, CardHeader } from '../components/ui/Card'
import { KpiCard, KPI_TINTS } from '../components/ui/KpiCard'
import { StatusChip } from '../components/ui/StatusChip'
import { ProgressBar } from '../components/ui/ProgressBar'

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    fetchDashboard().then(setData)
  }, [])

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted">
        Loading dashboard…
      </div>
    )
  }

  const { kpis, overview, byType, byTypeTotal, tradeLanes, recentBookings, tasks, totalBookings } = data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-card border border-line bg-surface p-6 shadow-card sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Everything at a glance. Let's keep your cargo moving.
          </p>
        </div>
        <Ship size={64} strokeWidth={1} className="hidden text-primary/20 sm:block" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Total Shipments"
          value={kpis.totalShipments.toLocaleString()}
          deltaPct={kpis.totalShipmentsDelta}
          tint={KPI_TINTS.total}
          icon={<TrendingUp size={18} />}
        />
        <KpiCard
          label="In Transit"
          value={kpis.inTransit.toLocaleString()}
          deltaPct={kpis.inTransitDelta}
          tint={KPI_TINTS.transit}
          icon={<Truck size={18} />}
        />
        <KpiCard
          label="Delivered"
          value={kpis.delivered.toLocaleString()}
          deltaPct={kpis.deliveredDelta}
          tint={KPI_TINTS.delivered}
          icon={<CheckCircle2 size={18} />}
        />
        <KpiCard
          label="Revenue (USD)"
          value={`${(kpis.revenueUsd / 1_000_000).toFixed(2)}M`}
          deltaPct={kpis.revenueDelta}
          tint={KPI_TINTS.revenue}
          icon={<DollarSign size={18} />}
        />
        <KpiCard
          label="BL Drafts"
          value={kpis.blDrafts.toLocaleString()}
          deltaPct={kpis.blDraftsDelta}
          tint={KPI_TINTS.blDraft}
          icon={<FileText size={18} />}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr_1fr]">
        <Card>
          <CardHeader title="Shipment Overview" />
          <div className="h-56 px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overview} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="booked" stroke="#22C55E" strokeWidth={2} dot={false} name="Booked" />
                <Line type="monotone" dataKey="inTransit" stroke="#3B82F6" strokeWidth={2} dot={false} name="In Transit" />
                <Line type="monotone" dataKey="delivered" stroke="#8B5CF6" strokeWidth={2} dot={false} name="Delivered" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 border-t border-line px-5 py-3 text-xs text-body">
            <LegendDot color="#22C55E" label="Booked" />
            <LegendDot color="#3B82F6" label="In Transit" />
            <LegendDot color="#8B5CF6" label="Delivered" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Shipment by Type" />
          <div className="relative flex h-40 items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byType}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={48}
                  outerRadius={68}
                  paddingAngle={2}
                  stroke="none"
                >
                  {byType.map((slice) => (
                    <Cell key={slice.label} fill={slice.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute flex flex-col items-center">
              <span className="text-xl font-bold text-heading">{byTypeTotal.toLocaleString()}</span>
              <span className="text-[11px] text-muted">Total</span>
            </div>
          </div>
          <div className="space-y-2 px-5 pb-5">
            {byType.map((slice) => (
              <div key={slice.label} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-body">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  {slice.label}
                </span>
                <span className="font-semibold text-heading">{slice.value}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Top Trade Lanes"
            action={
              <button className="text-xs font-medium text-link hover:underline">
                View all
              </button>
            }
          />
          <div className="space-y-4 px-5 pb-5">
            {tradeLanes.map((lane) => (
              <div key={`${lane.from}-${lane.to}`}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-body">
                    <Ship size={13} className="text-muted" />
                    {lane.to ? `${lane.from} → ${lane.to}` : lane.from}
                  </span>
                  <span className="font-semibold text-heading">{lane.sharePct}%</span>
                </div>
                <ProgressBar pct={lane.sharePct} color="#3B82F6" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Table + sidebar cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Recent Shipments"
            action={
              <button className="rounded-btn border border-[#E5E7EB] dark:border-line px-3 py-1.5 text-xs font-medium text-[#334155] dark:text-body hover:bg-surface-2">
                View all
              </button>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-y border-line text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-5 py-2.5 font-medium">Booking Ref</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">POL</th>
                  <th className="px-3 py-2.5 font-medium">POD</th>
                  <th className="px-3 py-2.5 font-medium">Vessel / Voyage</th>
                  <th className="px-3 py-2.5 font-medium">ETD</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Customer</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b) => (
                  <tr key={b.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                    <td className="px-5 py-3 font-mono text-xs font-medium text-link">{b.bookingRef}</td>
                    <td className="px-3 py-3 text-xs text-body">{b.type}</td>
                    <td className="px-3 py-3 text-xs text-body">{b.pol}</td>
                    <td className="px-3 py-3 text-xs text-body">{b.pod}</td>
                    <td className="px-3 py-3 text-xs text-body">{b.vesselVoyage}</td>
                    <td className="px-3 py-3 text-xs text-body">
                      {new Date(b.etd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-3">
                      <StatusChip status={b.chipStatus} />
                    </td>
                    <td className="px-5 py-3 text-xs text-body">{b.customerName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-muted">
            <span>Showing 1 to {recentBookings.length} of {totalBookings.toLocaleString()} entries</span>
            <Pagination />
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Quick Shortcuts" />
            <div className="grid grid-cols-2 gap-3 px-5 pb-5">
              <ShortcutButton icon={<Ship size={20} />} label="New Booking" />
              <ShortcutButton icon={<FileText size={20} />} label="BL Draft" />
              <ShortcutButton icon={<Users2 size={20} />} label="Customer Request" />
              <ShortcutButton icon={<BarChart3 size={20} />} label="Report Center" />
            </div>
          </Card>

          <Card>
            <CardHeader title="Today's Tasks" />
            <div className="space-y-1 px-2 pb-3">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-btn px-3 py-2.5 text-sm hover:bg-surface-2"
                >
                  <span className="text-body">{t.label}</span>
                  <span className="rounded-badge bg-surface-2 px-2 py-0.5 text-xs font-semibold text-heading">
                    {t.count}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-line px-5 py-3">
              <button className="text-xs font-medium text-link hover:underline">
                View all tasks →
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function ShortcutButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex flex-col items-center gap-2 rounded-btn border border-line bg-surface-2/60 px-3 py-4 text-center transition-colors hover:bg-primary/10">
      <span className="text-primary">{icon}</span>
      <span className="text-xs font-medium text-body">{label}</span>
    </button>
  )
}

function Pagination() {
  const pages = [1, 2, 3, 4, 5]
  return (
    <div className="flex items-center gap-1">
      {pages.map((p) => (
        <button
          key={p}
          className={`flex h-7 w-7 items-center justify-center rounded-btn text-xs font-medium ${
            p === 1 ? 'bg-primary text-white' : 'text-body hover:bg-surface-2'
          }`}
        >
          {p}
        </button>
      ))}
      <span className="px-1 text-body">…</span>
      <button className="flex h-7 w-7 items-center justify-center rounded-btn text-xs font-medium text-body hover:bg-surface-2">
        178
      </button>
    </div>
  )
}
