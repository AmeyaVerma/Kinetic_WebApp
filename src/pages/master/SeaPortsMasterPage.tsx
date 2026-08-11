import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Anchor } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { TextInput } from '../../components/ui/Field'
import { supabase } from '../../lib/supabaseClient'
import type { SeaPortRecord } from '../../lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSeaPort(row: any): SeaPortRecord {
  return { id: row.id, name: row.name, code: row.code, country: row.country, createdAt: row.created_at }
}

/** Master Data → Ports/ICDs/Terminals → Sea Ports with Terminals. The only
    place a sea port or its terminals can be added/edited — booking flows
    (Vessel section's Terminal field) read from here, never free text. */
export function SeaPortsMasterPage() {
  const navigate = useNavigate()
  const [ports, setPorts] = useState<SeaPortRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    supabase
      .from('sea_ports')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (data) setPorts((data as any[]).map(rowToSeaPort))
        setLoading(false)
      })
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? ports.filter((p) => p.name.toLowerCase().includes(q) || (p.code ?? '').toLowerCase().includes(q))
    : ports

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/ports" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Ports / ICDs / Terminals
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Sea Ports with Terminals</h1>
            <p className="mt-1 text-sm text-muted">
              Add a port, then its terminals — bookings pick a terminal from here, scoped to the port.
            </p>
          </div>
          <Link to="/master/ports/sea-ports/new">
            <Button size="sm"><Plus size={13} /> Add Sea Port</Button>
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="w-full max-w-xs">
            <TextInput placeholder="Search port name or code…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <p className="text-xs text-muted">{filtered.length} port{filtered.length === 1 ? '' : 's'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Code</th>
                <th className="px-5 py-3 font-medium">Country</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/master/ports/sea-ports/${p.id}`)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60"
                >
                  <td className="px-5 py-3 text-xs font-medium text-link">
                    <span className="inline-flex items-center gap-1.5">
                      <Anchor size={12} className="shrink-0 text-muted" /> {p.name}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-body">{p.code || <span className="text-muted">—</span>}</td>
                  <td className="px-5 py-3 text-xs text-body">{p.country || <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted">
              {loading ? 'Loading…' : 'No sea ports yet — add one to get started.'}
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
