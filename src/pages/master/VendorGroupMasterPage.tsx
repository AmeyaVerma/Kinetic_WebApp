import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronRight, AlertTriangle, ShieldAlert, Plus } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge, type BadgeTone } from '../../components/ui/Badge'
import { TextInput, Select } from '../../components/ui/Field'
import { Tabs } from '../../components/ui/Tabs'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabaseClient'

/**
 * The shared screen for the masters spec v2 added as a group: Agents, CFS and
 * the Empty Container Yards. All three carry the same shape -- a company,
 * its branches, its contacts, its documents -- because several of the rows
 * Siddharth supplied are one company at many sites.
 *
 * It is built around the fact that the imported data is NOT clean. Only 5 of
 * 45 rows arrived marked Ready; the rest carry a reviewer's note saying what
 * is wrong -- a country that was inferred, a phone buried in an address, a
 * name that may be a typo, a row that may duplicate another. The importer
 * deliberately did not guess, so this screen's job is to put those judgements
 * in front of a person rather than hide them behind a tidy-looking list.
 *
 * Add and delete are gated on Admin approval in v2. The controls are present
 * and honest about not being wired yet: the approval flow is a later pass.
 */

export interface GroupRecord {
  id: string
  code: string | null
  name: string
  country: string | null
  status: string
  review_status: string
  review_note: string | null
  source_ref: string | null
  sales_person: string | null
  tax_id: string | null
  pan: string | null
  compliance_status?: string | null
  compliance_checked_at?: string | null
  pays_via_other_bank?: boolean | null
}

interface Branch {
  id: string
  label: string | null
  address_raw: string | null
  city: string | null
  state: string | null
  country: string | null
  location_code: string | null
}

interface Contact {
  id: string
  name: string | null
  role: string | null
  email: string | null
  phone: string | null
}

export interface GroupMasterConfig {
  /** The parent table. */
  table: 'agents' | 'cfs' | 'empty_depots'
  /** Child tables and the column each uses to point at the parent. */
  branchTable: string
  contactTable: string
  parentKey: string
  title: string
  description: string
  /** Agents carry sanctions screening; the others do not. */
  compliance?: boolean
  backTo?: string
  /** Name of the database function that merges one record into another.
      Only set where merging is supported (depots). */
  mergeRpc?: string
}

const STATUS_TONE: Record<string, BadgeTone> = {
  Active: 'success',
  Inactive: 'neutral',
}

const COMPLIANCE_TONE: Record<string, BadgeTone> = {
  'Not screened': 'warn',
  Cleared: 'success',
  Blocked: 'critical',
}

export function VendorGroupMasterPage({ config }: { config: GroupMasterConfig }) {
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? user?.role) === 'admin'

  const [rows, setRows] = useState<GroupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('review')
  const [openId, setOpenId] = useState<string | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from(config.table)
      .select('*')
      .order('name', { ascending: true })
    if (err) setError(err.message)
    setRows((data as GroupRecord[]) ?? [])
    setLoading(false)
  }, [config.table])

  useEffect(() => {
    void load()
  }, [load])

  // Branches and contacts load only for the row a person opened. Loading them
  // for 41 depots up front would be three round trips to show nothing.
  useEffect(() => {
    if (!openId) {
      setBranches([])
      setContacts([])
      return
    }
    let cancelled = false
    void (async () => {
      const [b, c] = await Promise.all([
        supabase.from(config.branchTable).select('*').eq(config.parentKey, openId),
        supabase.from(config.contactTable).select('*').eq(config.parentKey, openId),
      ])
      if (cancelled) return
      setBranches((b.data as Branch[]) ?? [])
      setContacts((c.data as Contact[]) ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [openId, config.branchTable, config.contactTable, config.parentKey])

  /** Merge record `removeId` into `keepId`. The database does the moving; this
      only reports its answer and reloads. */
  const merge = async (keepId: string, removeId: string) => {
    if (!config.mergeRpc) return
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase.rpc(config.mergeRpc, { p_keep: keepId, p_remove: removeId })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    const m = data as { branches: number; contacts: number; documents: number; bookings: number }
    setNotice(
      `Merged. Moved ${m.branches} branch(es), ${m.contacts} contact(s), ${m.documents} document(s) and repointed ${m.bookings} booking(s).`,
    )
    setOpenId(null)
    await load()
  }

  const needsReview = useMemo(() => rows.filter((r) => r.review_status === 'Needs review'), [rows])
  const duplicates = useMemo(
    () =>
      rows.filter(
        (r) => r.review_status !== 'Merged' && (r.review_note ?? '').toLowerCase().includes('duplicate'),
      ),
    [rows],
  )

  const shown = useMemo(() => {
    const base =
      tab === 'review' ? needsReview : tab === 'duplicates' ? duplicates : rows
    const q = query.trim().toUpperCase()
    if (!q) return base
    return base.filter((r) =>
      [r.name, r.code, r.country, r.sales_person].some((f) => f && f.toUpperCase().includes(q)),
    )
  }, [tab, rows, needsReview, duplicates, query])

  const patch = async (id: string, changes: Partial<GroupRecord>) => {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from(config.table).update(changes).eq('id', id)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...changes } : r)))
  }

  return (
    <div className="space-y-5">
      <Link
        to={config.backTo ?? '/master'}
        className="inline-flex items-center gap-1.5 text-sm text-link hover:underline"
      >
        <ArrowLeft size={14} /> Back
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{config.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">{config.description}</p>
        </div>
        <Button size="sm" variant="secondary" disabled title="Adding a record raises an Admin approval — that flow is not wired yet">
          <Plus size={14} /> Add
        </Button>
      </div>

      {needsReview.length > 0 && (
        <div className="flex items-start gap-2 rounded-card border border-line bg-surface-2 px-4 py-3 text-xs text-muted">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <p>
            <span className="font-semibold text-heading">
              {needsReview.length} of {rows.length} records need review.
            </span>{' '}
            They were imported exactly as supplied and the importer did not guess: where a
            country was inferred, a phone sits inside an address, or a row may duplicate
            another, the record says so and waits for a person. A record stays Inactive — and
            so out of every picker — until somebody marks it Active.
          </p>
        </div>
      )}

      <Tabs
        tabs={[
          { key: 'review', label: 'Needs review', badge: needsReview.length },
          { key: 'duplicates', label: 'Possible duplicates', badge: duplicates.length },
          { key: 'all', label: 'All', badge: rows.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="max-w-sm">
        <TextInput
          placeholder="Search name, code, country…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-primary">{notice}</p>}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-3 py-3 font-medium" />
                <th className="px-3 py-3 font-medium">Code</th>
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Country</th>
                {config.compliance && <th className="px-3 py-3 font-medium">Screening</th>}
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Review</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const open = openId === r.id
                return (
                  <>
                    <tr
                      key={r.id}
                      className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60"
                      onClick={() => setOpenId(open ? null : r.id)}
                    >
                      <td className="px-3 py-3 text-muted">
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{r.code ?? '—'}</td>
                      <td className="px-3 py-3 font-medium">{r.name}</td>
                      <td className="px-3 py-3">{r.country ?? '—'}</td>
                      {config.compliance && (
                        <td className="px-3 py-3">
                          <Badge
                            tone={COMPLIANCE_TONE[r.compliance_status ?? 'Not screened'] ?? 'warn'}
                            label={r.compliance_status ?? 'Not screened'}
                          />
                        </td>
                      )}
                      <td className="px-3 py-3">
                        <Badge tone={STATUS_TONE[r.status] ?? 'neutral'} label={r.status} />
                      </td>
                      <td className="px-3 py-3">
                        {r.review_status === 'Needs review' ? (
                          <Badge tone="warn" label="Needs review" />
                        ) : r.review_status === 'Merged' ? (
                          <Badge tone="neutral" label="Merged" />
                        ) : (
                          <Badge tone="success" label="Ready" />
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr key={`${r.id}-detail`} className="border-b border-line bg-surface-2/40">
                        <td colSpan={config.compliance ? 7 : 6} className="px-5 py-4">
                          <Detail
                            record={r}
                            branches={branches}
                            contacts={contacts}
                            compliance={!!config.compliance}
                            isAdmin={isAdmin}
                            saving={saving}
                            onPatch={(changes) => void patch(r.id, changes)}
                            mergeTargets={config.mergeRpc ? rows.filter((o) => o.id !== r.id && o.review_status !== 'Merged') : []}
                            onMerge={config.mergeRpc ? (keepId) => void merge(keepId, r.id) : undefined}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {!loading && shown.length === 0 && (
                <tr>
                  <td
                    colSpan={config.compliance ? 7 : 6}
                    className="px-5 py-10 text-center text-sm text-muted"
                  >
                    {tab === 'review'
                      ? 'Nothing is waiting for review.'
                      : tab === 'duplicates'
                        ? 'No possible duplicates flagged.'
                        : 'No records yet.'}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td
                    colSpan={config.compliance ? 7 : 6}
                    className="px-5 py-10 text-center text-sm text-muted"
                  >
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

function Detail({
  record,
  branches,
  contacts,
  compliance,
  isAdmin,
  saving,
  onPatch,
  mergeTargets,
  onMerge,
}: {
  record: GroupRecord
  branches: Branch[]
  contacts: Contact[]
  compliance: boolean
  isAdmin: boolean
  saving: boolean
  onPatch: (changes: Partial<GroupRecord>) => void
  mergeTargets: GroupRecord[]
  onMerge?: (keepId: string) => void
}) {
  const [keepId, setKeepId] = useState('')
  return (
    <div className="space-y-4">
      {record.review_note && (
        <div className="rounded-btn border border-line bg-surface px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted">
            What the reviewer flagged
          </p>
          <p className="mt-1 text-[13px] text-body">{record.review_note}</p>
          {record.source_ref && (
            <p className="mt-1 font-mono text-[10px] text-muted">Source: {record.source_ref}</p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Branches</p>
          {branches.length === 0 ? (
            <p className="mt-1 text-[13px] text-muted">None recorded.</p>
          ) : (
            <ul className="mt-1 space-y-2">
              {branches.map((b) => (
                <li key={b.id} className="text-[13px]">
                  <span className="font-medium text-heading">{b.label ?? 'Branch'}</span>
                  {b.location_code && (
                    <span className="ml-2 font-mono text-[11px] text-primary">
                      {b.location_code}
                    </span>
                  )}
                  <p className="text-muted">{b.address_raw ?? '—'}</p>
                  <p className="text-muted">
                    {[b.city, b.state, b.country].filter(Boolean).join(', ') || '—'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Contacts</p>
          {contacts.length === 0 ? (
            <p className="mt-1 text-[13px] text-muted">
              None split out yet — check the address above.
            </p>
          ) : (
            <ul className="mt-1 space-y-1">
              {contacts.map((c) => (
                <li key={c.id} className="text-[13px] text-body">
                  {c.name && <span className="font-medium text-heading">{c.name} </span>}
                  {c.phone ?? ''} {c.email ?? ''}
                  {!c.name && !c.phone && !c.email && <span className="text-muted">—</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Identity</p>
          <p className="text-[13px] text-body">GSTIN / tax id: {record.tax_id ?? '—'}</p>
          <p className="text-[13px] text-body">PAN: {record.pan ?? '—'}</p>
          <p className="text-[13px] text-body">Sales person: {record.sales_person ?? '—'}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
        <label className="text-xs text-muted">
          Status
          <Select
            className="mt-1"
            value={record.status}
            disabled={!isAdmin || saving}
            onChange={(e) => onPatch({ status: e.target.value })}
          >
            <option value="Inactive">Inactive</option>
            <option value="Active">Active</option>
          </Select>
        </label>

        {compliance && (
          <label className="text-xs text-muted">
            Sanctions screening
            <Select
              className="mt-1"
              value={record.compliance_status ?? 'Not screened'}
              disabled={!isAdmin || saving}
              onChange={(e) =>
                onPatch({
                  compliance_status: e.target.value,
                  compliance_checked_at: new Date().toISOString().slice(0, 10),
                })
              }
            >
              <option value="Not screened">Not screened</option>
              <option value="Cleared">Cleared</option>
              <option value="Blocked">Blocked</option>
            </Select>
          </label>
        )}

        <label className="text-xs text-muted">
          Review
          <Select
            className="mt-1"
            value={record.review_status}
            disabled={!isAdmin || saving}
            onChange={(e) => onPatch({ review_status: e.target.value })}
          >
            <option value="Needs review">Needs review</option>
            <option value="Ready">Ready</option>
            {record.review_status === 'Merged' && (
              <option value="Merged" disabled>
                Merged
              </option>
            )}
          </Select>
        </label>

        {!isAdmin && (
          <p className="text-xs text-muted">
            Only an Admin can change these. v2 routes a non-Admin&rsquo;s change through
            Approvals; that flow is not wired yet.
          </p>
        )}
      </div>

      {onMerge && isAdmin && record.review_status !== 'Merged' && (
        <div className="space-y-2 rounded-btn border border-line bg-surface px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted">
            Same yard as another record?
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={keepId} onChange={(e) => setKeepId(e.target.value)} className="max-w-sm">
              <option value="">Merge this record into…</option>
              {mergeTargets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="secondary"
              disabled={!keepId || saving}
              onClick={() => {
                const target = mergeTargets.find((o) => o.id === keepId)
                if (
                  target &&
                  window.confirm(
                    `Merge "${record.name}" into "${target.name}"? Its branches, contacts and bookings move to "${target.name}", and "${record.name}" stays on record as Merged and Inactive.`,
                  )
                )
                  onMerge(keepId)
              }}
            >
              Merge
            </Button>
          </div>
          <p className="text-[11px] text-muted">
            Nothing is deleted. This record is kept, marked Merged and Inactive, and no longer offered on a booking.
          </p>
        </div>
      )}

      {record.review_status === 'Merged' && (
        <p className="text-xs text-muted">This record was merged into another and is kept only for the trace.</p>
      )}

      {compliance && record.compliance_status === 'Blocked' && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <ShieldAlert size={13} /> Blocked by screening. A booking must not be approved
          against this agent.
        </p>
      )}
    </div>
  )
}
