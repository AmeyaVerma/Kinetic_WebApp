import { useEffect, useState } from 'react'
import { TextInput } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'
import type { PartyRole } from '../../lib/types'

export type PartyOption = { id: string; name: string; code: string | null }

/** Search-and-select against the real Parties master, filtered to the given
    role(s) — never free text, and no inline "add new" (new parties can only
    be added from Master Data → Parties). */
export function PartySearchField({
  value,
  roles,
  placeholder,
  onSelect,
}: {
  value: string
  roles: PartyRole[]
  placeholder: string
  onSelect: (party: PartyOption) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PartyOption[]>([])
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
        .from('parties')
        .select('id,legal_name,display_name,code,party_role')
        .in('party_role', roles)
        .ilike('display_name', `%${safe}%`)
        .order('display_name', { ascending: true })
        .limit(8)
        .then(({ data }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rows = (data as any[]) ?? []
          setResults(rows.map((p) => ({ id: p.id, name: p.display_name || p.legal_name, code: p.code })))
        })
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                onSelect(p)
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
