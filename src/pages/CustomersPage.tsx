import { useState } from 'react'
import { Card } from '../components/ui/Card'
import { StatusChip } from '../components/ui/StatusChip'
import { CustomerDetail } from '../components/customers/CustomerDetail'
import { useDataStore } from '../store/useDataStore'
import type { ChipStatus, CustomerStatus } from '../lib/types'

const STATUS_CHIP: Record<CustomerStatus, ChipStatus> = {
  Prospect: 'Draft',
  Active: 'Delivered',
  'On Hold': 'Pending',
  Inactive: 'Draft',
  Blacklisted: 'Cancelled',
}

export function CustomersPage() {
  const { customers } = useDataStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = customers.find((c) => c.id === selectedId) ?? null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Customer Management</h1>
        <p className="mt-1 text-sm text-muted">
          Admin-side configuration for every customer — company details, commercial terms, credit, portal access,
          notifications, compliance, and the full lifecycle. Settings here drive bookings, invoicing and the portal.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Industry</th>
                <th className="px-3 py-3 font-medium">Credit limit</th>
                <th className="px-3 py-3 font-medium">Portal</th>
                <th className="px-3 py-3 font-medium">Sales owner</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                  className={`cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60 ${
                    selectedId === c.id ? 'bg-primary/5' : ''
                  }`}
                >
                  <td className="px-5 py-3 font-mono text-xs font-medium text-link">{c.code}</td>
                  <td className="px-3 py-3">
                    <p className="text-[13px] font-medium text-heading">{c.displayName || c.legalName}</p>
                    <p className="text-[11px] text-muted">{c.roles.join(' · ')}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-body">{c.industry}</td>
                  <td className="px-3 py-3 font-mono text-xs text-body">
                    {c.cashInAdvanceOnly ? 'Cash in advance' : `${c.creditCurrency} ${c.creditLimit.toLocaleString()}`}
                    {c.pendingCreditRequest && (
                      <span className="ml-1.5 rounded-badge bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-semibold text-[#B45309]">
                        ${c.pendingCreditRequest.toLocaleString()} pending
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {c.portalEnabled ? (
                      <span className="font-medium text-primary">Enabled · {c.portalUsers.length} user(s)</span>
                    ) : (
                      <span className="text-muted">Disabled</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-body">{c.salesOwner}</td>
                  <td className="px-5 py-3">
                    <StatusChip status={STATUS_CHIP[c.status]} />
                    <span className="ml-2 text-[11px] text-muted">{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && <CustomerDetail customer={selected} />}
    </div>
  )
}
