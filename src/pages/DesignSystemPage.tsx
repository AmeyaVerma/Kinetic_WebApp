import { TrendingUp } from 'lucide-react'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusChip } from '../components/ui/StatusChip'
import { KpiCard, KPI_TINTS } from '../components/ui/KpiCard'
import { ProgressBar } from '../components/ui/ProgressBar'
import type { ChipStatus } from '../lib/types'

const CHIP_STATUSES: ChipStatus[] = [
  'Booked',
  'In Transit',
  'Documentation',
  'Delivered',
  'Cancelled',
  'Draft',
  'BL Draft',
  'Pending',
  'Overdue',
]

function Swatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-10 w-10 shrink-0 rounded-btn border border-line"
        style={{ backgroundColor: hex }}
      />
      <div>
        <p className="text-xs font-semibold text-heading">{name}</p>
        <p className="font-mono text-[11px] text-muted">{hex}</p>
      </div>
    </div>
  )
}

export function DesignSystemPage() {
  return (
    <div className="space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-bold">Design System</h1>
        <p className="mt-1 text-sm text-muted">
          Internal reference — Kinetic Line ERP tokens, chips, and primitives.
        </p>
      </div>

      <Card>
        <CardHeader title="Palette" />
        <div className="grid grid-cols-2 gap-4 px-5 pb-5 sm:grid-cols-3 lg:grid-cols-4">
          <Swatch name="Background" hex="#FAFBFC" />
          <Swatch name="Surface" hex="#FFFFFF" />
          <Swatch name="Secondary Surface" hex="#F5F7FA" />
          <Swatch name="Border" hex="#E8EDF3" />
          <Swatch name="Primary (Emerald)" hex="#10B981" />
          <Swatch name="Primary Hover" hex="#059669" />
          <Swatch name="Blue" hex="#3B82F6" />
          <Swatch name="Purple" hex="#8B5CF6" />
          <Swatch name="Orange" hex="#F59E0B" />
          <Swatch name="Coral" hex="#EF4444" />
          <Swatch name="Teal" hex="#14B8A6" />
          <Swatch name="Success" hex="#22C55E" />
        </div>
      </Card>

      <Card>
        <CardHeader title="Status Chips" />
        <div className="flex flex-wrap gap-3 px-5 pb-5">
          {CHIP_STATUSES.map((s) => (
            <StatusChip key={s} status={s} />
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Buttons" />
        <div className="flex flex-wrap items-center gap-3 px-5 pb-5">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" size="sm">
            Primary sm
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="KPI Cards" />
        <div className="grid grid-cols-2 gap-4 px-5 pb-5 lg:grid-cols-5">
          <KpiCard label="Total Shipments" value="1,248" deltaPct={12.5} tint={KPI_TINTS.total} icon={<TrendingUp size={18} />} />
          <KpiCard label="In Transit" value="612" deltaPct={8.1} tint={KPI_TINTS.transit} icon={<TrendingUp size={18} />} />
          <KpiCard label="Delivered" value="528" deltaPct={10.3} tint={KPI_TINTS.delivered} icon={<TrendingUp size={18} />} />
          <KpiCard label="Revenue (USD)" value="2.45M" deltaPct={15.7} tint={KPI_TINTS.revenue} icon={<TrendingUp size={18} />} />
          <KpiCard label="BL Drafts" value="93" deltaPct={5.2} tint={KPI_TINTS.blDraft} icon={<TrendingUp size={18} />} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Progress Bars" />
        <div className="space-y-4 px-5 pb-5">
          <ProgressBar pct={32} color="#3B82F6" />
          <ProgressBar pct={64} color="#10B981" />
          <ProgressBar pct={18} color="#8B5CF6" />
        </div>
      </Card>

      <Card>
        <CardHeader title="Typography" />
        <div className="space-y-3 px-5 pb-5">
          <p className="font-display text-3xl font-bold">Heading — Archivo Bold</p>
          <p className="font-display text-xl font-semibold">Subheading — Archivo Semibold</p>
          <p className="text-sm text-body">Body text — Inter Regular, for paragraphs and descriptions.</p>
          <p className="text-sm text-muted">Muted text — Inter, secondary information.</p>
          <p className="font-mono text-sm text-heading">KL/EXP/25/000123 — IBM Plex Mono for refs, BL numbers, container numbers</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Radii & Shadow" />
        <div className="flex flex-wrap gap-4 px-5 pb-5">
          <div className="flex h-20 w-32 items-center justify-center rounded-card border border-line bg-surface-2 text-xs text-muted shadow-card">
            rounded-card (20px)
          </div>
          <div className="flex h-20 w-32 items-center justify-center rounded-btn border border-line bg-surface-2 text-xs text-muted">
            rounded-btn (12px)
          </div>
          <div className="flex h-20 w-32 items-center justify-center rounded-input border border-line bg-surface-2 text-xs text-muted">
            rounded-input (16px)
          </div>
          <div className="flex h-20 w-32 items-center justify-center rounded-badge border border-line bg-surface-2 text-xs text-muted">
            rounded-badge (999px)
          </div>
        </div>
      </Card>
    </div>
  )
}
