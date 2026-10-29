import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { BOOKING_FIELD_LABEL } from '../../store/useDataStore'

/**
 * The booking's real history, read from `audit_log`.
 *
 * It used to show an in-memory list that named the fields someone touched
 * and nothing else — no old value, no new value, and a row per keystroke
 * rather than per save. Postgres has been recording the whole picture the
 * entire time through the audit trigger: one append-only row per statement,
 * with the full before and after image and who was signed in. This reads
 * that instead, and names the person rather than their role.
 */

type Row = {
  id: string
  table_name: string
  action: string
  actor_id: string | null
  actor_role: string | null
  changed_at: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
}

/** Columns that move on their own and would drown the real changes. */
const NOISE = new Set(['updated_at', 'created_at', 'id', 'tenant_id', 'booking_id'])

/** camelCase labels, re-keyed to the snake_case columns Postgres reports. */
const COLUMN_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(BOOKING_FIELD_LABEL).map(([field, label]) => [
    field.replace(/([A-Z])/g, '_$1').toLowerCase(),
    label,
  ]),
)

function labelOf(column: string): string {
  if (COLUMN_LABEL[column]) return COLUMN_LABEL[column]
  const words = column.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return Array.isArray(v) ? `${v.length} row(s)` : 'details'
  return String(v)
}

/** The fields that actually moved between the before and after images. */
function changesIn(row: Row): { column: string; from: unknown; to: unknown }[] {
  const after = row.new_data ?? {}
  const before = row.old_data ?? {}
  return Object.keys(after)
    .filter((k) => !NOISE.has(k))
    .filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null))
    .map((k) => ({ column: k, from: before[k], to: after[k] }))
}

const TABLE_NAME: Record<string, string> = {
  bookings: 'Booking',
  bl_state: 'BL',
  bl_versions: 'BL version',
  booking_charges: 'Charge line',
  booking_documents: 'Document',
  booking_milestones: 'Milestone',
  container_activities: 'Container activity',
  container_activity_marks: 'Container activity',
  cro_documents: 'CRO',
  document_versions: 'Generated document',
}

export function BookingAuditLog({ dbId }: { dbId: string | undefined }) {
  const [rows, setRows] = useState<Row[]>([])
  const [people, setPeople] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!dbId) {
      setRows([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase
        .from('audit_log')
        .select('id, table_name, action, actor_id, actor_role, changed_at, old_data, new_data')
        .eq('record_id', dbId)
        .order('changed_at', { ascending: false })
        .limit(200),
      supabase.from('profiles').select('id, name'),
    ]).then(([audit, profiles]) => {
      if (cancelled) return
      setRows((audit.data as Row[]) ?? [])
      setPeople(
        Object.fromEntries(
          ((profiles.data as { id: string; name: string }[]) ?? []).map((p) => [p.id, p.name]),
        ),
      )
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [dbId])

  if (!dbId) {
    return (
      <p className="py-4 text-center text-sm text-muted">
        This booking is not in the database, so it has no audit history.
      </p>
    )
  }
  if (loading) return <p className="py-4 text-center text-sm text-muted">Loading history…</p>
  if (rows.length === 0) return <p className="py-4 text-center text-sm text-muted">No activity yet</p>

  return (
    <div className="space-y-0">
      {rows.map((r) => {
        const changes = r.action === 'UPDATE' ? changesIn(r) : []
        const who = (r.actor_id && people[r.actor_id]) || 'System'
        return (
          <div key={r.id} className="flex items-start gap-3 border-b border-line py-2.5 text-xs last:border-0">
            <span className="w-36 shrink-0 font-mono text-muted">
              {new Date(r.changed_at).toLocaleString()}
            </span>
            <span className="w-32 shrink-0 font-medium text-heading">
              {who}
              {r.actor_role && <span className="block font-normal text-muted">{r.actor_role}</span>}
            </span>
            <div className="min-w-0 text-body">
              {r.action !== 'UPDATE' ? (
                <span>
                  {TABLE_NAME[r.table_name] ?? r.table_name}{' '}
                  {r.action === 'INSERT' ? 'created' : 'deleted'}
                </span>
              ) : changes.length === 0 ? (
                <span className="text-muted">
                  {TABLE_NAME[r.table_name] ?? r.table_name} saved — no field changed
                </span>
              ) : (
                <ul className="space-y-0.5">
                  {changes.map((c) => (
                    <li key={c.column}>
                      <span className="font-medium text-heading">{labelOf(c.column)}</span>{' '}
                      <span className="text-muted line-through">{show(c.from)}</span>
                      {' → '}
                      <span className="text-heading">{show(c.to)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
