import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, Select, TextInput } from '../../components/ui/Field'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabaseClient'
import type { CurrencyRecord } from '../../lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCurrency(row: any): CurrencyRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    country: row.country,
    decimals: row.decimals,
    createdAt: row.created_at,
  }
}

/** Master Data → Miscellaneous → Currencies. The only place a currency can
    be added or removed — invoicing and charge lines read from here.
    Add/delete are Admin-only (also enforced by RLS). */
export function CurrenciesMasterPage() {
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? user?.role) === 'admin'

  const [currencies, setCurrencies] = useState<CurrencyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const [adding, setAdding] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newSymbol, setNewSymbol] = useState('')
  const [newCountry, setNewCountry] = useState('')
  const [newDecimals, setNewDecimals] = useState('2')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    supabase
      .from('currencies')
      .select('*')
      .order('code', { ascending: true })
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (data) setCurrencies((data as any[]).map(rowToCurrency))
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
    const { error: err } = await supabase.from('currencies').insert({
      code,
      name,
      symbol: newSymbol.trim() || null,
      country: newCountry.trim() || null,
      decimals: Number(newDecimals),
    })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setNewCode('')
    setNewName('')
    setNewSymbol('')
    setNewCountry('')
    setNewDecimals('2')
    setAdding(false)
    load()
  }

  const handleDelete = async (id: string) => {
    setError(null)
    const { error: err } = await supabase.from('currencies').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    setCurrencies((c) => c.filter((x) => x.id !== id))
  }

  const q = query.trim().toLowerCase()
  const filtered = q
    ? currencies.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.country ?? '').toLowerCase().includes(q),
      )
    : currencies

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/misc" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Miscellaneous
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Currencies</h1>
            <p className="mt-1 text-sm text-muted">
              Currencies used for invoicing, charges and rates.
              {!isAdmin && ' Only an Admin can add or remove currencies.'}
            </p>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setAdding((v) => !v)}>
              <Plus size={13} /> Add currency
            </Button>
          )}
        </div>
      </div>

      {isAdmin && adding && (
        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-24">
              <Field label="Code *">
                <TextInput value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="USD" />
              </Field>
            </div>
            <div className="w-56">
              <Field label="Name *">
                <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="US Dollar" />
              </Field>
            </div>
            <div className="w-24">
              <Field label="Symbol">
                <TextInput value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} placeholder="$" />
              </Field>
            </div>
            <div className="w-48">
              <Field label="Country">
                <TextInput value={newCountry} onChange={(e) => setNewCountry(e.target.value)} placeholder="United States" />
              </Field>
            </div>
            <div className="w-32">
              <Field label="Decimals">
                <Select value={newDecimals} onChange={(e) => setNewDecimals(e.target.value)}>
                  <option value="0">0</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </Select>
              </Field>
            </div>
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? 'Saving…' : 'Save currency'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
          {error && <p className="mt-2 text-sm text-[#DC2626]">{error}</p>}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="w-full max-w-xs">
            <TextInput
              placeholder="Search code, name or country…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted">{filtered.length} currenc{filtered.length === 1 ? 'y' : 'ies'}</p>
        </div>
        {error && !adding && <p className="border-b border-line px-4 py-2 text-sm text-[#DC2626]">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Symbol</th>
                <th className="px-3 py-3 font-medium">Country</th>
                <th className="px-3 py-3 font-medium">Decimals</th>
                {isAdmin && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-mono text-xs font-medium text-heading">{c.code}</td>
                  <td className="px-3 py-3 text-xs text-body">{c.name}</td>
                  <td className="px-3 py-3 text-xs text-body">{c.symbol || <span className="text-muted">—</span>}</td>
                  <td className="px-3 py-3 text-xs text-body">{c.country || <span className="text-muted">—</span>}</td>
                  <td className="px-3 py-3 font-mono text-xs text-body">{c.decimals}</td>
                  {isAdmin && (
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
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
              {loading ? 'Loading…' : 'No currencies match this search.'}
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
