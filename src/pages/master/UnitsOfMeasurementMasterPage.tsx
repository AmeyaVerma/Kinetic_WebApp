import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, Select, TextInput } from '../../components/ui/Field'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabaseClient'
import { UOM_CATEGORIES } from '../../lib/types'
import type { UnitOfMeasurementRecord } from '../../lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToUom(row: any): UnitOfMeasurementRecord {
  return { id: row.id, code: row.code, name: row.name, category: row.category, createdAt: row.created_at }
}

/** Master Data → Miscellaneous → Units of Measurement. The only place a
    UOM code can be added or removed — cargo/charge/rate entry reads from
    here, never free text. Add/delete are Admin-only (also enforced by
    RLS). */
export function UnitsOfMeasurementMasterPage() {
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? user?.role) === 'admin'

  const [units, setUnits] = useState<UnitOfMeasurementRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const [adding, setAdding] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState<string>(UOM_CATEGORIES[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    supabase
      .from('units_of_measurement')
      .select('*')
      .order('category', { ascending: true })
      .order('code', { ascending: true })
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (data) setUnits((data as any[]).map(rowToUom))
        setLoading(false)
      })
  }

  useEffect(load, [])

  const handleAdd = async () => {
    const code = newCode.trim().toUpperCase()
    const name = newName.trim()
    if (!code || !name) {
      setError('Code and name are both required.')
      return
    }
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('units_of_measurement')
      .insert({ code, name, category: newCategory || null })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setNewCode('')
    setNewName('')
    setAdding(false)
    load()
  }

  const handleDelete = async (id: string) => {
    setError(null)
    const { error: err } = await supabase.from('units_of_measurement').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    setUnits((u) => u.filter((x) => x.id !== id))
  }

  const q = query.trim().toLowerCase()
  const filtered = units.filter(
    (u) =>
      (!categoryFilter || u.category === categoryFilter) &&
      (!q || u.code.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)),
  )

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/misc" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Miscellaneous
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Units of Measurement</h1>
            <p className="mt-1 text-sm text-muted">
              UOM codes used for cargo, charges and rates.
              {!isAdmin && ' Only an Admin can add or remove codes.'}
            </p>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setAdding((v) => !v)}>
              <Plus size={13} /> Add unit
            </Button>
          )}
        </div>
      </div>

      {isAdmin && adding && (
        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-28">
              <Field label="Code *">
                <TextInput value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="e.g. CBM" />
              </Field>
            </div>
            <div className="w-64">
              <Field label="Name *">
                <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Cubic Metres" />
              </Field>
            </div>
            <div className="w-44">
              <Field label="Category">
                <Select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                  {UOM_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? 'Saving…' : 'Save unit'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
          {error && <p className="mt-2 text-sm text-[#DC2626]">{error}</p>}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full max-w-xs">
              <TextInput placeholder="Search code or name…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="w-44">
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">All categories</option>
                {UOM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted">{filtered.length} unit{filtered.length === 1 ? '' : 's'}</p>
        </div>
        {error && !adding && <p className="border-b border-line px-4 py-2 text-sm text-[#DC2626]">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Category</th>
                {isAdmin && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-mono text-xs font-medium text-heading">{u.code}</td>
                  <td className="px-3 py-3 text-xs text-body">{u.name}</td>
                  <td className="px-3 py-3 text-xs text-body">{u.category || <span className="text-muted">—</span>}</td>
                  {isAdmin && (
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(u.id)}
                        title="Remove"
                        className="text-muted hover:text-accent-coral"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted">
              {loading ? 'Loading…' : 'No units match this search.'}
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
