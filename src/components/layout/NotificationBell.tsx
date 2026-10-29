import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { useDataStore } from '../../store/useDataStore'

/**
 * The bell, which carried a count and opened nothing.
 *
 * It now opens the things the badge was counting: approvals waiting on
 * someone, BL drafts sitting unapproved, and bookings with a cut-off close
 * enough to matter. Read state is per person and per browser — these are
 * live records, not messages, so "read" only decides whether the badge
 * nags, never whether the work still needs doing.
 */

type Item = {
  id: string
  kind: 'Approval' | 'BL draft' | 'Cut-off'
  title: string
  detail: string
  at: string
  to: string
}

const READ_KEY = 'kinetic.notifications.read'
/** A cut-off this many days out is worth a nudge. */
const CUTOFF_WINDOW_DAYS = 3

function loadRead(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function saveRead(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]))
  } catch {
    /* Private windows and blocked site data: the panel still works. */
  }
}

export function NotificationBell() {
  const navigate = useNavigate()
  const { approvals, bookings, blStates } = useDataStore()
  const [open, setOpen] = useState(false)
  const [read, setRead] = useState<Set<string>>(loadRead)
  const boxRef = useRef<HTMLDivElement>(null)

  const items = useMemo<Item[]>(() => {
    const out: Item[] = []

    for (const a of approvals.filter((x) => x.status === 'Pending')) {
      const b = bookings.find((x) => x.id === a.bookingId)
      out.push({
        id: `approval-${a.id}`,
        kind: 'Approval',
        title: a.summary,
        detail: `Requested by ${a.requestedBy}${b ? ` · ${b.bookingRef}` : ''}`,
        at: a.requestedAt,
        to: '/approvals',
      })
    }

    for (const s of blStates.filter((x) => x.lifecycle === 'Draft' || x.lifecycle === 'Awaiting approval')) {
      const b = bookings.find((x) => x.id === s.bookingId)
      if (!b || b.demo) continue
      out.push({
        id: `bl-${s.bookingId}`,
        kind: 'BL draft',
        title: `BL ${s.lifecycle.toLowerCase()} on ${b.bookingRef}`,
        detail: `${b.bookingPartyName} · ${b.pol || '—'} → ${b.pod || '—'}`,
        at: b.createdAt,
        to: `/nvocc/${b.id}`,
      })
    }

    const now = Date.now()
    const horizon = now + CUTOFF_WINDOW_DAYS * 24 * 60 * 60 * 1000
    for (const b of bookings) {
      if (b.demo || b.cancelled) continue
      const cutoff = b.plannedSiCutoff || b.plannedCyCutoff || b.plannedGateClose
      if (!cutoff) continue
      const t = new Date(cutoff).getTime()
      if (Number.isNaN(t) || t < now || t > horizon) continue
      out.push({
        id: `cutoff-${b.id}`,
        kind: 'Cut-off',
        title: `Cut-off approaching on ${b.bookingRef}`,
        detail: `${new Date(cutoff).toLocaleString()} · ${b.vesselName || 'vessel TBC'}`,
        at: cutoff,
        to: `/nvocc/${b.id}`,
      })
    }

    return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [approvals, bookings, blStates])

  const unread = items.filter((i) => !read.has(i.id))

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const markRead = (ids: string[]) => {
    setRead((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      saveRead(next)
      return next
    })
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ''}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--icon)] hover:bg-surface-2 hover:text-[var(--icon-hover)]"
      >
        <Bell size={18} />
        {unread.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-badge bg-accent-coral px-1 text-[10px] font-bold text-white">
            {unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-btn border border-line bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Notifications</p>
            {unread.length > 0 && (
              <button
                onClick={() => markRead(items.map((i) => i.id))}
                className="flex items-center gap-1 text-[11px] font-medium text-link hover:underline"
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted">Nothing needs you right now.</p>
            ) : (
              items.map((i) => (
                <button
                  key={i.id}
                  onClick={() => {
                    markRead([i.id])
                    setOpen(false)
                    navigate(i.to)
                  }}
                  className={`block w-full border-b border-line px-3 py-2.5 text-left last:border-0 hover:bg-surface-2 ${
                    read.has(i.id) ? 'opacity-60' : ''
                  }`}
                >
                  <span className="mb-0.5 flex items-center gap-1.5">
                    {!read.has(i.id) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">{i.kind}</span>
                  </span>
                  <span className="block text-[12px] font-medium text-heading">{i.title}</span>
                  <span className="block truncate text-[11px] text-muted">{i.detail}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
