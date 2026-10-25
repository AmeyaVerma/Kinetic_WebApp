/**
 * Formatting rules shared by every generated document (BL, CRO, Onboard,
 * CAN, DO, Off Loading Letter). These are print conventions taken from the
 * blank formats, not display conventions -- the app's on-screen formatting
 * lives elsewhere and deliberately differs.
 */

/** Dates print dd-mm-yyyy. Blank/unknown prints empty, never "00-00-0000". */
export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${d.getFullYear()}`
}

/**
 * Weights print in kg to exactly 3 decimals (24990.000).
 *
 * Row values carry NO thousands separators; totals DO (126,100.000). That
 * split is taken from the container attach sheet sample and is the reason
 * this is two functions rather than one with a flag -- callers get it right
 * by picking the right name.
 */
export function fmtWeight(kg: number | string | null | undefined): string {
  const n = toNumber(kg)
  if (n === null) return ''
  return n.toFixed(3)
}

export function fmtWeightTotal(kg: number | string | null | undefined): string {
  const n = toNumber(kg)
  if (n === null) return ''
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
}

/** Measurement in cubic metres, 3 decimals like weights. */
export function fmtMeasurement(m3: number | string | null | undefined): string {
  const n = toNumber(m3)
  if (n === null) return ''
  return n.toFixed(3)
}

/**
 * Money to the currency's own precision. Most currencies are 2dp, but the
 * Gulf dinars (OMR, KWD, BHD) are 3dp and JPY/VND/KRW are 0dp -- rounding
 * those to 2 produces wrong totals, which matters on the Sohar lane. The
 * `decimals` value comes from the currencies master, never assumed.
 */
export function fmtMoney(
  amount: number | string | null | undefined,
  decimals = 2,
): string {
  const n = toNumber(amount)
  if (n === null) return ''
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Documents whose blank format is upper case (container sheet, CAN, DO). */
export function upper(text: string | null | undefined): string {
  return (text ?? '').toUpperCase()
}

/**
 * Equipment group as it prints and as it names a file: 2 x 20ft -> "2X20".
 * Used for the CRO, which is issued once per equipment group.
 */
export function equipmentGroupCode(qty: number, size: string): string {
  const digits = String(size).replace(/\D/g, '')
  return `${qty}X${digits}`
}

function toNumber(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}
