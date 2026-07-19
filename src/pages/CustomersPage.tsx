import { useEffect, useMemo, useRef, useState } from 'react'
import { Users2, CheckCircle2, Globe2, AlertTriangle, ShieldAlert } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { StatKpi } from '../components/ui/StatKpi'
import { CsvButton } from '../components/ui/CsvButton'
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
  const detailRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedId && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedId])

  const kpis = useMemo(() => ({
    total: customers.length,
    active: customers.filter((c) => c.status === 'Active').length,
    portalEnabled: customers.filter((c) => c.portalEnabled).length,
    pendingCredit: customers.filter((c) => c.pendingCreditRequest != null).length,
    blacklisted: customers.filter((c) => c.status === 'Blacklisted').length,
  }), [customers])

  const customerRows = useMemo(
    () =>
      customers.map((c) => ({
        Code: c.code,
        Name: c.displayName || c.legalName,
        Industry: c.industry,
        'Credit Limit': c.cashInAdvanceOnly ? 'Cash in advance' : `${c.creditCurrency} ${c.creditLimit}`,
        'Portal Enabled': c.portalEnabled ? 'Yes' : 'No',
        'Sales Owner': c.salesOwner,
        Status: c.status,
      })),
    [customers],
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Customer Portal</h1>
        <p className="mt-1 text-sm text-muted">
          Customer management — company details, commercial terms, credit, portal access, notifications,
          compliance, and the full lifecycle. Settings here drive bookings, invoicing and what each customer's
          portal users can see and do.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatKpi label="Total Customers" value={kpis.total} icon={<Users2 size={17} />} tint="#ECFDF5" color="#10B981" />
        <StatKpi label="Active" value={kpis.active} icon={<CheckCircle2 size={17} />} tint="#EFF6FF" color="#3B82F6" />
        <StatKpi label="Portal Enabled" value={kpis.portalEnabled} icon={<Globe2 size={17} />} tint="#F5F3FF" color="#8B5CF6" />
        <StatKpi label="Pending Credit Requests" value={kpis.pendingCredit} icon={<AlertTriangle size={17} />} tint="#FEF3C7" color="#B45309" />
        <StatKpi label="Blacklisted" value={kpis.blacklisted} icon={<ShieldAlert size={17} />} tint="#FEE2E2" color="#DC2626" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-end border-b border-line px-4 py-2.5">
          <CsvButton filename="customers" rows={customerRows} />
        </div>
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

      {selected && (
        <div ref={detailRef} className="scroll-mt-4">
          <CustomerDetail customer={selected} />
        </div>
      )}
    </div>
  )
}
