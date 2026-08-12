import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Warehouse } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { TextInput } from '../../components/ui/Field'
import { supabase } from '../../lib/supabaseClient'
import type { IcdRecord } from '../../lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToIcd(row: any): IcdRecord {
  return { id: row.id, name: row.name, code: row.code, locode: row.locode, city: row.city, country: row.country, createdAt: row.created_at }
}

/** Master Data → Ports/ICDs/Terminals → ICDs. The only place an ICD can be
    added or edited. */
export function IcdsMasterPage() {
  const navigate = useNavigate()
  const [icds, setIcds] = useState<IcdRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    supabase
      .from('icds')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (data) setIcds((data as any[]).map(rowToIcd))
        setLoading(false)
      })
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? icds.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.code ?? '').toLowerCase().includes(q) ||
          (i.locode ?? '').toLowerCase().includes(q),
      )
    : icds

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/ports" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Ports / ICDs / Terminals
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">ICDs</h1>
            <p className="mt-1 text-sm text-muted">Inland Container Depots.</p>
          </div>
          <Link to="/master/ports/icds/new">
            <Button size="sm"><Plus size={13} /> Add ICD</Button>
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="w-full max-w-xs">
            <TextInput placeholder="Search ICD name, code, or LOCODE…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <p className="text-xs text-muted">{filtered.length} ICD{filtered.length === 1 ? '' : 's'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Code</th>
                <th className="px-3 py-3 font-medium">LOCODE</th>
                <th className="px-3 py-3 font-medium">City</th>
                <th className="px-5 py-3 font-medium">Country</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => navigate(`/master/ports/icds/${i.id}`)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60"
                >
                  <td className="px-5 py-3 text-xs font-medium text-link">
                    <span className="inline-flex items-center gap-1.5">
                      <Warehouse size={12} className="shrink-0 text-muted" /> {i.name}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-body">{i.code || <span className="text-muted">—</span>}</td>
                  <td className="px-3 py-3 font-mono text-xs text-body">{i.locode || <span className="text-muted">—</span>}</td>
                  <td className="px-3 py-3 text-xs text-body">{i.city || <span className="text-muted">—</span>}</td>
                  <td className="px-5 py-3 text-xs text-body">{i.country || <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted">
              {loading ? 'Loading…' : 'No ICDs yet — add one to get started.'}
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
