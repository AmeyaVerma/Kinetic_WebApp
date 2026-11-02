import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'

export interface HsLine {
  id: string
  hs_code: string
  cargo_description: string | null
  packages: number | null
  gross_weight_kg: number | null
  hs_codes?: { description: string; code_dotted: string } | null
}

interface Hit {
  code: string
  code_dotted: string
  description: string
}

/**
 * The HS codes on a booking, one cargo line each (spec v2).
 *
 * A code is chosen from the HS master, never typed free, so a booking cannot
 * carry a code that does not exist. Searching accepts digits (with or without
 * dots) or words from the description. These lines print under the cargo on
 * the BL.
 *
 * Packages and weight on a line are optional and are NOT summed against the
 * booking: the BL's own container split is what is checked at issue, and
 * a second allocation check here would just disagree with it.
 */
export function HsLines({ bookingDbId, disabled }: { bookingDbId: string | undefined; disabled: boolean }) {
  const [lines, setLines] = useState<HsLine[]>([])
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!bookingDbId) return
    const { data } = await supabase
      .from('booking_hs_lines')
      .select('id, hs_code, cargo_description, packages, gross_weight_kg, hs_codes(description, code_dotted)')
      .eq('booking_id', bookingDbId)
      .order('sort_order')
      .order('created_at')
    setLines((data as unknown as HsLine[]) ?? [])
  }, [bookingDbId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setHits([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      const digits = q.replace(/[.\s]/g, '')
      const filter = /^\d+$/.test(digits)
        ? `code.like.${digits}%`
        : `description.ilike.%${q.replace(/[%,()]/g, ' ')}%`
      const { data } = await supabase
        .from('hs_codes')
        .select('code, code_dotted, description')
        .eq('status', 'Active')
        .or(filter)
        .order('code')
        .limit(12)
      if (!cancelled) setHits((data as Hit[]) ?? [])
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  const add = async (h: Hit) => {
    if (!bookingDbId) return
    setError(null)
    const { error: err } = await supabase
      .from('booking_hs_lines')
      .insert({ booking_id: bookingDbId, hs_code: h.code, sort_order: lines.length })
    if (err) {
      setError(err.code === '23505' ? `${h.code_dotted} is already on this booking.` : err.message)
      return
    }
    setQuery('')
    setHits([])
    await load()
  }

  const patch = async (id: string, fields: Partial<Pick<HsLine, 'cargo_description' | 'packages' | 'gross_weight_kg'>>) => {
    setError(null)
    const { error: err, count } = await supabase
      .from('booking_hs_lines')
      .update(fields, { count: 'exact' })
      .eq('id', id)
    if (err) setError(err.message)
    else if (!count) setError('That change was not saved. You may not have permission.')
  }

  const remove = async (id: string) => {
    setError(null)
    const { error: err, count } = await supabase
      .from('booking_hs_lines')
      .delete({ count: 'exact' })
      .eq('id', id)
    if (err) setError(err.message)
    else if (!count) setError('That line was not removed. You may not have permission.')
    else await load()
  }

  if (!bookingDbId) return null

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">HS codes and cargo lines</p>

      {lines.length === 0 && <p className="text-xs text-muted">No HS code on this booking yet.</p>}

      <ul className="space-y-2">
        {lines.map((l) => (
          <li key={l.id} className="grid gap-2 rounded-btn border border-line p-2.5 sm:grid-cols-[1fr_2fr_90px_110px_auto]">
            <div>
              <p className="font-mono text-xs">{l.hs_codes?.code_dotted ?? l.hs_code}</p>
              <p className="line-clamp-2 text-[11px] text-muted">{l.hs_codes?.description}</p>
            </div>
            <TextInput
              placeholder="Cargo for this code"
              defaultValue={l.cargo_description ?? ''}
              disabled={disabled}
              onBlur={(e) => void patch(l.id, { cargo_description: e.target.value.trim() || null })}
            />
            <TextInput
              placeholder="Pkgs"
              inputMode="numeric"
              defaultValue={l.packages ?? ''}
              disabled={disabled}
              onBlur={(e) => void patch(l.id, { packages: e.target.value ? Number(e.target.value) : null })}
            />
            <TextInput
              placeholder="Weight kg"
              inputMode="decimal"
              defaultValue={l.gross_weight_kg ?? ''}
              disabled={disabled}
              onBlur={(e) => void patch(l.id, { gross_weight_kg: e.target.value ? Number(e.target.value) : null })}
            />
            {!disabled && (
              <Button size="sm" variant="ghost" aria-label="Remove HS line" onClick={() => void remove(l.id)}>
                <Trash2 size={13} />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {!disabled && (
        <div className="relative max-w-xl">
          <div className="flex items-center gap-2">
            <Plus size={14} className="text-primary" />
            <TextInput
              placeholder="Add an HS code: type digits or a product name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {hits.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-btn border border-line bg-surface shadow-card">
              {hits.map((h) => (
                <li key={h.code}>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-surface-2"
                    onClick={() => void add(h)}
                  >
                    <span className="font-mono">{h.code_dotted}</span>
                    <span className="ml-2 text-muted">{h.description.slice(0, 90)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
