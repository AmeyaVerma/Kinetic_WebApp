import { useCallback, useEffect, useState } from 'react'
import { FilePenLine } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge, type BadgeTone } from '../ui/Badge'
import { Select } from '../ui/Field'
import { PodAgentPicker } from './PodAgentPicker'
import { supabase } from '../../lib/supabaseClient'

interface Amendment {
  id: string
  status: 'Pending' | 'Approved' | 'Rejected' | 'Reissued'
  reason: string
  changes: {
    pod_agent_id?: { fromLabel: string | null; toLabel: string | null }
    freight_terms?: { from: string | null; to: string | null }
  }
  requested_by: string | null
  requested_at: string
  decided_by: string | null
  reject_reason: string | null
  reissued_version: number | null
  reissued_by: string | null
}

const TONE: Record<Amendment['status'], BadgeTone> = {
  Pending: 'attention',
  Approved: 'info',
  Rejected: 'danger',
  Reissued: 'success',
}

const describe = (c: Amendment['changes']) =>
  [
    c.pod_agent_id && `POD agent: ${c.pod_agent_id.fromLabel ?? 'none'} → ${c.pod_agent_id.toLabel}`,
    c.freight_terms && `Freight terms: ${c.freight_terms.from ?? 'not set'} → ${c.freight_terms.to}`,
  ]
    .filter(Boolean)
    .join(' · ')

/**
 * Amendments to an issued BL (spec v2).
 *
 * After issue the POD agent and freight terms are locked on the booking. To
 * change either, staff give a reason and the new value; an Admin or Approver
 * decides it in Approvals (never the requester); approving applies the change
 * to the booking; and only then can staff re-issue the BL, which writes the
 * next document version. Until that re-issue the BL still prints exactly what
 * it printed before.
 *
 * Every rule here is the database's: this component only asks and reports.
 */
export function BlAmendments({
  blId,
  currentAgentId,
  currentFreightTerms,
  disabled,
  onReissue,
}: {
  blId: string
  currentAgentId: string | null | undefined
  currentFreightTerms: string | null | undefined
  disabled: boolean
  /** Builds and stores the new version, then records it. Throws to refuse. */
  onReissue: (amendmentId: string) => Promise<void>
}) {
  const [rows, setRows] = useState<Amendment[]>([])
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [agent, setAgent] = useState<string | null>(currentAgentId ?? null)
  const [terms, setTerms] = useState(currentFreightTerms ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('bl_amendments')
      .select(
        'id, status, reason, changes, requested_by, requested_at, decided_by, reject_reason, reissued_version, reissued_by',
      )
      .eq('bl_id', blId)
      .order('requested_at', { ascending: false })
    setRows((data as unknown as Amendment[]) ?? [])
  }, [blId])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async () => {
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.rpc('request_bl_amendment', {
      p_bl: blId,
      p_reason: reason,
      p_pod_agent: agent && agent !== currentAgentId ? agent : null,
      p_freight_terms: terms && terms !== currentFreightTerms ? terms : null,
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setOpen(false)
    setReason('')
    await load()
  }

  const reissue = async (id: string) => {
    setError(null)
    setBusy(true)
    try {
      await onReissue(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not re-issue')
    }
    setBusy(false)
  }

  const inProgress = rows.some((r) => r.status === 'Pending' || r.status === 'Approved')

  return (
    <div className="space-y-3 rounded-btn border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <FilePenLine size={14} className="text-primary" /> Amendments
        </p>
        {!disabled && !inProgress && (
          <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
            {open ? 'Close' : 'Request an amendment'}
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted">
        This BL is issued, so its POD agent and freight terms are locked. Changing either needs an approved
        amendment, then a re-issue as a new version.
      </p>

      {open && (
        <div className="space-y-3 rounded-btn border border-line bg-surface-2/40 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="text-xs text-muted">
              POD agent
              <div className="mt-1">
                <PodAgentPicker value={agent} onChange={setAgent} />
              </div>
            </div>
            <label className="text-xs text-muted">
              Freight terms
              <Select className="mt-1" value={terms} onChange={(e) => setTerms(e.target.value)}>
                <option value="">— not set —</option>
                <option value="Prepaid">PREPAID</option>
                <option value="Collect">COLLECT</option>
              </Select>
            </label>
          </div>
          <label className="block text-xs text-muted">
            Reason (kept with the approval and the BL's history)
            <textarea
              className="mt-1 w-full rounded-input border border-line bg-surface px-3 py-2 text-sm"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <Button size="sm" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Sending…' : 'Send for approval'}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={TONE[r.status]} label={r.status === 'Approved' ? 'Approved — re-issue needed' : r.status} />
                <span className="text-xs">{describe(r.changes)}</span>
              </div>
              <p className="text-[11px] text-muted">
                “{r.reason}” — requested by {r.requested_by ?? 'staff'} on{' '}
                {new Date(r.requested_at).toLocaleDateString('en-GB')}
                {r.decided_by ? `, decided by ${r.decided_by}` : ''}
                {r.reject_reason ? `. Rejected: ${r.reject_reason}` : ''}
                {r.status === 'Reissued'
                  ? `. Re-issued as version ${r.reissued_version} by ${r.reissued_by ?? 'staff'}`
                  : ''}
              </p>
              {r.status === 'Pending' && (
                <p className="text-[11px] text-muted">Waiting for an Admin or Approver in Approvals.</p>
              )}
              {r.status === 'Approved' && !disabled && (
                <Button size="sm" disabled={busy} onClick={() => void reissue(r.id)}>
                  Re-issue BL as a new version
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
