import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Container as ContainerIcon, Snowflake, Wrench } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { StatKpi } from '../../components/ui/StatKpi'
import { CsvButton } from '../../components/ui/CsvButton'
import { TextInput } from '../../components/ui/Field'
import { useDataStore } from '../../store/useDataStore'
import type { ContainerRecord } from '../../lib/types'

/** Master Data → Containers ("Container" subfield only — Pass 1). CMC and
    Container Items/Damage Codes are separate subfields, not yet built;
    see the detail page's placeholder tabs. */
export function ContainersMasterPage() {
  const { containers, fetchContainers } = useDataStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchContainers()
  }, [fetchContainers])

  const kpis = useMemo(
    () => ({
      total: containers.length,
      reefers: containers.filter((c) => c.containerType === 'REF').length,
      underRepair: containers.filter((c) => (c.status ?? '').toUpperCase().includes('REPAIR')).length,
    }),
    [containers],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return containers
    return containers.filter((c) =>
      [c.containerNo, c.status, c.port, c.depot, c.size, c.containerType, c.hireStatus]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    )
  }, [containers, query])

  const csvRows = useMemo(
    () =>
      filtered.map((c) => ({
        'Container No': c.containerNo,
        Status: c.status ?? '',
        Port: c.port ?? '',
        Depot: c.depot ?? '',
        Size: c.size ?? '',
        Type: c.containerType ?? '',
        'ISO Type': c.isoType ?? '',
        'Max Gross Wt': c.maxGrossWt ?? '',
        'Tare Weight': c.tareWeight ?? '',
        Capacity: c.capacity ?? '',
        'Hire Status': c.hireStatus ?? '',
        Remarks: c.remarks ?? '',
        'Free Days': c.freeDays,
      })),
    [filtered],
  )

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to="/master/containers" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
            <ArrowLeft size={13} /> Containers
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Container</h1>
          <p className="mt-1 text-sm text-muted">The physical container fleet Kinetic owns/operates.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatKpi label="Total Containers" value={kpis.total} icon={<ContainerIcon size={17} />} tint="#ECFDF5" color="#10B981" />
        <StatKpi label="Reefers (40 FT)" value={kpis.reefers} icon={<Snowflake size={17} />} tint="#EFF6FF" color="#3B82F6" />
        <StatKpi label="Under Repair" value={kpis.underRepair} icon={<Wrench size={17} />} tint="#FEF3C7" color="#B45309" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="w-full max-w-xs">
            <TextInput
              placeholder="Search container no, status, port, depot…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <CsvButton filename="containers" rows={csvRows} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Container No</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Port / Depot</th>
                <th className="px-3 py-3 font-medium">Size / Type</th>
                <th className="px-5 py-3 font-medium">Hire Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <ContainerRow key={c.id} container={c} onClick={() => navigate(`/master/containers/fleet/${c.containerNo}`)} />
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted">
              {containers.length === 0 ? 'Loading…' : 'No containers match that search.'}
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}

function ContainerRow({ container: c, onClick }: { container: ContainerRecord; onClick: () => void }) {
  return (
    <tr onClick={onClick} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60">
      <td className="px-5 py-3 font-mono text-xs font-medium text-link">{c.containerNo}</td>
      <td className="px-3 py-3 text-xs text-body">{c.status || <span className="text-muted">—</span>}</td>
      <td className="px-3 py-3 text-xs text-body">
        {[c.port, c.depot].filter(Boolean).join(' · ') || <span className="text-muted">—</span>}
      </td>
      <td className="px-3 py-3 text-xs text-body">
        {c.size} {c.containerType}
      </td>
      <td className="px-5 py-3 text-xs text-body">{c.hireStatus || <span className="text-muted">—</span>}</td>
    </tr>
  )
}
