import type { Booking, ChargeLine, FfShipment } from '../../lib/types'
import * as kpi from '../../lib/kpi'

/**
 * The arithmetic behind the reports, kept out of the components.
 *
 * Every figure here is computed from rows that actually exist in Postgres.
 * Where a report the spec asks for cannot be computed yet, it is not
 * approximated and not seeded -- it is listed on the Reports page with the
 * reason, because a plausible-looking number nobody can trace is the exact
 * fault this whole exercise is meant to remove.
 */

export interface MonthBucket {
  key: string
  label: string
  value: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The last `count` months ending with the current one, oldest first. */
export function monthWindow(count: number): MonthBucket[] {
  const out: MonthBucket[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      value: 0,
    })
  }
  return out
}

function monthKeyOf(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/* ── Bookings by month, lane and customer ─────────────────────── */

export function bookingsByMonth(bookings: Booking[], months: number): MonthBucket[] {
  const buckets = monthWindow(months)
  const index = new Map(buckets.map((b) => [b.key, b]))
  for (const b of bookings) {
    const key = monthKeyOf(b.bookingDate ?? b.createdAt)
    const bucket = key ? index.get(key) : undefined
    if (bucket) bucket.value += 1
  }
  return buckets
}

export interface LaneRow {
  lane: string
  pol: string
  pod: string
  bookings: number
  containers: number
  exports: number
  imports: number
}

export function bookingsByLane(bookings: Booking[]): LaneRow[] {
  const map = new Map<string, LaneRow>()
  for (const b of bookings) {
    const pol = b.pol || '—'
    const pod = b.pod || '—'
    const lane = `${pol} → ${pod}`
    const row = map.get(lane) ?? {
      lane,
      pol,
      pod,
      bookings: 0,
      containers: 0,
      exports: 0,
      imports: 0,
    }
    row.bookings += 1
    row.containers += b.containerQty ?? 0
    if (b.direction === 'Export') row.exports += 1
    else row.imports += 1
    map.set(lane, row)
  }
  return [...map.values()].sort((a, b) => b.bookings - a.bookings)
}

export interface CustomerRow {
  customer: string
  bookings: number
  containers: number
  lastBooking: string | null
}

export function bookingsByCustomer(bookings: Booking[]): CustomerRow[] {
  const map = new Map<string, CustomerRow>()
  for (const b of bookings) {
    const name = b.bookingPartyName || '—'
    const row = map.get(name) ?? { customer: name, bookings: 0, containers: 0, lastBooking: null }
    row.bookings += 1
    row.containers += b.containerQty ?? 0
    const when = b.bookingDate ?? b.createdAt
    if (when && (!row.lastBooking || when > row.lastBooking)) row.lastBooking = when
    map.set(name, row)
  }
  return [...map.values()].sort((a, b) => b.bookings - a.bookings)
}

/* ── Gross profit ─────────────────────────────────────────────── */

export type Money = 'USD' | 'INR'

export interface GpRow {
  ref: string
  customer: string
  lane: string
  /** Charges are entered in the currency they were agreed in, and this app
      has no exchange-rate table yet, so a row keeps its own currency and
      totals are grouped by it. Converting at a rate nobody stated would be
      inventing the number. */
  currency: Money
  sell: number
  buy: number
  gp: number
  margin: number
  /** False while any cost on the shipment is still a quote rather than a bill. */
  actual: boolean
  source: 'NVOCC' | 'Freight'
}

/**
 * GP per NVOCC booking, from its own charge sheet.
 *
 * Always an estimate. NVOCC buy lines are what we expect to pay; there is no
 * vendor bill to settle them against until the vendor-bills table exists, so
 * calling any of this "actual" would be a claim the data cannot support.
 */
export function nvoccGp(bookings: Booking[], charges: ChargeLine[]): GpRow[] {
  const out: GpRow[] = []
  for (const b of bookings) {
    const mine = charges.filter((c) => c.bookingId === b.id)
    // A booking can carry both a dollar freight line and a rupee local
    // charge. They are not addable, so each currency becomes its own row
    // rather than being quietly summed into one meaningless figure.
    for (const currency of ['USD', 'INR'] as Money[]) {
      const here = mine.filter((c) => c.currency === currency)
      if (here.length === 0) continue
      const sell = here.filter((c) => c.type === 'sell').reduce((a, c) => a + c.amount, 0)
      const buy = here.filter((c) => c.type === 'buy').reduce((a, c) => a + c.amount, 0)
      if (sell === 0 && buy === 0) continue
      out.push({
        ref: b.bookingRef,
        customer: b.bookingPartyName || '—',
        lane: `${b.pol || '—'} → ${b.pod || '—'}`,
        currency,
        sell,
        buy,
        gp: sell - buy,
        margin: sell > 0 ? ((sell - buy) / sell) * 100 : 0,
        actual: false,
        source: 'NVOCC',
      })
    }
  }
  return out
}

/** GP per freight shipment. Actual once every vendor line has been billed. */
export function freightGp(shipments: FfShipment[]): GpRow[] {
  return shipments
    .filter((s) => !s.parentId)
    .map((s) => {
      const allBilled = s.vendorLines.length > 0 && s.vendorLines.every((v) => v.billedAmount !== null)
      const buy = s.vendorLines.reduce(
        (a, v) => a + (v.billedAmount !== null ? v.billedAmount : v.buyAmount),
        0,
      )
      return {
        ref: s.ref,
        customer: s.customerName || '—',
        // Freight amounts have no currency column; the module has always
        // treated them as dollars and prints them that way.
        currency: 'USD' as Money,
        lane: `${s.origin || '—'} → ${s.destination || '—'}`,
        sell: s.sellAmount,
        buy,
        gp: s.sellAmount - buy,
        margin: s.sellAmount > 0 ? ((s.sellAmount - buy) / s.sellAmount) * 100 : 0,
        actual: allBilled,
        source: 'Freight' as const,
      }
    })
    .filter((r) => r.sell !== 0 || r.buy !== 0)
}

export interface GpByCustomerRow {
  customer: string
  currency: Money
  shipments: number
  sell: number
  estimatedGp: number
  actualGp: number
  margin: number
}

/**
 * Rolled up by customer, estimated and actual still apart (spec M6) and one
 * row per currency, because dollars and rupees do not add.
 */
export function gpByCustomer(rows: GpRow[]): GpByCustomerRow[] {
  const map = new Map<string, GpByCustomerRow>()
  for (const r of rows) {
    const key = `${r.customer}|${r.currency}`
    const row = map.get(key) ?? {
      customer: r.customer,
      currency: r.currency,
      shipments: 0,
      sell: 0,
      estimatedGp: 0,
      actualGp: 0,
      margin: 0,
    }
    row.shipments += 1
    row.sell += r.sell
    if (r.actual) row.actualGp += r.gp
    else row.estimatedGp += r.gp
    map.set(key, row)
  }
  const out = [...map.values()]
  for (const row of out) {
    row.margin = row.sell > 0 ? ((row.estimatedGp + row.actualGp) / row.sell) * 100 : 0
  }
  return out.sort((a, b) => b.estimatedGp + b.actualGp - (a.estimatedGp + a.actualGp))
}

export interface GpTotal {
  currency: Money
  sell: number
  estimated: number
  estimatedCount: number
  actual: number
  actualCount: number
}

/** Headline figures, one set per currency. Never one number. */
export function gpTotals(rows: GpRow[]): GpTotal[] {
  const map = new Map<Money, GpTotal>()
  for (const r of rows) {
    const t = map.get(r.currency) ?? {
      currency: r.currency,
      sell: 0,
      estimated: 0,
      estimatedCount: 0,
      actual: 0,
      actualCount: 0,
    }
    t.sell += r.sell
    if (r.actual) {
      t.actual += r.gp
      t.actualCount += 1
    } else {
      t.estimated += r.gp
      t.estimatedCount += 1
    }
    map.set(r.currency, t)
  }
  return [...map.values()].sort((a, b) => (a.currency === 'INR' ? -1 : 1) - (b.currency === 'INR' ? -1 : 1))
}

/* ── Receivables ageing ───────────────────────────────────────── */

export interface InvoiceForAgeing {
  invoice_no: string
  party_name: string | null
  invoice_date: string | null
  due_date: string | null
  total_inr: number | string | null
  status: string | null
  type: string | null
}

export type AgeBucket = 'Not due' | '1–30' | '31–60' | '61–90' | '90+'
export const AGE_BUCKETS: AgeBucket[] = ['Not due', '1–30', '31–60', '61–90', '90+']

export interface AgeingRow {
  invoiceNo: string
  party: string
  invoiceDate: string | null
  dueDate: string | null
  amount: number
  daysOverdue: number
  bucket: AgeBucket
}

const DAY = 86_400_000

/**
 * Open receivables by age.
 *
 * Paid and cancelled invoices drop out: ageing is about money still owed.
 * An invoice with no due date is aged from its invoice date, which is what
 * the business does by hand when a term was never agreed.
 */
export function receivablesAgeing(invoices: InvoiceForAgeing[]): AgeingRow[] {
  const today = Date.now()
  return invoices
    .filter((i) => i.type === 'AR')
    .filter((i) => i.status !== 'Paid' && i.status !== 'Cancelled' && i.status !== 'Void')
    .map((i) => {
      const basis = i.due_date ?? i.invoice_date
      const days = basis ? Math.floor((today - new Date(basis).getTime()) / DAY) : 0
      const daysOverdue = Math.max(0, days)
      let bucket: AgeBucket = 'Not due'
      if (days > 90) bucket = '90+'
      else if (days > 60) bucket = '61–90'
      else if (days > 30) bucket = '31–60'
      else if (days > 0) bucket = '1–30'
      return {
        invoiceNo: i.invoice_no,
        party: i.party_name ?? '—',
        invoiceDate: i.invoice_date,
        dueDate: i.due_date,
        amount: Number(i.total_inr ?? 0),
        daysOverdue,
        bucket,
      }
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
}

export function ageingTotals(rows: AgeingRow[]): Record<AgeBucket, number> {
  const totals = {
    'Not due': 0,
    '1–30': 0,
    '31–60': 0,
    '61–90': 0,
    '90+': 0,
  } as Record<AgeBucket, number>
  for (const r of rows) totals[r.bucket] += r.amount
  return totals
}

/* ── Free-day exposure ────────────────────────────────────────── */

export interface FreeDayRow {
  ref: string
  customer: string
  pod: string
  containers: number
  freeDays: number
  arrival: string
  daysSinceArrival: number
  daysLeft: number
  /** Past the free period, so detention is accruing. */
  exposed: boolean
}

/**
 * Where free time is running out.
 *
 * Counted from arrival at destination -- the arrival date if one was
 * recorded, otherwise the ETA, which is what ops watch before the vessel
 * lands. A booking with no destination free days agreed is left out rather
 * than defaulted to a number nobody agreed to.
 */
export function freeDayExposure(bookings: Booking[]): FreeDayRow[] {
  const today = Date.now()
  const out: FreeDayRow[] = []
  for (const b of bookings) {
    const freeDays = b.freeDaysDest ?? 0
    const arrival = b.arrivalDate ?? b.eta ?? null
    if (freeDays <= 0 || !arrival) continue
    const elapsed = Math.floor((today - new Date(arrival).getTime()) / DAY)
    out.push({
      ref: b.bookingRef,
      customer: b.bookingPartyName || '—',
      pod: b.pod || '—',
      containers: b.containerQty ?? 0,
      freeDays,
      arrival,
      daysSinceArrival: elapsed,
      daysLeft: freeDays - elapsed,
      exposed: elapsed > freeDays,
    })
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft)
}

/* ── Shared ───────────────────────────────────────────────────── */

/** The booking set every report starts from: live rows, nothing voided. */
export function reportableBookings(bookings: Booking[]): Booking[] {
  return kpi.totalBookings(bookings.filter((b) => !b.demo))
}
