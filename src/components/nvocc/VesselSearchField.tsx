import { useEffect, useState } from 'react'
import { TextInput } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'

export type VesselOption = { id: string; name: string; code: string | null }

/** Search-and-select against the real Vessels master — never free text, and
    no inline "add new" (new vessels can only be added from Master Data →
    Vessels). Mirrors the vessel search in VesselLegsSection.tsx. */
export function VesselSearchField({
  value,
  onSelect,
}: {
  value: string
  onSelect: (vessel: VesselOption) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<VesselOption[]>([])
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
        .from('vessels')
        .select('id,name,code')
        .ilike('name', `%${safe}%`)
        .order('name', { ascending: true })
        .limit(8)
        .then(({ data }) => setResults((data as VesselOption[]) ?? []))
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div className="relative">
      <TextInput
        value={open ? query : value}
        placeholder="Search vessel…"
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
          {results.map((v) => (
            <button
              key={v.id}
              type="button"
              onMouseDown={() => {
                onSelect(v)
                setQuery('')
                setOpen(false)
              }}
              className="block w-full px-3 py-2 text-left text-[12px] text-body hover:bg-surface-2"
            >
              {v.name}
              {v.code ? ` (${v.code})` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
