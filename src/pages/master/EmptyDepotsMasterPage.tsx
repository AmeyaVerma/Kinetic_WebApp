import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Warehouse } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { TextInput } from '../../components/ui/Field'
import { supabase } from '../../lib/supabaseClient'
import type { EmptyDepotRecord } from '../../lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEmptyDepot(row: any): EmptyDepotRecord {
  return { id: row.id, name: row.name, code: row.code, city: row.city, country: row.country, createdAt: row.created_at }
}

/** Master Data → Containers → Empty Depots. The only place an empty
    container yard can be added or edited. */
export function EmptyDepotsMasterPage() {
  const navigate = useNavigate()
  const [depots, setDepots] = useState<EmptyDepotRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    supabase
      .from('empty_depots')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (data) setDepots((data as any[]).map(rowToEmptyDepot))
        setLoading(false)
      })
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? depots.filter((d) => d.name.toLowerCase().includes(q) || (d.code ?? '').toLowerCase().includes(q))
    : depots

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/containers" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Containers
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Empty Depots</h1>
            <p className="mt-1 text-sm text-muted">Empty container return / pickup yards.</p>
          </div>
          <Link to="/master/containers/empty-depots/new">
            <Button size="sm"><Plus size={13} /> Add Empty Depot</Button>
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="w-full max-w-xs">
            <TextInput placeholder="Search depot name or code…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <p className="text-xs text-muted">{filtered.length} depot{filtered.length === 1 ? '' : 's'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Code</th>
                <th className="px-3 py-3 font-medium">City</th>
                <th className="px-5 py-3 font-medium">Country</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => navigate(`/master/containers/empty-depots/${d.id}`)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60"
                >
                  <td className="px-5 py-3 text-xs font-medium text-link">
                    <span className="inline-flex items-center gap-1.5">
                      <Warehouse size={12} className="shrink-0 text-muted" /> {d.name}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-body">{d.code || <span className="text-muted">—</span>}</td>
                  <td className="px-3 py-3 text-xs text-body">{d.city || <span className="text-muted">—</span>}</td>
                  <td className="px-5 py-3 text-xs text-body">{d.country || <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted">
              {loading ? 'Loading…' : 'No empty depots yet — add one to get started.'}
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
