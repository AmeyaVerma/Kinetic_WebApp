import { useState } from 'react'
import { Card } from '../components/ui/Card'
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

      <Card className="overflow-hidden">
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

      {selected && <AgentDetail agent={selected} />}
    </div>
  )
}
