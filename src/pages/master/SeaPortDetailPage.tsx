import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, FieldPill, TextInput } from '../../components/ui/Field'
import { EditableTextPill } from '../../components/ui/EditableTextPill'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabaseClient'
import type { SeaPortRecord, SeaPortTerminalRecord } from '../../lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSeaPort(row: any): SeaPortRecord {
  return { id: row.id, name: row.name, code: row.code, country: row.country, createdAt: row.created_at }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTerminal(row: any): SeaPortTerminalRecord {
  return { id: row.id, portId: row.port_id, name: row.name, createdAt: row.created_at }
}

/** Master Data → Ports/ICDs/Terminals → Sea Ports detail. Fetched live
    from Supabase by id, along with its terminals (sea_port_terminals) —
    the same table booking's Vessel section Terminal dropdown reads from. */
export function SeaPortDetailPage() {
  const { id } = useParams<{ id: string }>()
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? user?.role) === 'admin'

  const [port, setPort] = useState<SeaPortRecord | null>(null)
  const [terminals, setTerminals] = useState<SeaPortTerminalRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [showAddTerminal, setShowAddTerminal] = useState(false)
  const [terminalName, setTerminalName] = useState('')
  const [savingTerminal, setSavingTerminal] = useState(false)
  const [terminalError, setTerminalError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      supabase.from('sea_ports').select('*').eq('id', id).single(),
      supabase.from('sea_port_terminals').select('*').eq('port_id', id).order('name', { ascending: true }),
    ]).then(([pRes, tRes]) => {
      if (pRes.data) setPort(rowToSeaPort(pRes.data))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (tRes.data) setTerminals((tRes.data as any[]).map(rowToTerminal))
      setLoading(false)
    })
  }, [id])

  function updateField(field: keyof SeaPortRecord, value: string) {
    if (!port) return
    const column = String(field).replace(/([A-Z])/g, '_$1').toLowerCase()
    const parsed = value === '' ? null : value
    supabase
      .from('sea_ports')
      .update({ [column]: parsed })
      .eq('id', port.id)
      .then(({ error }) => {
        if (error) console.error('updateSeaPort failed', error)
      })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setPort((p) => (p ? ({ ...p, [field]: parsed } as any) : p))
  }

  async function handleAddTerminal() {
    if (!port) return
    if (!terminalName.trim()) {
      setTerminalError('Terminal name is required.')
      return
    }
    setSavingTerminal(true)
    setTerminalError(null)
    const { data, error } = await supabase
      .from('sea_port_terminals')
      .insert({ port_id: port.id, name: terminalName.trim() })
      .select()
      .single()
    setSavingTerminal(false)
    if (error || !data) {
      setTerminalError(error?.message ?? 'Could not add terminal.')
      return
    }
    setTerminals((t) => [...t, rowToTerminal(data)].sort((a, b) => a.name.localeCompare(b.name)))
    setTerminalName('')
    setShowAddTerminal(false)
  }

  const text = (label: string, field: keyof SeaPortRecord, value: string | null) =>
    isAdmin ? (
      <EditableTextPill label={label} value={value ?? ''} onChange={(v) => updateField(field, v)} />
    ) : (
      <FieldPill label={label} value={value ?? ''} />
    )

  if (loading || !port) {
    return (
      <div className="space-y-5">
        <Link to="/master/ports/sea-ports" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Sea Ports with Terminals
        </Link>
        <Card className="flex h-40 items-center justify-center">
          <p className="text-sm text-muted">{loading ? 'Loading…' : 'Sea port not found.'}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/ports/sea-ports" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Sea Ports with Terminals
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{port.name}</h1>
        <p className="mt-1 font-mono text-xs text-muted">{[port.code, port.country].filter(Boolean).join(' · ') || '—'}</p>
        {!isAdmin && (
          <p className="mt-1 text-xs text-muted">Fields are read-only here — only an Admin can edit port details.</p>
        )}
      </div>

      <Card className="p-5">
        <div className="space-y-5">
          <section>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted">Identity</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {text('Code', 'code', port.code)}
              {text('Country', 'country', port.country)}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Terminals</p>
              {isAdmin && (
                <Button size="sm" variant="secondary" onClick={() => setShowAddTerminal((v) => !v)}>
                  <Plus size={13} /> Add Terminal
                </Button>
              )}
            </div>

            {isAdmin && showAddTerminal && (
              <div className="mb-3 rounded-btn border border-line bg-surface-2/60 p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-64">
                    <Field label="Terminal name">
                      <TextInput value={terminalName} onChange={(e) => setTerminalName(e.target.value)} />
                    </Field>
                  </div>
                  {terminalError && <p className="text-xs text-[#DC2626]">{terminalError}</p>}
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setShowAddTerminal(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleAddTerminal} disabled={savingTerminal}>
                    {savingTerminal ? 'Saving…' : 'Save Terminal'}
                  </Button>
                </div>
              </div>
            )}

            {terminals.length === 0 ? (
              <div className="rounded-btn border border-line bg-surface-2/60 px-3 py-2">
                <p className="text-[13px] text-muted">No terminals on record for this port.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-btn border border-line">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                      <th className="px-3 py-2 font-medium">Terminal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {terminals.map((t) => (
                      <tr key={t.id} className="border-b border-line text-xs text-body last:border-0">
                        <td className="px-3 py-2">{t.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </Card>
    </div>
  )
}
