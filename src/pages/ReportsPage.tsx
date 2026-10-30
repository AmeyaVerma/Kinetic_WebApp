import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, RefreshCw, Info } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Tabs } from '../components/ui/Tabs'
import { StatKpi } from '../components/ui/StatKpi'
import { CsvButton } from '../components/ui/CsvButton'
import { Badge } from '../components/ui/Badge'
import { MonthBars } from '../components/reports/MonthBars'
import { useDataStore } from '../store/useDataStore'
import { useAuthStore } from '../store/useAuthStore'
import { supabase } from '../lib/supabaseClient'
import * as R from '../components/reports/reportData'

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))
/** Amounts print in the currency they were agreed in; nothing is converted,
    because there is no exchange-rate table to convert at. */
const money = (n: number, currency: R.Money) =>
  currency === 'INR'
    ? `₹${inr(n)}`
    : `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n))}`
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB') : '—')

const TH = 'px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted'
const TD = 'px-3 py-3'

/**
 * Reports.
 *
 * The spec names seven to build first. Four of them can be computed from
 * rows that exist today and are built here. The other three need tables
 * that do not exist yet, and rather than approximate them they are listed
 * at the end with the reason -- a report whose number nobody can trace back
 * to a row is the fault this whole exercise exists to remove.
 */
export function ReportsPage() {
  const [tab, setTab] = useState('bookings')
  const [months, setMonths] = useState(12)
  const [invoices, setInvoices] = useState<R.InvoiceForAgeing[]>([])
  const [loading, setLoading] = useState(true)

  const { bookings, charges, ffShipments, fetchBookings, fetchCharges, fetchFfShipments } =
    useDataStore()
  const companies = useAuthStore((s) => s.companies)
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId)
  const company = companies.find((c) => c.id === activeCompanyId)

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('invoice_no, party_name, invoice_date, due_date, total_inr, status, type')
      .order('invoice_date', { ascending: false })
      .limit(500)
    setInvoices((data as R.InvoiceForAgeing[]) ?? [])
    setLoading(false)
  }, [])

  const reload = useCallback(() => {
    void fetchBookings()
    void fetchCharges()
    void fetchFfShipments()
    void loadInvoices()
  }, [fetchBookings, fetchCharges, fetchFfShipments, loadInvoices])

  useEffect(reload, [reload])

  // Every report starts from the same set, so two reports can never disagree
  // about how many bookings there were.
  const base = useMemo(() => R.reportableBookings(bookings), [bookings])

  const byMonth = useMemo(() => R.bookingsByMonth(base, months), [base, months])
  const byLane = useMemo(() => R.bookingsByLane(base), [base])
  const byCustomer = useMemo(() => R.bookingsByCustomer(base), [base])

  const gpRows = useMemo(
    () => [...R.nvoccGp(base, charges), ...R.freightGp(ffShipments)].sort((a, b) => b.gp - a.gp),
    [base, charges, ffShipments],
  )
  const gpCustomers = useMemo(() => R.gpByCustomer(gpRows), [gpRows])
  const gpTotals = useMemo(() => R.gpTotals(gpRows), [gpRows])

  /* CSV takes plain records so the file carries readable headers rather than
     the field names these tables happen to use internally. */
  const laneCsv = useMemo(
    () =>
      byLane.map((r) => ({
        Lane: r.lane,
        Bookings: r.bookings,
        Containers: r.containers,
        Exports: r.exports,
        Imports: r.imports,
      })),
    [byLane],
  )
  const customerCsv = useMemo(
    () =>
      byCustomer.map((r) => ({
        Customer: r.customer,
        Bookings: r.bookings,
        Containers: r.containers,
        'Last booking': day(r.lastBooking),
      })),
    [byCustomer],
  )
  const gpCustomerCsv = useMemo(
    () =>
      gpCustomers.map((r) => ({
        Customer: r.customer,
        Currency: r.currency,
        Shipments: r.shipments,
        Sell: r.sell,
        'Estimated GP': r.estimatedGp,
        'Actual GP': r.actualGp,
        'Margin %': r.margin.toFixed(1),
      })),
    [gpCustomers],
  )
  const gpShipmentCsv = useMemo(
    () =>
      gpRows.map((r) => ({
        Reference: r.ref,
        Source: r.source,
        Customer: r.customer,
        Lane: r.lane,
        Currency: r.currency,
        Sell: r.sell,
        Cost: r.buy,
        GP: r.gp,
        'Margin %': r.margin.toFixed(1),
        Basis: r.actual ? 'Actual' : 'Estimated',
      })),
    [gpRows],
  )

  const ageing = useMemo(() => R.receivablesAgeing(invoices), [invoices])
  const ageTotals = useMemo(() => R.ageingTotals(ageing), [ageing])
  const freeDays = useMemo(() => R.freeDayExposure(base), [base])
  const ageingCsv = useMemo(
    () =>
      ageing.map((r) => ({
        Invoice: r.invoiceNo,
        Customer: r.party,
        'Invoice date': day(r.invoiceDate),
        Due: day(r.dueDate),
        'Amount (INR)': r.amount,
        'Days overdue': r.daysOverdue,
        Bucket: r.bucket,
      })),
    [ageing],
  )
  const freeDaysCsv = useMemo(
    () =>
      freeDays.map((r) => ({
        Booking: r.ref,
        Customer: r.customer,
        POD: r.pod,
        Containers: r.containers,
        'Free days': r.freeDays,
        Arrival: day(r.arrival),
        'Days left': r.daysLeft,
        Exposed: r.exposed ? 'Yes' : 'No',
      })),
    [freeDays],
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-primary" />
            <h1 className="text-2xl font-bold">Reports</h1>
          </div>
          <p className="mt-1 text-sm text-muted">
            Bookings, gross profit, receivables ageing and free-day exposure
            {company ? ` for ${company.name}` : ''}. Every figure is counted from real rows —
            nothing here is seeded, and each report says what it counted.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw size={14} /> {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      <Tabs
        tabs={[
          { key: 'bookings', label: 'Bookings', badge: base.length },
          { key: 'gp', label: 'Gross profit', badge: gpRows.length },
          { key: 'ageing', label: 'Receivables ageing', badge: ageing.length },
          { key: 'freedays', label: 'Free days', badge: freeDays.filter((f) => f.exposed).length },
          { key: 'gaps', label: 'Not built yet' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'bookings' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-muted">Period</label>
            <select
              className="rounded-btn border border-line bg-surface px-2.5 py-1.5 text-sm"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
            >
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
              <option value={24}>Last 24 months</option>
            </select>
            <p className="text-xs text-muted">
              Counting {base.length} live booking{base.length === 1 ? '' : 's'}. Voided rows and
              historical spreadsheet imports are excluded.
            </p>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-3">
              <h2 className="text-sm font-semibold">Bookings per month</h2>
            </div>
            <MonthBars bars={byMonth} unit="booking" />
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-2.5">
              <h2 className="text-sm font-semibold">By lane</h2>
              <CsvButton filename="bookings-by-lane" rows={laneCsv} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={TH}>Lane</th>
                    <th className={TH}>Bookings</th>
                    <th className={TH}>Containers</th>
                    <th className={TH}>Exports</th>
                    <th className={TH}>Imports</th>
                  </tr>
                </thead>
                <tbody>
                  {byLane.map((r) => (
                    <tr key={r.lane} className="border-b border-line last:border-0">
                      <td className={`${TD} font-medium`}>{r.lane}</td>
                      <td className={TD}>{r.bookings}</td>
                      <td className={TD}>{r.containers}</td>
                      <td className={TD}>{r.exports}</td>
                      <td className={TD}>{r.imports}</td>
                    </tr>
                  ))}
                  {byLane.length === 0 && (
                    <tr>
                      <td className="px-5 py-8 text-center text-sm text-muted" colSpan={5}>
                        No bookings to report on yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-2.5">
              <h2 className="text-sm font-semibold">By customer</h2>
              <CsvButton filename="bookings-by-customer" rows={customerCsv} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={TH}>Customer</th>
                    <th className={TH}>Bookings</th>
                    <th className={TH}>Containers</th>
                    <th className={TH}>Last booking</th>
                  </tr>
                </thead>
                <tbody>
                  {byCustomer.map((r) => (
                    <tr key={r.customer} className="border-b border-line last:border-0">
                      <td className={`${TD} font-medium`}>{r.customer}</td>
                      <td className={TD}>{r.bookings}</td>
                      <td className={TD}>{r.containers}</td>
                      <td className={TD}>{day(r.lastBooking)}</td>
                    </tr>
                  ))}
                  {byCustomer.length === 0 && (
                    <tr>
                      <td className="px-5 py-8 text-center text-sm text-muted" colSpan={4}>
                        No bookings to report on yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'gp' && (
        <div className="space-y-5">
          {gpTotals.map((t) => (
            <div key={t.currency} className="space-y-2">
              <h2 className="text-sm font-semibold">
                {t.currency === 'INR' ? 'Rupee charges' : 'Dollar charges'}
              </h2>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatKpi
                  label="Total sell"
                  value={money(t.sell, t.currency)}
                  icon={<BarChart3 size={17} />}
                  tint="#EEF2FF"
                  color="#6366F1"
                />
                <StatKpi
                  label={`Estimated GP (${t.estimatedCount})`}
                  value={money(t.estimated, t.currency)}
                  icon={<BarChart3 size={17} />}
                  tint="#FFF7ED"
                  color="#F97316"
                />
                <StatKpi
                  label={`Actual GP (${t.actualCount})`}
                  value={money(t.actual, t.currency)}
                  icon={<BarChart3 size={17} />}
                  tint="#ECFDF5"
                  color="#10B981"
                />
                <StatKpi
                  label="Shipments"
                  value={t.estimatedCount + t.actualCount}
                  icon={<BarChart3 size={17} />}
                  tint="#F5F3FF"
                  color="#8B5CF6"
                />
              </div>
            </div>
          ))}

          <div className="flex items-start gap-2 rounded-card border border-line bg-surface-2 px-4 py-3 text-xs text-muted">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>
              Estimated and actual are never added together. A shipment counts as actual only
              once every vendor line has been billed. NVOCC bookings are always estimated:
              their buy lines are what we expect to pay, and there is no vendor-bill table to
              settle them against yet. GP by sales owner is not here — no booking carries an
              owner today. Dollars and rupees are reported separately — there is no
              exchange-rate table yet, so converting would mean inventing the rate.
            </p>
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-2.5">
              <h2 className="text-sm font-semibold">By customer</h2>
              <CsvButton filename="gp-by-customer" rows={gpCustomerCsv} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={TH}>Customer</th>
                    <th className={TH}>Currency</th>
                    <th className={TH}>Shipments</th>
                    <th className={TH}>Sell</th>
                    <th className={TH}>Estimated GP</th>
                    <th className={TH}>Actual GP</th>
                    <th className={TH}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {gpCustomers.map((r) => (
                    <tr key={`${r.customer}-${r.currency}`} className="border-b border-line last:border-0">
                      <td className={`${TD} font-medium`}>{r.customer}</td>
                      <td className={TD}>{r.currency}</td>
                      <td className={TD}>{r.shipments}</td>
                      <td className={TD}>{money(r.sell, r.currency)}</td>
                      <td className={TD}>{money(r.estimatedGp, r.currency)}</td>
                      <td className={TD}>{money(r.actualGp, r.currency)}</td>
                      <td className={TD}>{r.sell > 0 ? `${r.margin.toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                  {gpCustomers.length === 0 && (
                    <tr>
                      <td className="px-5 py-8 text-center text-sm text-muted" colSpan={7}>
                        No costed shipments yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-2.5">
              <h2 className="text-sm font-semibold">By shipment</h2>
              <CsvButton filename="gp-by-shipment" rows={gpShipmentCsv} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={TH}>Reference</th>
                    <th className={TH}>Customer</th>
                    <th className={TH}>Lane</th>
                    <th className={TH}>Sell</th>
                    <th className={TH}>Cost</th>
                    <th className={TH}>GP</th>
                    <th className={TH}>Margin</th>
                    <th className={TH}>Basis</th>
                  </tr>
                </thead>
                <tbody>
                  {gpRows.map((r) => (
                    <tr key={`${r.source}-${r.ref}-${r.currency}`} className="border-b border-line last:border-0">
                      <td className={`${TD} font-medium`}>{r.ref}</td>
                      <td className={TD}>{r.customer}</td>
                      <td className={TD}>{r.lane}</td>
                      <td className={TD}>{money(r.sell, r.currency)}</td>
                      <td className={TD}>{money(r.buy, r.currency)}</td>
                      <td className={`${TD} font-semibold ${r.gp < 0 ? 'text-red-600' : ''}`}>
                        {money(r.gp, r.currency)}
                      </td>
                      <td className={TD}>{r.sell > 0 ? `${r.margin.toFixed(1)}%` : '—'}</td>
                      <td className={TD}>
                        <Badge
                          tone={r.actual ? 'success' : 'warn'}
                          label={r.actual ? 'Actual' : 'Estimated'}
                        />
                      </td>
                    </tr>
                  ))}
                  {gpRows.length === 0 && (
                    <tr>
                      <td className="px-5 py-8 text-center text-sm text-muted" colSpan={8}>
                        No shipment carries a costing yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'ageing' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {R.AGE_BUCKETS.map((b) => (
              <StatKpi
                key={b}
                label={b === 'Not due' ? 'Not due' : `${b} days`}
                value={`₹${inr(ageTotals[b])}`}
                icon={<BarChart3 size={17} />}
                tint={b === '90+' ? '#FEF2F2' : b === '61–90' ? '#FFF7ED' : '#ECFDF5'}
                color={b === '90+' ? '#DC2626' : b === '61–90' ? '#F97316' : '#10B981'}
              />
            ))}
          </div>

          <div className="flex items-start gap-2 rounded-card border border-line bg-surface-2 px-4 py-3 text-xs text-muted">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>
              Open sales invoices only — paid, cancelled and void ones drop out. Age runs from
              the due date, or from the invoice date where no terms were agreed. Payables
              ageing is not here: there is no vendor-bills table to age.
            </p>
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-2.5">
              <h2 className="text-sm font-semibold">Open receivables</h2>
              <CsvButton filename="receivables-ageing" rows={ageingCsv} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={TH}>Invoice</th>
                    <th className={TH}>Customer</th>
                    <th className={TH}>Invoice date</th>
                    <th className={TH}>Due</th>
                    <th className={TH}>Amount (₹)</th>
                    <th className={TH}>Overdue</th>
                    <th className={TH}>Bucket</th>
                  </tr>
                </thead>
                <tbody>
                  {ageing.map((r) => (
                    <tr key={r.invoiceNo} className="border-b border-line last:border-0">
                      <td className={`${TD} font-medium`}>{r.invoiceNo}</td>
                      <td className={TD}>{r.party}</td>
                      <td className={TD}>{day(r.invoiceDate)}</td>
                      <td className={TD}>{day(r.dueDate)}</td>
                      <td className={TD}>{inr(r.amount)}</td>
                      <td className={TD}>{r.daysOverdue > 0 ? `${r.daysOverdue} days` : '—'}</td>
                      <td className={TD}>
                        <Badge
                          tone={
                            r.bucket === '90+'
                              ? 'critical'
                              : r.bucket === '61–90'
                                ? 'danger'
                                : r.bucket === '31–60'
                                  ? 'attention'
                                  : r.bucket === '1–30'
                                    ? 'warn'
                                    : 'neutral'
                          }
                          label={r.bucket}
                        />
                      </td>
                    </tr>
                  ))}
                  {ageing.length === 0 && (
                    <tr>
                      <td className="px-5 py-8 text-center text-sm text-muted" colSpan={7}>
                        Nothing outstanding.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'freedays' && (
        <div className="space-y-5">
          <div className="flex items-start gap-2 rounded-card border border-line bg-surface-2 px-4 py-3 text-xs text-muted">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>
              Counted from arrival at destination — the recorded arrival date, or the ETA where
              the vessel has not landed. Bookings with no destination free days agreed are left
              out rather than given a number nobody agreed to.
            </p>
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-2.5">
              <h2 className="text-sm font-semibold">Free-day exposure</h2>
              <CsvButton filename="free-day-exposure" rows={freeDaysCsv} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={TH}>Booking</th>
                    <th className={TH}>Customer</th>
                    <th className={TH}>POD</th>
                    <th className={TH}>Containers</th>
                    <th className={TH}>Free days</th>
                    <th className={TH}>Arrival</th>
                    <th className={TH}>Days left</th>
                  </tr>
                </thead>
                <tbody>
                  {freeDays.map((r) => (
                    <tr key={r.ref} className="border-b border-line last:border-0">
                      <td className={`${TD} font-medium`}>{r.ref}</td>
                      <td className={TD}>{r.customer}</td>
                      <td className={TD}>{r.pod}</td>
                      <td className={TD}>{r.containers}</td>
                      <td className={TD}>{r.freeDays}</td>
                      <td className={TD}>{day(r.arrival)}</td>
                      <td className={TD}>
                        <Badge
                          tone={r.exposed ? 'critical' : r.daysLeft <= 3 ? 'warn' : 'success'}
                          label={r.exposed ? `${-r.daysLeft} over` : `${r.daysLeft} left`}
                        />
                      </td>
                    </tr>
                  ))}
                  {freeDays.length === 0 && (
                    <tr>
                      <td className="px-5 py-8 text-center text-sm text-muted" colSpan={7}>
                        No booking has destination free days and an arrival date yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'gaps' && <Gaps />}
    </div>
  )
}

/**
 * The reports the spec asks for that cannot honestly be produced yet.
 *
 * Listed rather than approximated. Each one names the table it is waiting
 * on, so the cost of the gap is visible and whoever reads this knows what
 * unlocks it.
 */
function Gaps() {
  const gaps = [
    {
      report: 'Payables ageing',
      needs: 'A vendor-bills table',
      why: 'Nothing records what a vendor has billed us, so there is no payable to age. Freight shipments hold a billed amount per vendor line, but that is a figure on a shipment, not a bill with its own date and terms.',
    },
    {
      report: 'MNR cost per container',
      needs: 'An mnr_jobs table',
      why: 'Repair jobs, estimates and their approved costs live only in browser memory and are lost on refresh. Any figure here would be invented.',
    },
    {
      report: 'Container utilisation and on-hire days',
      needs: 'A fleet table with movement history',
      why: 'The fleet list is seeded in the browser. On-hire days also need each container’s hire and off-hire movements, which nothing records today.',
    },
    {
      report: 'CSC compliance',
      needs: 'The same fleet table',
      why: 'CSC plate expiry is a field on the seeded fleet rows. It will be real as soon as the fleet is.',
    },
    {
      report: 'GP by sales owner',
      needs: 'An owner on each booking and shipment',
      why: 'No booking or shipment records who sold it, so there is nothing to group by. GP by shipment and by customer are built.',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-card border border-line bg-surface-2 px-4 py-3 text-xs text-muted">
        <Info size={14} className="mt-0.5 shrink-0" />
        <p>
          These are on the spec&rsquo;s list and are not built. They are shown here rather than
          rendered with placeholder numbers, because a report nobody can trace back to a row is
          worse than no report.
        </p>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className={TH}>Report</th>
                <th className={TH}>Waiting on</th>
                <th className={TH}>Why it cannot be computed</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((g) => (
                <tr key={g.report} className="border-b border-line align-top last:border-0">
                  <td className={`${TD} font-medium`}>{g.report}</td>
                  <td className={TD}>
                    <Badge tone="warn" label={g.needs} />
                  </td>
                  <td className={`${TD} text-muted`}>{g.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
