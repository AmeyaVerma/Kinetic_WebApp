import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Select } from '../ui/Field'
import { CsvButton } from '../ui/CsvButton'
import { supabase } from '../../lib/supabaseClient'

/**
 * The real audit trail, read from `audit_log` in Supabase.
 *
 * It previously showed an in-memory list seeded with a single placeholder
 * row, so nothing that actually happened — including every BL signature —
 * was visible. The table itself has been filling up the whole time; only the
 * screen was disconnected.
 *
 * Readable rather than raw: the table holds ~29k rows, almost all of them
 * row-level INSERTs from import batches. A page that dumps those newest-first
 * buries the handful of entries anyone opens this screen to find, so signing
 * and document events get their own filter and are named in plain words.
 */

type Row = {
  id: string
  table_name: string
  record_id: string | null
  action: string
  actor_id: string | null
  actor_role: string | null
  changed_at: string
  new_data: Record<string, unknown> | null
}

type Filter = 'signing' | 'documents' | 'changes' | 'all'

const FILTERS: { key: Filter; label: string; hint: string }[] = [
  { key: 'signing', label: 'Signing', hint: 'PINs, signatures and surrender stamps' },
  { key: 'documents', label: 'Documents', hint: 'BLs and generated documents' },
  { key: 'changes', label: 'Record changes', hint: 'Edits to bookings and masters' },
  { key: 'all', label: 'Everything', hint: 'Including bulk imports' },
]

/** Actions the signing function writes. */
const SIGNING_ACTIONS = [
  'BL_SIGNED',
  'SIGNING_PIN_SET',
  'SIGNING_PIN_FAILED',
  'SIGNING_LOCKED_OUT',
]

const DOCUMENT_TABLES = ['document_versions', 'bl_state', 'bl_versions', 'booking_documents']

export function AuditTrailTab() {
  const [rows, setRows] = useState<Row[]>([])
  const [people, setPeople] = useState<Record<string, { name: string; email: string }>>({})
  const [filter, setFilter] = useState<Filter>('signing')
  const [limit, setLimit] = useState(100)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    let q = supabase
      .from('audit_log')
      .select('id, table_name, record_id, action, actor_id, actor_role, changed_at, new_data')
      .order('changed_at', { ascending: false })
      .limit(limit)

    if (filter === 'signing') q = q.in('action', SIGNING_ACTIONS)
    else if (filter === 'documents') q = q.in('table_name', DOCUMENT_TABLES)
    else if (filter === 'changes') {
      // Row-level edits, minus the document tables that have their own view.
      q = q.not('table_name', 'in', '(' + DOCUMENT_TABLES.join(',') + ')')
    }

    const [{ data, error: err }, { data: profiles }] = await Promise.all([
      q,
      supabase.from('profiles').select('id, name, email'),
    ])

    if (err) setError(err.message)
    setRows((data as Row[]) ?? [])
    setPeople(
      Object.fromEntries(
        ((profiles as { id: string; name: string; email: string }[]) ?? []).map((p) => [
          p.id,
          { name: p.name, email: p.email },
        ]),
      ),
    )
    setLoading(false)
  }, [filter, limit])

  useEffect(() => {
    load()
  }, [load])

  const actorOf = (r: Row) => {
    if (!r.actor_id) return 'System'
    const p = people[r.actor_id]
    return p ? p.name : 'Unknown user'
  }

  /** Plain-English description of what the row records. */
  const describe = (r: Row): string => {
    const d = (r.new_data ?? {}) as Record<string, unknown>
    const bl = d.bl_number ? ' on ' + String(d.bl_number) : ''

    switch (r.action) {
      case 'BL_SIGNED':
        return (
          (d.option === 'surrender' ? 'Applied the surrender stamp' : 'Signed the BL') +
          bl +
          (d.scan ? ' (Scan Copy)' : '') +
          (d.front_sheets ? ' across ' + String(d.front_sheets) + ' sheet(s)' : '')
        )
      case 'SIGNING_PIN_SET':
        return 'Set or changed their signing PIN'
      case 'SIGNING_PIN_FAILED':
        return (
          'Failed signing PIN attempt ' +
          (d.attempts ? '(' + String(d.attempts) + ')' : '') +
          (d.locked ? ' — locked out' : '')
        )
      case 'SIGNING_LOCKED_OUT':
        return 'Blocked while locked out after repeated failed PINs'
      case 'INSERT':
        return 'Created a ' + humanTable(r.table_name)
      case 'UPDATE':
        return 'Updated a ' + humanTable(r.table_name)
      case 'DELETE':
        return 'Deleted a ' + humanTable(r.table_name)
      default:
        return r.action + ' on ' + humanTable(r.table_name)
    }
  }

  const csvRows = useMemo(
    () =>
      rows.map((r) => ({
        At: new Date(r.changed_at).toLocaleString(),
        Actor: actorOf(r),
        Role: r.actor_role ?? '',
        Action: r.action,
        Detail: describe(r),
        Table: r.table_name,
        Record: r.record_id ?? '',
      })),
    // actorOf/describe are stable for a given rows+people pair.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, people],
  )

  const active = FILTERS.find((f) => f.key === filter)

  return (
    <Card>
      <div className="space-y-3 px-5 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Append-only — who did what, and when
            </p>
            <p className="text-xs text-muted">{active?.hint}</p>
          </div>

          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="ml-auto max-w-[12rem]"
          >
            {FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </Select>

          <CsvButton filename={'audit-trail-' + filter} rows={csvRows} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {loading && <p className="py-4 text-sm text-muted">Loading…</p>}

        {!loading && rows.length === 0 && (
          <p className="py-4 text-sm text-muted">
            {filter === 'signing'
              ? 'Nothing signed yet. Signing a BL or applying the surrender stamp will appear here, with the name of whoever did it.'
              : 'No entries for this filter.'}
          </p>
        )}

        {!loading &&
          rows.map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-3 border-b border-line py-2 text-xs last:border-0"
            >
              <span className="w-36 shrink-0 font-mono text-muted">
                {new Date(r.changed_at).toLocaleString()}
              </span>
              <span className="w-32 shrink-0 font-medium text-heading">
                {actorOf(r)}
                {r.actor_role ? (
                  <span className="block font-normal text-muted">{r.actor_role}</span>
                ) : null}
              </span>
              <span className="text-body">{describe(r)}</span>
            </div>
          ))}

        {!loading && rows.length >= limit && (
          <Button size="sm" variant="ghost" onClick={() => setLimit((n) => n + 200)}>
            Show older entries
          </Button>
        )}
      </div>
    </Card>
  )
}

function humanTable(table: string): string {
  const names: Record<string, string> = {
    bookings: 'booking',
    bl_state: 'BL',
    bl_versions: 'BL version',
    document_versions: 'generated document',
    booking_documents: 'booking document',
    parties: 'party',
    containers: 'container',
    vessels: 'vessel',
    surveyors: 'surveyor',
    chas: 'CHA',
    empty_depots: 'depot',
    company_settings: 'company setting',
    signing_pins: 'signing PIN',
    profiles: 'user profile',
  }
  return names[table] ?? table.replace(/_/g, ' ')
}
