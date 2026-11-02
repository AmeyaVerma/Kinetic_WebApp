import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Boxes } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import type { Booking } from '../../lib/types'

interface Assignment {
  id: string
  bl_id: string
  container_no: string
  packages: number | null
  gross_weight_kg: number | null
  role: 'House' | 'Master'
}

/**
 * Which containers go on which BL (spec v2).
 *
 * The user ticks containers for the BL that is open, and the panel shows what
 * is still unassigned across the booking. Two rules sit behind it, both
 * enforced by the database in migration 0088 rather than here, so a stray
 * script cannot get around them:
 *
 *  - A container may sit on one House BL AND the Master, but never on two
 *    House BLs. The tick is refused with that reason.
 *  - Totals are compared against the booking. v2 blocks issue when the
 *    packages or weight assigned across a type's BLs exceed what the booking
 *    says, so the overage is shown here plainly rather than discovered on a
 *    printed document.
 *
 * Packages and weight default from the booking's own container line, because
 * that is where they are already recorded; a BL that carries part of a
 * container's cargo can be edited down.
 */
export function BlContainerSplit({
  booking,
  blId,
  blRole,
  disabled,
}: {
  booking: Booking
  blId: string
  blRole: 'House' | 'Master'
  disabled?: boolean
}) {
  const [rows, setRows] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const bookingDbId = booking.dbId

  const load = useCallback(async () => {
    if (!bookingDbId) return
    setLoading(true)
    const { data } = await supabase
      .from('bl_containers')
      .select('id, bl_id, container_no, packages, gross_weight_kg, role')
      .eq('booking_id', bookingDbId)
    setRows((data as Assignment[]) ?? [])
    setLoading(false)
  }, [bookingDbId])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * Every container the booking declares, from BOTH places it records them.
   *
   * containerDetails (the per-container table) and containerNos (the flat
   * list) disagree on real bookings: KLNVO2627000025 has WGMU0129120 in
   * containerNos and two detail rows with no number at all, while
   * KLNVO2627000026 has the opposite. Reading either alone shows an empty
   * split panel on half the bookings, so both are merged and the detail row
   * wins when it exists, because it carries the packages and weight too.
   */
  const declared = useMemo(() => {
    const fromDetails = (booking.containerDetails ?? []).filter((c) => c.containerNo?.trim())
    const seen = new Set(fromDetails.map((c) => c.containerNo.trim()))
    const fromList = (booking.containerNos ?? [])
      .map((n) => n?.trim())
      .filter((n): n is string => !!n && !seen.has(n))
      .map((containerNo) => ({
        containerNo,
        containerType: booking.containerType ?? '',
        noOfPkgs: '',
        grossWeight: '',
      }))
    return [...fromDetails, ...fromList]
  }, [booking.containerDetails, booking.containerNos, booking.containerType])

  const onThisBl = useMemo(
    () => new Map(rows.filter((r) => r.bl_id === blId).map((r) => [r.container_no, r])),
    [rows, blId],
  )

  /** Unassigned means: on no HOUSE BL. The Master covers, it does not consume. */
  const unassigned = useMemo(() => {
    const housed = new Set(rows.filter((r) => r.role === 'House').map((r) => r.container_no))
    return declared.filter((c) => !housed.has(c.containerNo))
  }, [declared, rows])

  const totals = useMemo(() => {
    const mine = rows.filter((r) => r.bl_id === blId)
    return {
      packages: mine.reduce((a, r) => a + (r.packages ?? 0), 0),
      weight: mine.reduce((a, r) => a + Number(r.gross_weight_kg ?? 0), 0),
    }
  }, [rows, blId])

  const bookingTotals = useMemo(
    () => ({
      packages: booking.packages ?? 0,
      weight: Number(booking.grossWeightKg ?? 0),
    }),
    [booking.packages, booking.grossWeightKg],
  )

  const overPackages = bookingTotals.packages > 0 && totals.packages > bookingTotals.packages
  const overWeight = bookingTotals.weight > 0 && totals.weight > bookingTotals.weight

  const toggle = async (containerNo: string) => {
    if (!bookingDbId || disabled) return
    setError(null)
    const existing = onThisBl.get(containerNo)
    if (existing) {
      const { error: err } = await supabase.from('bl_containers').delete().eq('id', existing.id)
      if (err) setError(err.message)
      await load()
      return
    }
    const line = declared.find((c) => c.containerNo === containerNo)
    // booking_id and role are filled by the trigger from the parent BL; they
    // are passed only because the columns are NOT NULL.
    const { error: err } = await supabase.from('bl_containers').insert({
      bl_id: blId,
      booking_id: bookingDbId,
      role: blRole,
      container_no: containerNo,
      packages: line?.noOfPkgs ? Number(line.noOfPkgs) || null : null,
      gross_weight_kg: line?.grossWeight ? Number(line.grossWeight) || null : null,
    })
    if (err) {
      setError(
        err.code === '23505'
          ? `${containerNo} is already on another House BL for this booking. A container can sit on one House BL and the Master, but not on two House BLs.`
          : err.message,
      )
    }
    await load()
  }

  if (!bookingDbId) return null

  if (declared.length === 0) {
    return (
      <div className="rounded-btn border border-line bg-surface-2/60 px-3 py-2 text-xs text-muted">
        This booking declares no container numbers yet, so there is nothing to split across BLs.
        Add them on the Container info tab.
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-btn border border-line bg-surface-2/60 p-3">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-muted">
        <Boxes size={12} /> Containers on this {blRole.toLowerCase()} BL
      </p>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <ul className="space-y-1">
        {declared.map((c) => {
          const mine = onThisBl.get(c.containerNo)
          const elsewhere = rows.find(
            (r) => r.container_no === c.containerNo && r.bl_id !== blId && r.role === 'House',
          )
          return (
            <li key={c.containerNo} className="flex flex-wrap items-center gap-2 text-[13px]">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={!!mine}
                  disabled={disabled || loading}
                  onChange={() => void toggle(c.containerNo)}
                />
                <span className="font-mono text-xs text-heading">{c.containerNo}</span>
              </label>
              <span className="text-[11px] text-muted">{c.containerType}</span>
              {mine && (
                <span className="text-[11px] text-muted">
                  {mine.packages ?? 0} pkgs · {Number(mine.gross_weight_kg ?? 0).toLocaleString()} kg
                </span>
              )}
              {!mine && elsewhere && blRole === 'House' && (
                <span className="text-[11px] text-amber-600">on another House BL</span>
              )}
            </li>
          )
        })}
      </ul>

      <div className="border-t border-line pt-2 text-[11px] text-muted">
        <p>
          This BL: {totals.packages} packages · {totals.weight.toLocaleString()} kg.{' '}
          {bookingTotals.packages > 0 && (
            <>Booking declares {bookingTotals.packages} packages</>
          )}
          {bookingTotals.weight > 0 && <> · {bookingTotals.weight.toLocaleString()} kg</>}
        </p>
        {unassigned.length > 0 && (
          <p className="mt-0.5">
            Not yet on any House BL: {unassigned.map((c) => c.containerNo).join(', ')}
          </p>
        )}
        {(overPackages || overWeight) && (
          <p className="mt-1 flex items-center gap-1 text-amber-600">
            <AlertTriangle size={11} />
            This BL exceeds what the booking declares
            {overPackages && ' on packages'}
            {overPackages && overWeight && ' and'}
            {overWeight && ' on weight'}. Correct it before issuing.
          </p>
        )}
      </div>
    </div>
  )
}
