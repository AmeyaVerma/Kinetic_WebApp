import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { TextInput } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'

export type VendorOption = { id: string; name: string; roles: string[] }

/**
 * Pick a vendor, or add one without leaving the booking.
 *
 * Siddharth's instruction: don't build a vendor master to fill in up front —
 * add the vendor from the booking, store it, and suggest it next time. So
 * vendors the business has already used for this role come first, then any
 * other vendor on file, then the option to add a new one.
 *
 * Adding goes through `add_vendor` in the database rather than a plain
 * insert, because the one firm rule he gave was no duplicates. If the name is
 * already on file that function returns the existing vendor and records the
 * new role against it, so "CMA CGM" cannot become two rows by being typed
 * twice — and the person adding it sees "already on file" rather than an
 * error about a constraint.
 */
export function VendorSearchField({
  value,
  role,
  placeholder,
  disabled,
  onSelect,
}: {
  value: string
  /** Vendors already used in this capacity are offered first. */
  role?: string
  placeholder?: string
  disabled?: boolean
  onSelect: (vendor: VendorOption) => void
}) {
  const [query, setQuery] = useState('')
  const [forRole, setForRole] = useState<VendorOption[]>([])
  const [others, setOthers] = useState<VendorOption[]>([])
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    if (!open) return
    const run = ++seq.current
    const t = setTimeout(async () => {
      const safe = query.trim().replace(/[,%]/g, ' ')
      let req = supabase.from('vendors').select('id,name,roles').eq('active', true)
      if (safe) req = req.ilike('name', `%${safe}%`)
      const { data } = await req.order('name', { ascending: true }).limit(25)
      if (run !== seq.current) return
      const rows = ((data as VendorOption[]) ?? [])
      if (role) {
        setForRole(rows.filter((v) => (v.roles ?? []).includes(role)))
        setOthers(rows.filter((v) => !(v.roles ?? []).includes(role)))
      } else {
        setForRole(rows)
        setOthers([])
      }
    }, 220)
    return () => clearTimeout(t)
  }, [query, open, role])

  const choose = (v: VendorOption) => {
    onSelect(v)
    setQuery('')
    setOpen(false)
    setNote(null)
  }

  const add = async () => {
    const name = newName.trim()
    if (name.length < 2) return
    setBusy(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('add_vendor', {
      p_name: name,
      p_role: role ?? null,
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    // The OUT parameters are prefixed because `roles` collides with the
    // column of the same name inside the function (see migration 0068).
    const row = (Array.isArray(data) ? data[0] : data) as
      | { out_id: string; out_name: string; out_roles: string[]; out_created: boolean }
      | undefined
    if (!row) {
      setError('Could not add that vendor.')
      return
    }
    // An existing firm is not an error, so say which happened and carry on.
    setNote(row.out_created ? `Added ${row.out_name}` : `${row.out_name} was already on file`)
    setAdding(false)
    setNewName('')
    choose({ id: row.out_id, name: row.out_name, roles: row.out_roles })
  }

  if (adding) {
    return (
      <div className="space-y-1">
        <TextInput
          autoFocus
          value={newName}
          placeholder={role ? `New ${role.toLowerCase()} vendor name` : 'New vendor name'}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); void add() }
            if (e.key === 'Escape') { setAdding(false); setNewName(''); setError(null) }
          }}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void add()}
            disabled={busy || newName.trim().length < 2}
            className="text-xs font-medium text-link hover:underline disabled:text-muted disabled:no-underline"
          >
            {busy ? 'Saving…' : 'Save vendor'}
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setNewName(''); setError(null) }}
            className="text-xs text-muted hover:text-heading"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="relative">
      <TextInput
        value={open ? query : value}
        placeholder={placeholder ?? 'Search vendor…'}
        disabled={disabled}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true); setNote(null) }}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
      />
      {note && !open && <p className="mt-0.5 text-[11px] text-primary">{note}</p>}

      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-btn border border-line bg-surface shadow-lg">
          {forRole.map((v) => (
            <button
              key={v.id}
              type="button"
              onMouseDown={() => choose(v)}
              className="block w-full px-3 py-2 text-left text-[12px] text-body hover:bg-surface-2"
            >
              {v.name}
            </button>
          ))}

          {others.length > 0 && (
            <>
              <p className="border-t border-line bg-surface-2/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {forRole.length > 0 ? 'Other vendors' : 'No ' + (role ?? 'vendor') + ' vendors yet'}
                {role && (
                  <span className="ml-1 font-normal normal-case tracking-normal">
                    · picking one records it as {role.toLowerCase()}
                  </span>
                )}
              </p>
              {others.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onMouseDown={() => choose(v)}
                  className="block w-full px-3 py-2 text-left text-[12px] text-muted hover:bg-surface-2 hover:text-body"
                >
                  {v.name}
                </button>
              ))}
            </>
          )}

          {forRole.length === 0 && others.length === 0 && (
            <p className="px-3 py-2.5 text-[12px] text-muted">
              {query.trim() ? `No vendor matches “${query.trim()}”.` : 'No vendors on file yet.'}
            </p>
          )}

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              setNewName(query.trim())
              setAdding(true)
              setOpen(false)
            }}
            className="flex w-full items-center gap-1.5 border-t border-line px-3 py-2 text-left text-[12px] font-medium text-link hover:bg-surface-2"
          >
            <Plus size={12} />
            {query.trim() ? `Add “${query.trim()}” as a vendor` : 'Add a new vendor'}
          </button>
        </div>
      )}
    </div>
  )
}
