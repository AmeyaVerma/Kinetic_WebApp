import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Select } from '../ui/Field'

interface DepotOption {
  id: string
  name: string
  city: string | null
  status: string
}

/**
 * A depot picker that reads the Empty Container Yard master and nothing else.
 *
 * It offers ACTIVE depots only, and that is the point rather than a detail.
 * The 28 yards Siddharth supplied were imported Inactive because 10 of them
 * name-match a depot that already exists, and until somebody decides which of
 * each pair is real, offering both would mean two bookings at "the same" yard
 * pointing at different rows. An Inactive depot already saved on a booking is
 * still shown, so an old booking never silently loses its depot.
 *
 * The same master serves both roles. v2 is explicit that the Depots master
 * gets no "type" restriction -- any depot can be a pickup or a drop-off.
 */
export function DepotPicker({
  value,
  onChange,
  disabled,
  placeholder = 'Choose a depot…',
}: {
  value: string | null | undefined
  onChange: (id: string | null) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [options, setOptions] = useState<DepotOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { supabase } = await import('../../lib/supabaseClient')
      const { data } = await supabase
        .from('empty_depots')
        .select('id, name, city, status')
        .order('name')
      if (!cancelled) {
        setOptions((data as DepotOption[]) ?? [])
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const active = options.filter((o) => o.status === 'Active')
  // A depot already on this booking stays selectable even if it has since
  // been made Inactive -- otherwise saving any other field would clear it.
  const current = value ? options.find((o) => o.id === value) : undefined
  const shown =
    current && current.status !== 'Active' ? [current, ...active] : active

  const inactiveCount = options.length - active.length

  return (
    <div className="space-y-1">
      <Select
        value={value ?? ''}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{loading ? 'Loading depots…' : placeholder}</option>
        {shown.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
            {o.city ? ` — ${o.city}` : ''}
            {o.status !== 'Active' ? ' (inactive)' : ''}
          </option>
        ))}
      </Select>
      {!loading && inactiveCount > 0 && (
        <p className="text-[11px] text-muted">
          {inactiveCount} more {inactiveCount === 1 ? 'depot is' : 'depots are'} imported but
          inactive, including possible duplicates of these.{' '}
          <Link to="/master/vendors/empty-yards" className="text-link hover:underline">
            Review them
          </Link>{' '}
          to make them selectable.
        </p>
      )}
    </div>
  )
}
