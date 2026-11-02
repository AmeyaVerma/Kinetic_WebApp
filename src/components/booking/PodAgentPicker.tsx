import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Select } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'

interface AgentOption {
  id: string
  code: string | null
  name: string
  country: string | null
  status: string
  compliance_status: string
  agent_branches?: { address_raw: string | null; city: string | null; country: string | null }[]
  agent_contacts?: { name: string | null; email: string | null; phone: string | null }[]
}

/**
 * The POD Agent picker (spec v2).
 *
 * Reads the Agents master and nothing else -- that is the whole point of the
 * master existing. The field used to be filled from a list of all 230
 * parties, which is how two bookings ended up with customers as their agents.
 *
 * Two rules are enforced here rather than left to goodwill:
 *
 *  - A BLOCKED agent is never offered. v2 adds sanctions screening because
 *    four of the seven agents supplied are Iranian or Iran-connected, and a
 *    booking must not be approved against a blocked one. Offering it and
 *    warning afterwards would be the wrong order.
 *  - Only ACTIVE agents are offered, for the same reason the depot picker
 *    does it: an imported record has not been checked by anyone yet.
 *
 * It shows the agent's address and contact once chosen, because v2 asks the
 * picker to show "name, address and contact" and because whoever is about to
 * print this on a BL should see what they are printing.
 */
export function PodAgentPicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null | undefined
  onChange: (id: string | null) => void
  disabled?: boolean
}) {
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('agents')
        .select(
          'id, code, name, country, status, compliance_status, agent_branches(address_raw, city, country), agent_contacts(name, email, phone)',
        )
        .order('name')
      if (!cancelled) {
        setAgents((data as unknown as AgentOption[]) ?? [])
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selectable = agents.filter(
    (a) => a.status === 'Active' && a.compliance_status !== 'Blocked',
  )
  const current = value ? agents.find((a) => a.id === value) : undefined
  // An agent already on the booking stays visible even if it has since been
  // deactivated, so saving another field cannot silently drop it.
  const shown = current && !selectable.some((a) => a.id === current.id)
    ? [current, ...selectable]
    : selectable

  const waiting = agents.length - selectable.length
  const branch = current?.agent_branches?.[0]
  const contact = current?.agent_contacts?.find((c) => c.phone || c.email || c.name)

  return (
    <div className="space-y-1">
      <Select
        value={value ?? ''}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{loading ? 'Loading agents…' : '— choose an agent —'}</option>
        {shown.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code ? `${a.code} · ` : ''}
            {a.name}
            {a.country ? ` (${a.country})` : ''}
            {a.status !== 'Active' ? ' — inactive' : ''}
          </option>
        ))}
      </Select>

      {!loading && selectable.length === 0 && (
        <p className="text-[11px] text-amber-600">
          No agent is active yet. {agents.length} are imported and waiting for review — an
          agent is not offered here until somebody has checked it and recorded its sanctions
          screening.{' '}
          <Link to="/master/agents" className="text-link hover:underline">
            Review agents
          </Link>
        </p>
      )}

      {!loading && selectable.length > 0 && waiting > 0 && (
        <p className="text-[11px] text-muted">
          {waiting} more {waiting === 1 ? 'agent is' : 'agents are'} imported but not yet active
          or cleared.{' '}
          <Link to="/master/agents" className="text-link hover:underline">
            Review them
          </Link>
        </p>
      )}

      {current && (
        <div className="rounded-btn border border-line bg-surface px-2.5 py-1.5 text-[11px] text-muted">
          <p>{branch?.address_raw ?? 'No address on file.'}</p>
          {contact && (
            <p className="mt-0.5">
              {[contact.name, contact.phone, contact.email].filter(Boolean).join(' · ')}
            </p>
          )}
          {current.compliance_status !== 'Cleared' && (
            <p className="mt-1 flex items-center gap-1 text-amber-600">
              <ShieldAlert size={11} /> Screening: {current.compliance_status}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
