import { useEffect, useRef, useState } from 'react'
import { TextInput } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'

type Port = { id: string; name: string; code: string | null }

/**
 * Search-and-select against the real Sea Ports master — never free text, and
 * no inline "add new" (ports are added in Master Data → Ports/ICDs/Terminals).
 * Writes just the port name, matching the plain-string pol / pod /
 * portOfReceipt / finalPlaceOfDischarge fields on Booking.
 *
 * Spec M12: the list used to open on A-to-Z worldwide with no loading or
 * empty state, so focusing it showed twelve arbitrary ports and a wrong
 * search looked identical to a slow one. Now the ports this business actually
 * sails to come first, and both states say what is happening.
 */

/** Ports already used on a booking, fetched once per session and shared by
    every picker — these are the dozen or so that matter in practice. */
let frequentPorts: string[] | null = null
let frequentPortsLoading: Promise<string[]> | null = null

function loadFrequentPorts(): Promise<string[]> {
  if (frequentPorts) return Promise.resolve(frequentPorts)
  if (frequentPortsLoading) return frequentPortsLoading
  frequentPortsLoading = (async () => {
    const { data } = await supabase
      .from('bookings')
      .select('pol,pod,port_of_receipt,final_place_of_discharge')
      .limit(500)
    const counts = new Map<string, number>()
    for (const row of (data as Record<string, string | null>[]) ?? []) {
      for (const key of ['pol', 'pod', 'port_of_receipt', 'final_place_of_discharge']) {
        const name = (row[key] ?? '').trim()
        if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
      }
    }
    frequentPorts = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name)
    return frequentPorts
  })()
  return frequentPortsLoading
}

export function PortSearchField({
  value,
  placeholder,
  disabled,
  onSelect,
}: {
  value: string
  placeholder: string
  disabled?: boolean
  onSelect: (name: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Port[]>([])
  const [frequent, setFrequent] = useState<Port[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    setLoading(true)
    const run = ++seq.current
    const t = setTimeout(async () => {
      const safe = q.replace(/[,%]/g, ' ')

      // With nothing typed, lead with the ports this business uses.
      if (!safe && frequent.length === 0) {
        const names = await loadFrequentPorts()
        if (names.length > 0) {
          const { data } = await supabase.from('sea_ports').select('id,name,code').in('name', names)
          if (run === seq.current) setFrequent(((data as Port[]) ?? []))
        }
      }

      let req = supabase.from('sea_ports').select('id,name,code')
      if (safe) req = req.or(`name.ilike.%${safe}%,code.ilike.%${safe}%`)
      const { data } = await req.order('name', { ascending: true }).limit(q ? 10 : 12)
      // A slower earlier request must not overwrite a newer one's results.
      if (run !== seq.current) return
      setResults(((data as Port[]) ?? []))
      setLoading(false)
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open])

  const choose = (name: string) => {
    onSelect(name)
    setQuery('')
    setOpen(false)
  }

  const typing = query.trim().length > 0
  const frequentShown = !typing ? frequent.filter((p) => p.name !== value) : []
  const frequentNames = new Set(frequentShown.map((p) => p.name))
  const rest = results.filter((p) => !frequentNames.has(p.name))

  const row = (p: Port, muted = false) => (
    <button
      key={p.id}
      type="button"
      onMouseDown={() => choose(p.name)}
      className={`block w-full px-3 py-2 text-left text-[12px] hover:bg-surface-2 ${
        muted ? 'text-muted hover:text-body' : 'text-body'
      }`}
    >
      {p.name}
      {p.code ? ` (${p.code})` : ''}
    </button>
  )

  return (
    <div className="relative">
      <TextInput
        value={open ? query : value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setQuery('')
          setOpen(true)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-btn border border-line bg-surface shadow-lg">
          {loading && results.length === 0 && (
            <p className="px-3 py-2.5 text-[12px] text-muted">Searching ports…</p>
          )}

          {!loading && results.length === 0 && frequentShown.length === 0 && (
            <p className="px-3 py-2.5 text-[12px] text-muted">
              {typing ? `No port matches “${query.trim()}”.` : 'No ports in the master yet.'}
            </p>
          )}

          {frequentShown.length > 0 && (
            <>
              <p className="bg-surface-2/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                Frequently used
              </p>
              {frequentShown.map((p) => row(p))}
              {rest.length > 0 && (
                <p className="border-t border-line bg-surface-2/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  All ports
                </p>
              )}
            </>
          )}

          {rest.map((p) => row(p, frequentShown.length > 0))}
        </div>
      )}
    </div>
  )
}
