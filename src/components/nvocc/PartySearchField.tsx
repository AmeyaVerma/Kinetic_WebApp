import { useEffect, useState } from 'react'
import { TextInput } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'
import type { PartyRole } from '../../lib/types'

export type PartyOption = { id: string; name: string; code: string | null }

/** The commercial relationship a picker is looking for, as held in
    `parties.roles`. Distinct from PartyRole (Exporter / Importer /
    Forwarder), which is what a party is on a shipment. */
export type CommercialRole = 'Customer' | 'Agent' | 'Vendor'

/**
 * Search-and-select against the real Parties master. Never free text, and no
 * inline "add new" — a new firm is created in Master Data → Parties.
 *
 * Spec M4: an agent picker should offer agents, not all 230 parties. But no
 * party was tagged as an agent, so filtering strictly would have offered
 * nothing at all and stopped work. Instead the list is ordered: parties
 * already carrying the role come first, everyone else is below under a
 * heading, and **choosing someone from below tags them with that role**. The
 * master organises itself as the work happens, which is how Siddharth asked
 * for CHAs to be handled too, rather than needing all 230 classified up front.
 */
export function PartySearchField({
  value,
  roles,
  commercialRole,
  placeholder,
  onSelect,
}: {
  value: string
  roles: PartyRole[]
  /** When set, parties holding this role are offered first and picking any
      other party adds the role to it. */
  commercialRole?: CommercialRole
  placeholder: string
  onSelect: (party: PartyOption) => void
}) {
  const [query, setQuery] = useState('')
  const [tagged, setTagged] = useState<PartyOption[]>([])
  const [others, setOthers] = useState<PartyOption[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const q = query.trim()
    const t = setTimeout(() => {
      const safe = q.replace(/[,%]/g, ' ')

      const base = () => {
        let req = supabase
          .from('parties')
          .select('id,legal_name,display_name,code,roles,party_role')
          // party_role is unset on every record in the master today, so an
          // `.in()` filter alone matched nothing. Null means "role not
          // recorded", which must not hide the party.
          .or('party_role.in.(' + roles.join(',') + '),party_role.is.null')
        if (safe) {
          req = req.or(`display_name.ilike.%${safe}%,legal_name.ilike.%${safe}%,code.ilike.%${safe}%`)
        }
        return req.order('display_name', { ascending: true })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toOption = (p: any): PartyOption => ({
        id: p.id,
        name: p.display_name || p.legal_name,
        code: p.code,
      })

      if (!commercialRole) {
        base()
          .limit(q ? 8 : 12)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .then(({ data }) => {
            setTagged(((data as any[]) ?? []).map(toOption))
            setOthers([])
          })
        return
      }

      Promise.all([
        base().contains('roles', [commercialRole]).limit(8),
        base().not('roles', 'cs', `{${commercialRole}}`).limit(q ? 8 : 10),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ]).then(([withRole, without]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setTagged((((withRole.data as any[]) ?? [])).map(toOption))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setOthers((((without.data as any[]) ?? [])).map(toOption))
      })
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, commercialRole])

  /** Record what this party evidently is, so the next search finds them
      straight away. Failure is logged, never blocking: the booking matters
      more than the tag. */
  const tagParty = async (id: string) => {
    if (!commercialRole) return
    const { data, error } = await supabase.from('parties').select('roles').eq('id', id).single()
    if (error || !data) return
    const current: string[] = (data.roles as string[]) ?? []
    if (current.includes(commercialRole)) return
    const { error: updateError } = await supabase
      .from('parties')
      .update({ roles: [...current, commercialRole] })
      .eq('id', id)
    if (updateError) console.error('PartySearchField: could not tag party', updateError)
  }

  const choose = (p: PartyOption, needsTag: boolean) => {
    onSelect(p)
    setQuery('')
    setOpen(false)
    if (needsTag) void tagParty(p.id)
  }

  const nothingFound = tagged.length === 0 && others.length === 0

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
      {open && (
        <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-btn border border-line bg-surface shadow-lg">
          {nothingFound && (
            <p className="px-3 py-2.5 text-[12px] text-muted">
              {query.trim() ? `No party matches “${query.trim()}”.` : 'No parties in the master yet.'}
            </p>
          )}

          {tagged.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => choose(p, false)}
              className="block w-full px-3 py-2 text-left text-[12px] text-body hover:bg-surface-2"
            >
              {p.name}
              {p.code ? ` (${p.code})` : ''}
            </button>
          ))}

          {others.length > 0 && commercialRole && (
            <>
              <p className="border-t border-line bg-surface-2/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {tagged.length > 0 ? 'Other parties' : 'No ' + commercialRole.toLowerCase() + 's yet — other parties'}
                <span className="ml-1 font-normal normal-case tracking-normal">
                  · picking one marks it as {commercialRole === 'Agent' ? 'an' : 'a'} {commercialRole}
                </span>
              </p>
              {others.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={() => choose(p, true)}
                  className="block w-full px-3 py-2 text-left text-[12px] text-muted hover:bg-surface-2 hover:text-body"
                >
                  {p.name}
                  {p.code ? ` (${p.code})` : ''}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
