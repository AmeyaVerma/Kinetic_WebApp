import { useCallback, useEffect, useState } from 'react'
import { Card } from '../ui/Card'
import { Badge, type BadgeTone } from '../ui/Badge'
import { Button } from '../ui/Button'
import { supabase } from '../../lib/supabaseClient'

interface OutboxRow {
  id: string
  event_type: string
  channel: string
  recipient: string | null
  subject: string
  body: string
  status: 'Queued' | 'Sending' | 'Sent' | 'Failed' | 'Skipped'
  attempts: number
  last_error: string | null
  created_at: string
  sent_at: string | null
}

const TONE: Record<OutboxRow['status'], BadgeTone> = {
  Queued: 'attention',
  Sending: 'info',
  Sent: 'success',
  Failed: 'danger',
  Skipped: 'neutral',
}

/**
 * The notification outbox, read-only.
 *
 * Events that should reach a person are written as rows by the database at
 * the moment they happen. No email or WhatsApp provider is connected, so
 * nothing here has been SENT: a row says Queued until a sender exists, and
 * this screen says so instead of implying delivery. A row with no recipient
 * address reads Skipped.
 */
export function OutboxTab() {
  const [rows, setRows] = useState<OutboxRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('notification_outbox')
      .select('id, event_type, channel, recipient, subject, body, status, attempts, last_error, created_at, sent_at')
      .order('created_at', { ascending: false })
      .limit(200)
    setRows((data as OutboxRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const queued = rows.filter((r) => r.status === 'Queued').length

  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold">Notification outbox</h3>
          <p className="mt-1 max-w-2xl text-xs text-muted">
            Messages the system has decided to send. No email or WhatsApp provider is connected yet, so
            nothing has actually been delivered: {queued} waiting. They will go out once a sender is
            added.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Event</th>
              <th className="px-3 py-2 font-medium">To</th>
              <th className="px-3 py-2 font-medium">Message</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line align-top last:border-0">
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">
                  {new Date(r.created_at).toLocaleString('en-IN')}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px]">{r.event_type}</td>
                <td className="px-3 py-2.5 text-xs">{r.recipient ?? <span className="text-muted">no address</span>}</td>
                <td className="px-3 py-2.5 text-xs">
                  <p className="font-medium">{r.subject}</p>
                  <p className="text-muted">{r.body}</p>
                  {r.last_error && <p className="text-red-600">{r.last_error}</p>}
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={TONE[r.status]} label={r.status} />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted">
                  Nothing has been queued yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
