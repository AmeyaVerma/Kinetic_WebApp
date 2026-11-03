import { useCallback, useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge, type BadgeTone } from '../ui/Badge'
import { TextInput } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'

interface Draft {
  id: string
  booking_id: string
  status: 'Submitted' | 'Approved' | 'Rejected'
  inputs: Record<string, string>
  reject_reason: string | null
  decided_by: string | null
  file_name: string | null
  file_path: string | null
  created_at: string
  bookings?: { booking_ref: string } | null
}

const TONE: Record<Draft['status'], BadgeTone> = {
  Submitted: 'attention',
  Approved: 'success',
  Rejected: 'danger',
}

const LABEL: Record<string, string> = {
  shipper: 'Shipper',
  consignee: 'Consignee',
  notifyParty: 'Notify party',
  cargoDescription: 'Cargo description',
  packages: 'Packages',
  packageType: 'Package type',
  grossWeightKg: 'Gross weight (kg)',
  containers: 'Container numbers',
}

/**
 * Staff side of customer and agent BL draft inputs.
 *
 * Approving applies the inputs to the booking (the database does it), after
 * which staff generate the draft BL as usual and attach the PDF here for the
 * customer to download. Only an Admin or Approver decides.
 */
export function BlDraftQueue({
  canDecide,
  onError,
}: {
  canDecide: boolean
  onError: (m: string | null) => void
}) {
  const [rows, setRows] = useState<Draft[]>([])
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('bl_draft_inputs')
      .select('*, bookings(booking_ref)')
      .order('created_at', { ascending: false })
    setRows((data as unknown as Draft[]) ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (id: string, fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(id)
    onError(null)
    const { error } = await fn()
    setBusy(null)
    if (error) onError(error.message)
    await load()
  }

  const attach = async (d: Draft) => {
    const file = files[d.id]
    if (!file) return
    setBusy(d.id)
    onError(null)
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${d.booking_id}/draft/${d.id}_${safe}`
    const { error: upErr } = await supabase.storage
      .from('generated-documents')
      .upload(path, file, { contentType: file.type || 'application/pdf', upsert: true })
    if (upErr) {
      setBusy(null)
      onError(upErr.message)
      return
    }
    await run(d.id, () => supabase.rpc('attach_bl_draft_file', { p_id: d.id, p_path: path, p_file_name: file.name }))
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-line bg-surface-2 px-4 py-6 text-center text-sm text-muted">
        No BL draft inputs yet. They arrive when a customer or agent fills in the BL for one of their shipments.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((d) => (
        <Card key={d.id} className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={TONE[d.status]} label={d.status} />
            <span className="font-mono text-sm font-medium">{d.bookings?.booking_ref ?? '—'}</span>
            <span className="font-mono text-[11px] text-muted">{new Date(d.created_at).toLocaleDateString('en-GB')}</span>
          </div>

          <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            {Object.entries(d.inputs).map(([k, v]) => (
              <div key={k}>
                <dt className="font-medium text-heading">{LABEL[k] ?? k}</dt>
                <dd className="whitespace-pre-wrap text-body">{String(v)}</dd>
              </div>
            ))}
          </dl>

          {d.reject_reason && <p className="text-[13px] text-red-600">Rejected: {d.reject_reason}</p>}

          {d.status === 'Submitted' && canDecide && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={busy === d.id}
                onClick={() => void run(d.id, () => supabase.rpc('decide_bl_draft_inputs', { p_id: d.id, p_approve: true }))}
              >
                <Check size={13} /> Approve and apply to the booking
              </Button>
              <div className="w-56">
                <TextInput
                  placeholder="Reason, which the customer sees"
                  value={reasons[d.id] ?? ''}
                  onChange={(e) => setReasons((x) => ({ ...x, [d.id]: e.target.value }))}
                />
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy === d.id}
                onClick={() =>
                  void run(d.id, () =>
                    supabase.rpc('decide_bl_draft_inputs', { p_id: d.id, p_approve: false, p_reason: reasons[d.id] ?? '' }),
                  )
                }
              >
                <X size={13} /> Reject
              </Button>
            </div>
          )}
          {d.status === 'Submitted' && !canDecide && (
            <p className="text-[11px] text-muted">Only an Admin or an Approver can decide these.</p>
          )}

          {d.status === 'Approved' && !d.file_path && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept="application/pdf"
                className="text-[11px]"
                onChange={(e) => setFiles((x) => ({ ...x, [d.id]: e.target.files?.[0] ?? null }))}
              />
              <Button size="sm" variant="secondary" disabled={!files[d.id] || busy === d.id} onClick={() => void attach(d)}>
                Attach the draft BL for the customer
              </Button>
              <span className="text-[11px] text-muted">
                The inputs are applied to the booking. Generate the draft in Documents, then attach it here.
              </span>
            </div>
          )}
          {d.file_path && (
            <p className="text-[11px] text-muted">Draft shared with the customer{d.file_name ? `: ${d.file_name}` : ''}.</p>
          )}
        </Card>
      ))}
    </div>
  )
}
