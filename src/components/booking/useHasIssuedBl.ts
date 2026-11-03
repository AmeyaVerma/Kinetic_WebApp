import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

/**
 * Whether the booking has a BL that is Issued or Released.
 *
 * While it does, the booking's POD agent and freight terms are locked in the
 * database; changing them needs an approved BL amendment. This only lets the
 * screen say so up front instead of offering a change the database will
 * refuse. The lock itself is the database's.
 */
export function useHasIssuedBl(bookingDbId: string | undefined): boolean {
  const [locked, setLocked] = useState(false)
  useEffect(() => {
    if (!bookingDbId) {
      setLocked(false)
      return
    }
    let cancelled = false
    void supabase
      .from('bls')
      .select('id', { count: 'exact', head: true })
      .eq('booking_id', bookingDbId)
      .in('status', ['Issued', 'Released'])
      .then(({ count }) => {
        if (!cancelled) setLocked((count ?? 0) > 0)
      })
    return () => {
      cancelled = true
    }
  }, [bookingDbId])
  return locked
}
