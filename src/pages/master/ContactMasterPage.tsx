import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { TextInput } from '../../components/ui/Field'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabaseClient'

/**
 * Shared master screen for Surveyors and CHAs.
 *
 * The two tables carry the same shape -- a name plus contact and address
 * lines -- and both are printed as an address block on a document rather than
 * being selected for their own sake. Giving them one screen keeps the two in
 * step; if they diverge later (a surveyor licence number, say) this splits
 * cleanly because the column list is already a prop.
 *
 * Add/delete are Admin-only here AND in RLS via can_write_masters(), so a
 * non-admin who calls the API directly is refused by the database too.
 */

export type ContactField = {
  key: string
  label: string
  placeholder?: string
  /** Shown in the list row under the name. */
  inSummary?: boolean
}

export type ContactRecord = {
  id: string
  name: string
  [key: string]: string | null | undefined
}

export function ContactMasterPage({
  table,
  title,
  description,
  fields,
  backTo = '/master',
}: {
  table: 'surveyors' | 'chas'
  title: string
  description: string
  fields: ContactField[]
  backTo?: string
}) {
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? user?.role) === 'admin'

  const [rows, setRows] = useState<ContactRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    supabase
      .from(table)
      .select('*')
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (data) setRows(data as unknown as ContactRecord[])
        setLoading(false)
      })
  }

  useEffect(load, [table])

  const handleAdd = async () => {
    const name = (draft.name ?? '').trim()
    if (!name) return
    setSaving(true)
    setError(null)
    // Only send keys the user actually filled; empty strings would overwrite
    // nullable columns with '' and make "is this set?" checks unreliable.
    const payload: Record<string, string> = { name }
    for (const f of fields) {
      const v = (draft[f.key] ?? '').trim()
      if (f.key !== 'name' && v) payload[f.key] = v
    }
    const { error: err } = await supabase.from(table).insert(payload)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setDraft({})
    setAdding(false)
    load()
  }

  const handleDelete = async (id: string) => {
    setError(null)
    const { error: err } = await supabase.from(table).delete().eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    setRows((r) => r.filter((x) => x.id !== id))
  }

  const q = query.trim().toLowerCase()
  const visible = q
    ? rows.filter((r) =>
        fields.some((f) => String(r[f.key] ?? '').toLowerCase().includes(q)),
      )
    : rows

  const summaryFields = fields.filter((f) => f.inSummary && f.key !== 'name')

  return (
    <div className="space-y-4">
      <div>
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
        >
          <ArrowLeft size={14} /> Master Data
        </Link>
        <h1 className="mt-1 font-display text-xl">{title}</h1>
        <p className="text-sm text-muted">{description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TextInput
          placeholder={`Search ${title.toLowerCase()}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <span className="font-mono text-xs text-muted">
          {loading ? 'Loading…' : `${visible.length} of ${rows.length}`}
        </span>
        {isAdmin && !adding && (
          <Button size="sm" onClick={() => setAdding(true)} className="ml-auto">
            <Plus size={14} /> Add
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {adding && (
        <Card className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.key} className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-wide text-muted">
                  {f.label}
                  {f.key === 'name' && ' *'}
                </span>
                <TextInput
                  placeholder={f.placeholder}
                  value={draft[f.key] ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={saving || !(draft.name ?? '').trim()}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false)
                setDraft({})
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <Card className="divide-y divide-line">
        {!loading && visible.length === 0 && (
          <p className="p-4 text-sm text-muted">
            {rows.length === 0
              ? `No ${title.toLowerCase()} yet.`
              : 'Nothing matches that search.'}
          </p>
        )}
        {visible.map((r) => (
          <div key={r.id} className="flex items-start gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.name}</p>
              {summaryFields.length > 0 && (
                <p className="truncate text-xs text-muted">
                  {summaryFields
                    .map((f) => r[f.key])
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={() => handleDelete(r.id)}
                className="text-muted hover:text-red-600"
                aria-label={`Delete ${r.name}`}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </Card>
    </div>
  )
}
