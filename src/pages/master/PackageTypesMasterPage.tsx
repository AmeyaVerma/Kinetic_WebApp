import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { TextInput } from '../../components/ui/Field'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabaseClient'
import type { PackageTypeRecord } from '../../lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPackageType(row: any): PackageTypeRecord {
  return { id: row.id, code: row.code, createdAt: row.created_at }
}

/** Master Data → Miscellaneous → Package types. The only place a package
    type code can be added or removed — booking flows read from here, never
    free text/inline-add. Add/delete are Admin-only (also enforced by RLS). */
export function PackageTypesMasterPage() {
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? user?.role) === 'admin'

  const [types, setTypes] = useState<PackageTypeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [newCode, setNewCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    supabase
      .from('package_types')
      .select('*')
      .order('code', { ascending: true })
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (data) setTypes((data as any[]).map(rowToPackageType))
        setLoading(false)
      })
  }

  useEffect(load, [])

  const handleAdd = async () => {
    const code = newCode.trim().toUpperCase()
    if (!code) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('package_types').insert({ code })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setNewCode('')
    load()
  }

  const handleDelete = async (id: string) => {
    setError(null)
    const { error: err } = await supabase.from('package_types').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    setTypes((t) => t.filter((x) => x.id !== id))
  }

  const q = query.trim().toLowerCase()
  const filtered = q ? types.filter((t) => t.code.toLowerCase().includes(q)) : types

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/misc" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Miscellaneous
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Package types</h1>
        <p className="mt-1 text-sm text-muted">
          Package type codes used across NVOCC bookings.
          {!isAdmin && ' Only an Admin can add or remove codes.'}
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="w-full max-w-xs">
            <TextInput placeholder="Search code…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {isAdmin && (
            <div className="flex items-end gap-2">
              <div className="w-40">
                <TextInput
                  placeholder="New code, e.g. BAG"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                />
              </div>
              <Button size="sm" onClick={handleAdd} disabled={saving || !newCode.trim()}>
                <Plus size={13} /> {saving ? 'Adding…' : 'Add'}
              </Button>
            </div>
          )}
        </div>
        {error && <p className="border-b border-line px-4 py-2 text-sm text-[#DC2626]">{error}</p>}
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 bg-surface px-4 py-2.5">
              <span className="font-mono text-sm text-heading">{t.code}</span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  title="Remove"
                  className="text-muted hover:text-accent-coral"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted">
            {loading ? 'Loading…' : 'No package types yet.'}
          </p>
        )}
        <div className="border-t border-line px-4 py-2.5 text-xs text-muted">{filtered.length} code{filtered.length === 1 ? '' : 's'}</div>
      </Card>
    </div>
  )
}
