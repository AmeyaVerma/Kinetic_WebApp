import { useEffect, useState } from 'react'
import { TextInput } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'

/** Search-and-select against the real Sea Ports master — never free text,
    and no inline "add new" (new ports can only be added from Master Data →
    Ports/ICDs/Terminals → Sea Ports). Writes just the port name, matching
    the plain-string pol/pod/portOfReceipt/finalPlaceOfDischarge fields on
    Booking. */
export function PortSearchField({
  value,
  placeholder,
  onSelect,
}: {
  value: string
  placeholder: string
  onSelect: (name: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: string; name: string; code: string | null }[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      const safe = q.replace(/[,%]/g, ' ')
      supabase
        .from('sea_ports')
        .select('id,name,code')
        .or(`name.ilike.%${safe}%,code.ilike.%${safe}%`)
        .order('name', { ascending: true })
        .limit(8)
        .then(({ data }) => setResults((data as { id: string; name: string; code: string | null }[]) ?? []))
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div className="relative">
      <TextInput
        value={open ? query : value}
        placeholder={placeholder}
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
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-btn border border-line bg-surface shadow-lg">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => {
                onSelect(p.name)
                setQuery('')
                setOpen(false)
              }}
              className="block w-full px-3 py-2 text-left text-[12px] text-body hover:bg-surface-2"
            >
              {p.name}
              {p.code ? ` (${p.code})` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
