import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Database, ShieldCheck, Ban, Plus } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { StatKpi } from '../../components/ui/StatKpi'
import { CsvButton } from '../../components/ui/CsvButton'
import { Button } from '../../components/ui/Button'
import { TextInput } from '../../components/ui/Field'
import { useDataStore } from '../../store/useDataStore'
import type { Party } from '../../lib/types'

/** Master Data → Parties (Pass 1). Read-only browse/search for now; the
    add/edit form lands once the input format is defined (see
    kinetic-erp-project memory — Masters are being built one at a time:
    data in → add-format → where autofill surfaces). */
export function PartiesMasterPage() {
  const { parties, fetchParties } = useDataStore()
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchParties()
  }, [fetchParties])

  const kpis = useMemo(
    () => ({
      total: parties.length,
      withTaxId: parties.filter((p) => p.gstin || p.pan).length,
      control: parties.filter((p) => p.partyType === 'Control').length,
    }),
    [parties],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return parties
    return parties.filter((p) =>
      [p.legalName, p.code, p.gstin, p.pan, p.iec, p.city, p.country, p.accountingCode]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    )
  }, [parties, query])

  const csvRows = useMemo(
    () =>
      filtered.map((p) => ({
        Code: p.code,
        Name: p.legalName,
        Type: p.partyType,
        City: p.city ?? '',
        State: p.state ?? '',
        Country: p.country ?? '',
        PAN: p.pan ?? '',
        GSTIN: p.gstin ?? '',
        IEC: p.iec ?? '',
        Email: p.email ?? '',
        Phone: p.phone ?? '',
        'Sales Person': p.salesPerson ?? '',
        'Accounting Code': p.accountingCode ?? '',
        Status: p.status,
      })),
    [filtered],
  )

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to="/master" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
            <ArrowLeft size={13} /> Master Data
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Parties</h1>
          <p className="mt-1 text-sm text-muted">
            Companies, individuals and BL control entries — the shared identity every module (NVOCC, FF, MNR,
            Customers, Agents) autofills from.
          </p>
        </div>
        <Link to="/master/parties/new">
          <Button size="sm"><Plus size={13} /> Add Party</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatKpi label="Total Parties" value={kpis.total} icon={<Database size={17} />} tint="#ECFDF5" color="#10B981" />
        <StatKpi label="With PAN / GSTIN" value={kpis.withTaxId} icon={<ShieldCheck size={17} />} tint="#EFF6FF" color="#3B82F6" />
        <StatKpi label="BL control entries" value={kpis.control} icon={<Ban size={17} />} tint="#FEF3C7" color="#B45309" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="w-full max-w-xs">
            <TextInput
              placeholder="Search name, code, GSTIN, PAN, city…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <CsvButton filename="parties" rows={csvRows} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-3 py-3 font-medium">Party</th>
                <th className="px-3 py-3 font-medium">City / Country</th>
                <th className="px-3 py-3 font-medium">PAN</th>
                <th className="px-3 py-3 font-medium">GSTIN</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <PartyRow
                  key={p.id}
                  party={p}
                  expanded={expandedId === p.id}
                  onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                />
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted">
              {parties.length === 0 ? 'Loading…' : 'No parties match that search.'}
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}

function PartyRow({ party: p, expanded, onToggle }: { party: Party; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60 ${expanded ? 'bg-primary/5' : ''}`}
      >
        <td className="px-5 py-3 font-mono text-xs font-medium text-link">{p.code}</td>
        <td className="px-3 py-3">
          <p className="text-[13px] font-medium text-heading">{p.legalName}</p>
          <p className="text-[11px] text-muted">
            {p.partyType}
            {p.isSelf && ' · Kinetic (self)'}
            {p.roles.length > 0 && ` · ${p.roles.join(', ')}`}
          </p>
        </td>
        <td className="px-3 py-3 text-xs text-body">
          {[p.city, p.country].filter(Boolean).join(', ') || <span className="text-muted">—</span>}
        </td>
        <td className="px-3 py-3 font-mono text-xs text-body">{p.pan || <span className="text-muted">—</span>}</td>
        <td className="px-3 py-3 font-mono text-xs text-body">{p.gstin || <span className="text-muted">—</span>}</td>
        <td className="px-5 py-3">
          <span
            className={`rounded-badge px-1.5 py-0.5 text-[10px] font-semibold ${
              p.status === 'Active' ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-surface-2 text-muted'
            }`}
          >
            {p.status}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-line bg-surface-2/40 last:border-0">
          <td colSpan={6} className="px-5 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DetailField label="IEC" value={p.iec} />
              <DetailField label="Email" value={p.email} />
              <DetailField label="Phone" value={p.phone} />
              <DetailField label="Sales person" value={p.salesPerson} />
              <DetailField label="Accounting code" value={p.accountingCode} />
              <DetailField label="Legacy party code" value={p.partyCodeLegacy} />
              <DetailField label="State" value={p.state} />
              <DetailField label="Roles" value={p.roles.length > 0 ? p.roles.join(', ') : null} />
            </div>
            {p.addressRaw && (
              <div className="mt-3">
                <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Address (as imported)</p>
                <p className="mt-1 text-xs text-body">{p.addressRaw}</p>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-[13px] text-heading">{value || <span className="text-muted">—</span>}</p>
    </div>
  )
}
