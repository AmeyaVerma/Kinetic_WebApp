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
  const { bookings } = useDataStore()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [parties, setParties] = useState<Hit[]>([])
  /**
   * BLs, invoices and containers are read from Postgres, not from the store.
   *
   * They used to come from the store, and all three missed:
   *  - a BL was matched on `currentFields.blNumber`, but the real number is
   *    the `bl_number` COLUMN -- current_fields holds the editable BL fields,
   *    and the number was never in it, so no BL was ever findable;
   *  - `invoices` in the store is still the seeded list, while real invoices
   *    live in Postgres, so searching a real invoice number found nothing;
   *  - `containers` starts empty and is filled only by the containers master
   *    page, so a container was findable only after visiting that screen.
   *
   * The search box offers "booking, BL, container, invoice". Three of those
   * four were decorative.
   */
  const [dbHits, setDbHits] = useState<Hit[]>([])
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

  useEffect(() => {
    if (needle.length < 2) {
      setDbHits([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      const safe = q.trim().replace(/[,%]/g, ' ')
      void (async () => {
        const [bls, invs, cons] = await Promise.all([
          supabase
            .from('bl_state')
            .select('booking_id, bl_number, lifecycle, bookings(booking_ref)')
            .ilike('bl_number', `%${safe}%`)
            .limit(MAX_PER_GROUP),
          supabase
            .from('invoices')
            .select('id, invoice_no, type, status, booking_id, bookings(booking_ref)')
            .ilike('invoice_no', `%${safe}%`)
            .limit(MAX_PER_GROUP),
          supabase
            .from('containers')
            .select('id, container_no, status, depot, port')
            .ilike('container_no', `%${safe}%`)
            .limit(MAX_PER_GROUP),
        ])
        if (cancelled) return

        /* eslint-disable @typescript-eslint/no-explicit-any */
        const blHits: Hit[] = ((bls.data as any[]) ?? []).map((r) => ({
          id: r.booking_id,
          group: 'Bills of Lading' as const,
          title: r.bl_number,
          subtitle: [r.bookings?.booking_ref, r.lifecycle].filter(Boolean).join(' · '),
          to: `/nvocc/${r.bookings?.booking_ref ?? r.booking_id}`,
        }))

        const invHits: Hit[] = ((invs.data as any[]) ?? []).map((r) => ({
          id: r.id,
          group: 'Invoices' as const,
          title: r.invoice_no,
          subtitle: [r.type, r.status, r.bookings?.booking_ref].filter(Boolean).join(' · '),
          to: r.bookings?.booking_ref ? `/nvocc/${r.bookings.booking_ref}` : '/accounts',
        }))

        const conHits: Hit[] = ((cons.data as any[]) ?? []).map((r) => ({
          id: r.id,
          group: 'Containers' as const,
          title: r.container_no,
          subtitle: [r.status, r.depot ?? r.port].filter(Boolean).join(' · ') || 'Container',
          to: '/mnr',
        }))
        /* eslint-enable @typescript-eslint/no-explicit-any */

        setDbHits([...blHits, ...conHits, ...invHits])
      })()
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

    return [...bookingHits, ...dbHits, ...parties]
  }, [needle, bookings, dbHits, parties])

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
