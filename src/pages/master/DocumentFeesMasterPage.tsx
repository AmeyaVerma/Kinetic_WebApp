import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Info } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge, type BadgeTone } from '../../components/ui/Badge'
import { TextInput } from '../../components/ui/Field'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabaseClient'

interface FeeRow {
  id: string
  doc_type: string
  label: string
  amount: number | null
  currency: string
  status: 'Test data' | 'Set' | 'Free'
  notes: string | null
  updated_at: string
  updated_by: string | null
}

const TONE: Record<FeeRow['status'], BadgeTone> = {
  'Test data': 'warn',
  Set: 'success',
  Free: 'info',
}

/**
 * Master Data → Document fees (spec v2).
 *
 * A price per document type, used when a document invoice is raised in the
 * portal's release flow.
 *
 * NO PRICE IS INVENTED HERE. Siddharth has not given any, so every row reads
 * "Test Data" until somebody sets it — and that is not a cosmetic label: a
 * document invoice cannot be raised against a Test Data fee at all, because
 * document_fee_for() in the database refuses it with the reason. A
 * placeholder number would have been the dangerous option, since the whole
 * purpose of this table is to be charged from.
 *
 * "Free" exists separately from a zero price, so a document that is
 * deliberately not charged for is distinguishable from one nobody has priced.
 *
 * v2 wants a price change to need Admin approval and to record the old and
 * new value. The recording is already handled -- the audit trigger stores
 * old_data and new_data for every row -- and the approval routing is the
 * same Approvals queue the rest of the app uses; that wiring is a later pass,
 * which the note on the page says plainly rather than implying it is done.
 */
export function DocumentFeesMasterPage() {
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? user?.role) === 'admin'

  const [rows, setRows] = useState<FeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('document_fees')
      .select('*')
      .order('label')
    if (err) setError(err.message)
    setRows((data as FeeRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (row: FeeRow, status: FeeRow['status']) => {
    setSaving(row.id)
    setError(null)
    const typed = draft[row.id]
    const amount =
      status === 'Set' ? (typed === undefined ? row.amount : Number(typed)) : null

    if (status === 'Set' && (amount === null || Number.isNaN(amount) || amount < 0)) {
      setSaving(null)
      setError(`Enter a price for ${row.label} before marking it Set.`)
      return
    }

    const { error: err } = await supabase
      .from('document_fees')
      .update({ amount, status, updated_by: user?.name ?? null })
      .eq('id', row.id)
    setSaving(null)
    if (err) {
      setError(err.message)
      return
    }
    setDraft((d) => {
      const next = { ...d }
      delete next[row.id]
      return next
    })
    await load()
  }

  const unpriced = rows.filter((r) => r.status === 'Test data').length

  return (
    <div className="space-y-5">
      <Link to="/master" className="inline-flex items-center gap-1.5 text-sm text-link hover:underline">
        <ArrowLeft size={14} /> Back to Master Data
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Document fees</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          What each document costs when a customer requests it. The portal&rsquo;s release flow
          raises a separate invoice per document, and this is where that amount comes from.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-card border border-line bg-surface-2 px-4 py-3 text-xs text-muted">
        <Info size={14} className="mt-0.5 shrink-0" />
        <p>
          {unpriced > 0 && (
            <>
              <span className="font-semibold text-heading">
                {unpriced} of {rows.length} are still Test Data.
              </span>{' '}
            </>
          )}
          No price has been invented. A fee marked <strong>Test Data</strong> cannot have an
          invoice raised against it — the database refuses it and says why — so a placeholder
          can never quietly become a charge. <strong>Free</strong> is kept separate from a price
          of zero, so a document nobody charges for is distinguishable from one nobody has
          priced. Every change records the old and new value in the audit trail; routing a
          non-Admin&rsquo;s change through Approvals is not wired yet.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Document</th>
                <th className="px-3 py-3 font-medium">Fee</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Last change</th>
                {isAdmin && <th className="px-3 py-3 font-medium" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.label}</p>
                    {r.notes && <p className="mt-0.5 text-[11px] text-muted">{r.notes}</p>}
                  </td>
                  <td className="px-3 py-3">
                    {isAdmin ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted">{r.currency}</span>
                        <div className="w-28">
                          <TextInput
                            placeholder={r.status === 'Test data' ? 'Test Data' : '0.00'}
                            value={draft[r.id] ?? (r.amount !== null ? String(r.amount) : '')}
                            onChange={(e) => setDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                          />
                        </div>
                      </div>
                    ) : r.status === 'Test data' ? (
                      <span className="text-muted">Test Data</span>
                    ) : r.status === 'Free' ? (
                      <span>Free</span>
                    ) : (
                      <span className="font-mono">
                        {r.currency} {Number(r.amount ?? 0).toLocaleString('en-IN')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={TONE[r.status]} label={r.status} />
                  </td>
                  <td className="px-3 py-3 text-[11px] text-muted">
                    {r.updated_by
                      ? `${r.updated_by}, ${new Date(r.updated_at).toLocaleDateString('en-GB')}`
                      : 'Never set'}
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          disabled={saving === r.id}
                          onClick={() => void save(r, 'Set')}
                        >
                          {saving === r.id ? 'Saving…' : 'Set price'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={saving === r.id}
                          onClick={() => void save(r, 'Free')}
                        >
                          Free
                        </Button>
                        {r.status !== 'Test data' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={saving === r.id}
                            onClick={() => void save(r, 'Test data')}
                          >
                            Unset
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-5 py-10 text-center text-sm text-muted">
                    No document types configured.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-5 py-10 text-center text-sm text-muted">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {!isAdmin && (
        <p className="text-xs text-muted">
          Only an Admin can change a fee. v2 routes a non-Admin&rsquo;s change through Approvals;
          that flow is not wired yet.
        </p>
      )}
    </div>
  )
}
