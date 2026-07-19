import { useEffect, useMemo, useRef, useState } from 'react'
import { UserCog, CheckCircle2, DollarSign, AlertTriangle, ShieldAlert } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { StatKpi } from '../components/ui/StatKpi'
import { CsvButton } from '../components/ui/CsvButton'
import { StatusChip } from '../components/ui/StatusChip'
import { AgentDetail } from '../components/agents/AgentDetail'
import { useDataStore } from '../store/useDataStore'
import type { AgentStatus, ChipStatus } from '../lib/types'

const STATUS_CHIP: Record<AgentStatus, ChipStatus> = {
  Prospect: 'Draft',
  Active: 'Delivered',
  Suspended: 'Overdue',
  Terminated: 'Cancelled',
}

export function AgentsPage() {
  const { agents } = useDataStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = agents.find((a) => a.id === selectedId) ?? null
  const detailRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedId && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedId])

  const kpis = useMemo(() => ({
    total: agents.length,
    active: agents.filter((a) => a.status === 'Active').length,
    soaDue: agents.filter((a) => a.soaBalanceUsd !== 0).length,
    flagged: agents.filter((a) => a.performanceFlagged).length,
    suspended: agents.filter((a) => a.status === 'Suspended' || a.status === 'Terminated').length,
  }), [agents])

  const agentRows = useMemo(
    () =>
      agents.map((a) => ({
        Code: a.code,
        Name: a.displayName || a.legalName,
        Direction: a.direction,
        Ports: a.portsCovered.join(', '),
        Commission: a.commissionType === '% of freight' ? `${a.commissionValue}%` : a.commissionType === 'Flat fee per shipment' ? `$${a.commissionValue}/shpt` : 'Tiered',
        'SOA Balance (USD)': a.soaBalanceUsd,
        Status: a.status,
      })),
    [agents],
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Agent Portal</h1>
        <p className="mt-1 text-sm text-muted">
          Agent management — every agency relationship: direction, commission and SOA terms, portal access,
          performance SLAs, and the lifecycle from prospect to (settlement-gated) termination. Agents can act on
          Kinetic Line's behalf, so every access grant here is deliberate and auditable.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatKpi label="Total Agents" value={kpis.total} icon={<UserCog size={17} />} tint="#ECFDF5" color="#10B981" />
        <StatKpi label="Active" value={kpis.active} icon={<CheckCircle2 size={17} />} tint="#EFF6FF" color="#3B82F6" />
        <StatKpi label="SOA Balance Due" value={kpis.soaDue} icon={<DollarSign size={17} />} tint="#FFF7ED" color="#F97316" />
        <StatKpi label="Performance Flagged" value={kpis.flagged} icon={<AlertTriangle size={17} />} tint="#FEF3C7" color="#B45309" />
        <StatKpi label="Suspended / Terminated" value={kpis.suspended} icon={<ShieldAlert size={17} />} tint="#FEE2E2" color="#DC2626" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-end border-b border-line px-4 py-2.5">
          <CsvButton filename="agents" rows={agentRows} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-3 py-3 font-medium">Agent</th>
                <th className="px-3 py-3 font-medium">Direction</th>
                <th className="px-3 py-3 font-medium">Ports</th>
                <th className="px-3 py-3 font-medium">Commission</th>
                <th className="px-3 py-3 font-medium">SOA balance</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setSelectedId(a.id === selectedId ? null : a.id)}
                  className={`cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60 ${
                    selectedId === a.id ? 'bg-primary/5' : ''
                  }`}
                >
                  <td className="px-5 py-3 font-mono text-xs font-medium text-link">{a.code}</td>
                  <td className="px-3 py-3">
                    <p className="text-[13px] font-medium text-heading">{a.displayName || a.legalName}</p>
                    <p className="text-[11px] text-muted">{a.agentTypes.join(' · ')}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-body">{a.direction}</td>
                  <td className="px-3 py-3 text-xs text-body">{a.portsCovered.join(', ')}</td>
                  <td className="px-3 py-3 font-mono text-xs text-body">
                    {a.commissionType === '% of freight' ? `${a.commissionValue}%` : a.commissionType === 'Flat fee per shipment' ? `$${a.commissionValue}/shpt` : 'Tiered'}
                    {a.pendingCommissionChange && (
                      <span className="ml-1.5 rounded-badge bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-semibold text-[#B45309]">change pending</span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">
                    <span className={a.soaBalanceUsd === 0 ? 'text-primary' : 'text-body'}>
                      {a.soaBalanceUsd === 0 ? 'Reconciled' : `$${Math.abs(a.soaBalanceUsd).toLocaleString()} ${a.soaBalanceUsd > 0 ? 'due to agent' : 'due to us'}`}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <StatusChip status={STATUS_CHIP[a.status]} />
                    <span className="ml-2 text-[11px] text-muted">{a.status}</span>
                    {a.performanceFlagged && (
                      <span className="ml-1.5 rounded-badge bg-[#FEE2E2] px-1.5 py-0.5 text-[10px] font-semibold text-[#DC2626]">perf flag</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && (
        <div ref={detailRef} className="scroll-mt-4">
          <AgentDetail agent={selected} />
        </div>
      )}
    </div>
  )
}
