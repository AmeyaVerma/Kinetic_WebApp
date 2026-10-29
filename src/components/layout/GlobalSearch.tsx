import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useDataStore } from '../../store/useDataStore'
import { supabase } from '../../lib/supabaseClient'

/**
 * The top-bar search, which until now was an input with nothing behind it.
 *
 * It looks across the records people actually hunt for by reference — a
 * booking, the container on it, the BL, an invoice, a party — and opens the
 * record on select. Bookings, containers and invoices are already in the
 * store, so they match as you type; parties are 230-odd rows in Postgres and
 * are queried, debounced.
 */

type Hit = {
  id: string
  group: 'Bookings' | 'Containers' | 'Bills of Lading' | 'Invoices' | 'Parties'
  title: string
  subtitle: string
  to: string
}

const MAX_PER_GROUP = 5

export function GlobalSearch() {
  const navigate = useNavigate()
  const { bookings, containers, invoices, blStates } = useDataStore()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [parties, setParties] = useState<Hit[]>([])
  const [cursor, setCursor] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  const needle = q.trim().toUpperCase()

  // Parties live in Postgres, not the store, so they are searched there.
  useEffect(() => {
    if (needle.length < 2) {
      setParties([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      // Commas and percent signs are PostgREST filter syntax, not search text.
      const safe = q.trim().replace(/[,%]/g, ' ')
      supabase
        .from('parties')
        .select('id, code, display_name, legal_name, city')
        .or(`display_name.ilike.%${safe}%,legal_name.ilike.%${safe}%,code.ilike.%${safe}%`)
        .order('display_name', { ascending: true })
        .limit(MAX_PER_GROUP)
        .then(({ data }) => {
          if (cancelled) return
          setParties(
            (
              (data as {
                id: string
                code: string | null
                display_name: string | null
                legal_name: string
                city: string | null
              }[]) ?? []
            ).map((p) => ({
              id: p.id,
              group: 'Parties' as const,
              title: p.display_name || p.legal_name,
              subtitle: [p.code, p.city].filter(Boolean).join(' · ') || 'Party',
              to: `/master/parties/${p.code ?? p.id}`,
            })),
          )
        })
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q, needle])

  const hits = useMemo<Hit[]>(() => {
    if (needle.length < 2) return []
    const has = (...fields: (string | null | undefined)[]) =>
      fields.some((f) => f && f.toUpperCase().includes(needle))

    const bookingHits: Hit[] = bookings
      .filter((b) =>
        has(
          b.bookingRef,
          b.hblNo,
          b.bookingPartyName,
          b.vesselName,
          b.voyageNo,
          b.pol,
          b.pod,
          ...(b.containerDetails ?? []).map((c) => c.containerNo),
        ),
      )
      .slice(0, MAX_PER_GROUP)
      .map((b) => ({
        id: b.id,
        group: 'Bookings' as const,
        title: b.bookingRef,
        subtitle: `${b.bookingPartyName} · ${b.pol || '—'} → ${b.pod || '—'}`,
        to: b.module === 'nvocc' ? `/nvocc/${b.id}` : `/freight/${b.id}`,
      }))

    const blHits: Hit[] = blStates
      .filter((s) => has(s.currentFields?.blNumber, s.currentFields?.blNumberManual))
      .slice(0, MAX_PER_GROUP)
      .map((s) => {
        const b = bookings.find((x) => x.id === s.bookingId)
        return {
          id: s.bookingId,
          group: 'Bills of Lading' as const,
          title: s.currentFields?.blNumber || s.currentFields?.blNumberManual || 'BL draft',
          subtitle: b ? `${b.bookingRef} · ${s.lifecycle}` : s.lifecycle,
          to: `/nvocc/${s.bookingId}`,
        }
      })

    const containerHits: Hit[] = containers
      .filter((c) => has(c.containerNo))
      .slice(0, MAX_PER_GROUP)
      .map((c) => ({
        id: c.id,
        group: 'Containers' as const,
        title: c.containerNo,
        subtitle: [c.status, c.depot ?? c.port].filter(Boolean).join(' · ') || 'Container',
        to: '/mnr',
      }))

    const invoiceHits: Hit[] = invoices
      .filter((i) => has(i.invoiceNo))
      .slice(0, MAX_PER_GROUP)
      .map((i) => {
        const b = bookings.find((x) => x.id === i.bookingId)
        return {
          id: i.id,
          group: 'Invoices' as const,
          title: i.invoiceNo,
          subtitle: `${i.type} · ${i.status}${b ? ` · ${b.bookingRef}` : ''}`,
          to: b ? `/nvocc/${b.id}` : '/approvals',
        }
      })

    return [...bookingHits, ...blHits, ...containerHits, ...invoiceHits, ...parties]
  }, [needle, bookings, blStates, containers, invoices, parties])

  useEffect(() => setCursor(0), [needle])

  // Close when the click lands outside, not on a blur — a blur fires before
  // the click on a result registers, which would swallow the selection.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const go = (hit: Hit) => {
    setOpen(false)
    setQ('')
    navigate(hit.to)
  }

  let lastGroup = ''

  return (
    <div ref={boxRef} className="relative flex-1 max-w-md">
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="text"
        value={q}
        placeholder="Search booking, BL, container, invoice..."
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setCursor((c) => Math.min(c + 1, hits.length - 1))
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setCursor((c) => Math.max(c - 1, 0))
          }
          if (e.key === 'Enter' && hits[cursor]) {
            e.preventDefault()
            go(hits[cursor])
          }
        }}
        className="w-full rounded-input border border-[#E5E7EB] bg-surface py-2.5 pl-10 pr-9 text-sm text-heading placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-line"
      />
      {q && (
        <button
          type="button"
          onClick={() => {
            setQ('')
            setOpen(false)
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-heading"
        >
          <X size={14} />
        </button>
      )}

      {open && needle.length >= 2 && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-[70vh] overflow-y-auto rounded-btn border border-line bg-surface py-1 shadow-card">
          {hits.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted">
              Nothing matches “{q.trim()}”.
            </p>
          ) : (
            hits.map((hit, i) => {
              const header = hit.group !== lastGroup ? hit.group : null
              lastGroup = hit.group
              return (
                <div key={`${hit.group}-${hit.id}-${hit.title}`}>
                  {header && (
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {header}
                    </p>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(hit)}
                    className={`block w-full px-3 py-2 text-left ${i === cursor ? 'bg-surface-2' : ''}`}
                  >
                    <span className="block font-mono text-[12px] font-medium text-heading">{hit.title}</span>
                    <span className="block truncate text-[11px] text-muted">{hit.subtitle}</span>
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
