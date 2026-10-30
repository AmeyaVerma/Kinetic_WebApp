import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link2, Trash2, AlertTriangle } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Field, Select } from '../ui/Field'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import { useDataStore } from '../../store/useDataStore'
import { supabase } from '../../lib/supabaseClient'

interface PortalAccountRow {
  id: string
  user_id: string
  kind: 'customer' | 'agent'
  party_id: string
  created_at: string
  created_by: string | null
}

const TH = 'px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted'
const TD = 'px-3 py-3 text-sm'

/**
 * Linking a portal login to the party it speaks for.
 *
 * This is the half of the invite flow that decides what somebody can see.
 * Creating the login itself is a sign-up the person does, and approving it
 * happens on the Pending approvals tab; this screen answers the separate
 * question of *whose* shipments that login means.
 *
 * Without a link the portal shows nothing at all — deliberately, because a
 * portal account with no party is indistinguishable from one whose party has
 * no shipments, and guessing between them is how customers end up looking at
 * each other's cargo.
 */
export function PortalAccountsTab() {
  const users = useAuthStore((s) => s.users)
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId)
  const currentUser = useCurrentUser()
  const { parties, fetchParties } = useDataStore()

  const [rows, setRows] = useState<PortalAccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [partyId, setPartyId] = useState('')
  const [kind, setKind] = useState<'customer' | 'agent'>('customer')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('portal_accounts')
      .select('id, user_id, kind, party_id, created_at, created_by')
      .order('created_at', { ascending: false })
    setRows((data as PortalAccountRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    void fetchParties()
  }, [load, fetchParties])

  // Only external logins can hold a portal account. A staff member linked to
  // a customer would quietly gain a second, narrower identity, and the
  // policies would then answer two different questions for the same person.
  const externalUsers = useMemo(
    () => users.filter((u) => u.role === 'customer' || u.role === 'agent'),
    [users],
  )

  const linkedUserIds = useMemo(() => new Set(rows.map((r) => r.user_id)), [rows])
  const unlinked = externalUsers.filter((u) => !linkedUserIds.has(u.id))

  const nameOfUser = (id: string) => users.find((u) => u.id === id)?.name ?? id
  const emailOfUser = (id: string) => users.find((u) => u.id === id)?.email ?? ''
  const nameOfParty = (id: string) =>
    parties.find((p) => p.id === id)?.displayName ??
    parties.find((p) => p.id === id)?.legalName ??
    id

  const link = async () => {
    setError(null)
    if (!userId || !partyId) {
      setError('Pick both a login and the party it speaks for.')
      return
    }
    setSaving(true)
    const { error: err } = await supabase.from('portal_accounts').insert({
      user_id: userId,
      tenant_id: activeCompanyId,
      kind,
      party_id: partyId,
      created_by: currentUser?.name ?? null,
    })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setUserId('')
    setPartyId('')
    void load()
  }

  const unlink = async (id: string) => {
    const { error: err } = await supabase.from('portal_accounts').delete().eq('id', id)
    if (err) setError(err.message)
    void load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-card border border-line bg-surface-2 px-4 py-3 text-xs text-muted">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <p>
          A portal account belongs to <span className="font-semibold">one company</span>. A customer
          who deals with both Kinetic and RKS needs a separate login for each — the same login
          cannot be linked twice. What the login can read is enforced by row-level security in the
          database, not by this screen.
        </p>
      </div>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Link2 size={15} className="text-primary" /> Link a portal login
        </h2>
        {externalUsers.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No customer or agent logins exist yet. They are created when someone signs up and an
            Admin approves them on the Pending approvals tab with the role Customer or Agent.
          </p>
        ) : (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Login">
                <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
                  <option value="">Choose a login…</option>
                  {unlinked.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Sees shipments as">
                <Select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as 'customer' | 'agent')}
                >
                  <option value="customer">Customer — bookings they placed</option>
                  <option value="agent">Agent — bookings they handle</option>
                </Select>
              </Field>
              <Field label="Party">
                <Select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                  <option value="">Choose a party…</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName || p.legalName}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button size="sm" onClick={() => void link()} disabled={saving}>
                {saving ? 'Linking…' : 'Link account'}
              </Button>
              {error && <p className="text-sm text-red-600">{error}</p>}
              {unlinked.length === 0 && externalUsers.length > 0 && (
                <p className="text-sm text-muted">Every external login is already linked.</p>
              )}
            </div>
          </>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-2.5">
          <h2 className="text-sm font-semibold">Linked portal accounts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line">
                <th className={TH}>Login</th>
                <th className={TH}>Sees as</th>
                <th className={TH}>Party</th>
                <th className={TH}>Linked by</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className={TD}>
                    <p className="font-medium">{nameOfUser(r.user_id)}</p>
                    <p className="text-xs text-muted">{emailOfUser(r.user_id)}</p>
                  </td>
                  <td className={TD}>
                    <Badge tone={r.kind === 'agent' ? 'info' : 'success'} label={r.kind} />
                  </td>
                  <td className={TD}>{nameOfParty(r.party_id)}</td>
                  <td className={`${TD} text-muted`}>{r.created_by ?? '—'}</td>
                  <td className={TD}>
                    <Button variant="ghost" size="sm" onClick={() => void unlink(r.id)}>
                      <Trash2 size={13} /> Unlink
                    </Button>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted">
                    No portal account has been linked yet, so no customer or agent can see
                    anything.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
