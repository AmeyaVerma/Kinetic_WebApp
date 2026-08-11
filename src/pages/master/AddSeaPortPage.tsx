import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, TextInput } from '../../components/ui/Field'
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

/** Add Sea Port — port identity saves first, then terminals attach to the
    saved port, same two-phase flow as Add Vessel (vessel then voyages). */
export function AddSeaPortPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [country, setCountry] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [port, setPort] = useState<SeaPortRecord | null>(null)

  const [terminalName, setTerminalName] = useState('')
  const [terminals, setTerminals] = useState<SeaPortTerminalRecord[]>([])
  const [savingTerminal, setSavingTerminal] = useState(false)
  const [terminalError, setTerminalError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Port name is required.')
      return
    }
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('sea_ports')
      .insert({ name: name.trim(), code: code.trim() || null, country: country.trim() || null })
      .select()
      .single()
    setSaving(false)
    if (err || !data) {
      setError(err?.message ?? 'Could not create sea port.')
      return
    }
    setPort(rowToSeaPort(data))
  }

  const handleAddTerminal = async () => {
    if (!port) return
    if (!terminalName.trim()) {
      setTerminalError('Terminal name is required.')
      return
    }
    setSavingTerminal(true)
    setTerminalError(null)
    const { data, error: err } = await supabase
      .from('sea_port_terminals')
      .insert({ port_id: port.id, name: terminalName.trim() })
      .select()
      .single()
    setSavingTerminal(false)
    if (err || !data) {
      setTerminalError(err?.message ?? 'Could not add terminal.')
      return
    }
    setTerminals((t) => [...t, rowToTerminal(data)])
    setTerminalName('')
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/ports/sea-ports" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Sea Ports with Terminals
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{port ? port.name : 'Add Sea Port'}</h1>
        <p className="mt-1 text-sm text-muted">
          {port
            ? 'Port saved — add its terminals below, or come back and add more later from the port detail page.'
            : 'Port identity saves as one record; terminals attach once the port is saved.'}
        </p>
      </div>

      {!port ? (
        <>
          <Card>
            <CardHeader title="Port details" />
            <div className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Port Name *">
                <TextInput value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Port Code">
                <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. INNSA" />
              </Field>
              <Field label="Country">
                <TextInput value={country} onChange={(e) => setCountry(e.target.value)} />
              </Field>
            </div>
          </Card>

          {error && <p className="text-sm text-[#DC2626]">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => navigate('/master/ports/sea-ports')}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Saving…' : 'Create Sea Port'}</Button>
          </div>
        </>
      ) : (
        <>
          <Card className="overflow-hidden">
            <CardHeader title="Terminals" />
            <div className="flex flex-wrap items-end gap-3 px-5 pb-5">
              <div className="w-64">
                <Field label="Terminal name">
                  <TextInput value={terminalName} onChange={(e) => setTerminalName(e.target.value)} />
                </Field>
              </div>
              <Button size="sm" onClick={handleAddTerminal} disabled={savingTerminal}>
                <Plus size={13} /> {savingTerminal ? 'Adding…' : 'Add Terminal'}
              </Button>
            </div>
            {terminalError && <p className="px-5 pb-3 text-sm text-[#DC2626]">{terminalError}</p>}

            <div className="overflow-x-auto border-t border-line">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-5 py-3 font-medium">Terminal</th>
                  </tr>
                </thead>
                <tbody>
                  {terminals.map((t) => (
                    <tr key={t.id} className="border-b border-line text-xs text-body last:border-0">
                      <td className="px-5 py-3">{t.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {terminals.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted">No terminals added yet.</p>}
            </div>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => navigate(`/master/ports/sea-ports/${port.id}`)}>Done</Button>
          </div>
        </>
      )}
    </div>
  )
}
