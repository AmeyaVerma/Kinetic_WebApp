import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet, FileText, Receipt, BookOpen, Landmark, Plug, Download, RefreshCw,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Tabs } from '../components/ui/Tabs'
import { StatKpi } from '../components/ui/StatKpi'
import { CsvButton } from '../components/ui/CsvButton'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/useAuthStore'

/**
 * Accounts.
 *
 * Siddharth: "leave the accounts part because it will have changes — you just
 * build button and UI; when we get accounts features we will add accordingly."
 *
 * So this is deliberately two different things at once, and says which is
 * which rather than letting them blur:
 *
 *   Sales invoices and Vendor bills read the REAL invoices table and show
 *   what has actually been raised. Those are built.
 *
 *   Receipts, Ledger and GST are shells. The screens and controls are here so
 *   the shape can be argued about, but nothing behind them is guessed at —
 *   a button that looks live and does nothing is worse than one that says so.
 *
 * Zoho is confirmed as the accounting system, so the last tab is the
 * connection rather than a second set of books.
 */

type InvoiceRow = {
  id: string
  invoice_no: string | null
  series: string
  type: 'AR' | 'AP'
  doc_kind: string
  status: string
  invoice_date: string
  party_name: string | null
  currency: string
  total_inr: number
  tax_treatment: string
  zoho_invoice_id: string | null
  booking_id: string | null
}

const STATUS_TONE: Record<string, BadgeTone> = {
  Draft: 'neutral',
  'Pending approval': 'attention',
  Approved: 'success',
  Emailed: 'info',
  'Partially paid': 'warn',
  Paid: 'done',
  Overdue: 'critical',
  Cancelled: 'danger',
}

const TREATMENT_LABEL: Record<string, string> = {
  IGST: 'IGST',
  CGST_SGST: 'CGST + SGST',
  ZERO_RATED_LUT: 'Zero-rated (LUT)',
  EXEMPT: 'Exempt',
  NON_GST: 'Non-GST',
}

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)

export function AccountsPage() {
  const [tab, setTab] = useState('sales')
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const companies = useAuthStore((s) => s.companies)
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId)
  const company = companies.find((c) => c.id === activeCompanyId)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select(
        'id, invoice_no, series, type, doc_kind, status, invoice_date, party_name, currency, total_inr, tax_treatment, zoho_invoice_id, booking_id',
      )
      .order('invoice_date', { ascending: false })
      .limit(200)
    setRows((data as InvoiceRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sales = useMemo(() => rows.filter((r) => r.type === 'AR'), [rows])
  const bills = useMemo(() => rows.filter((r) => r.type === 'AP'), [rows])

  const kpis = useMemo(() => {
    const billed = sales.reduce((a, r) => a + Number(r.total_inr || 0), 0)
    const paid = sales.filter((r) => r.status === 'Paid')
      .reduce((a, r) => a + Number(r.total_inr || 0), 0)
    return {
      invoices: sales.length,
      billed,
      outstanding: billed - paid,
      bills: bills.length,
      unsynced: rows.filter((r) => !r.zoho_invoice_id).length,
    }
  }, [sales, bills, rows])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Wallet size={20} className="text-primary" />
            <h1 className="text-2xl font-bold">Accounts</h1>
          </div>
          <p className="mt-1 text-sm text-muted">
            Sales invoices, vendor bills, receipts, ledger and GST
            {company ? ` for ${company.name}` : ''}. Books are separate per company —
            an invoice raised here belongs to this company alone.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} /> {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatKpi label="Sales invoices" value={kpis.invoices} icon={<FileText size={17} />} tint="#ECFDF5" color="#10B981" />
        <StatKpi label="Billed (INR)" value={inr(kpis.billed)} icon={<Landmark size={17} />} tint="#EEF2FF" color="#6366F1" />
        <StatKpi label="Outstanding (INR)" value={inr(kpis.outstanding)} icon={<Receipt size={17} />} tint="#FEF3C7" color="#B45309" />
        <StatKpi label="Vendor bills" value={kpis.bills} icon={<BookOpen size={17} />} tint="#FDF2F8" color="#DB2777" />
        <StatKpi label="Not yet in Zoho" value={kpis.unsynced} icon={<Plug size={17} />} tint="#F5F3FF" color="#8B5CF6" />
      </div>

      <Tabs
        tabs={[
          { key: 'sales', label: 'Sales invoices', badge: sales.length || undefined },
          { key: 'bills', label: 'Vendor bills', badge: bills.length || undefined },
          { key: 'receipts', label: 'Receipts' },
          { key: 'ledger', label: 'Ledger' },
          { key: 'gst', label: 'GST' },
          { key: 'zoho', label: 'Zoho' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'sales' && <InvoiceTable rows={sales} loading={loading} kind="AR" />}
      {tab === 'bills' && <InvoiceTable rows={bills} loading={loading} kind="AP" />}
      {tab === 'receipts' && (
        <NotSpecifiedYet
          title="Receipts"
          blurb="Money in against an invoice, bank matching, and part payments."
          actions={['Record a receipt', 'Match to bank statement', 'Allocate across invoices']}
          needs={[
            'Which bank accounts receive payment, and whether statements are imported or keyed',
            'How a part payment is allocated when it does not match one invoice',
            'Whether FX gain or loss is recognised at payment on a USD invoice',
          ]}
        />
      )}
      {tab === 'ledger' && (
        <NotSpecifiedYet
          title="Ledger"
          blurb="Where an invoice, a bill and a receipt post once financial closure runs."
          actions={['Post to ledger', 'Open a period', 'Close a period', 'Export the trial balance']}
          needs={[
            'The chart of accounts — which heads exist and what posts where',
            'Who may close a period and who may reopen one',
            'Whether the ledger lives here or only in Zoho, which decides if this is a view or a book',
          ]}
        />
      )}
      {tab === 'gst' && (
        <NotSpecifiedYet
          title="GST"
          blurb="Returns, e-invoicing and the tax position for the period."
          actions={['Generate GSTR-1 export', 'Reconcile GSTR-2B', 'Push to the IRP']}
          needs={[
            'Whether either company is above the e-invoicing threshold and registered on the IRP',
            'TDS sections and rates on vendor bills',
            'Credit note rules and their numbering series',
          ]}
          known={[
            'SAC 996521 for ocean freight at IGST 5%, from the NITCO invoice',
            'SAC 996711 for container cleaning, zero-rated under LUT AD271025013720M on the Mundra Oil invoice',
            'Place of supply decides IGST against CGST + SGST, read from the customer’s GSTIN',
          ]}
        />
      )}
      {tab === 'zoho' && <ZohoPanel unsynced={kpis.unsynced} />}
    </div>
  )
}

function InvoiceTable({
  rows,
  loading,
  kind,
}: {
  rows: InvoiceRow[]
  loading: boolean
  kind: 'AR' | 'AP'
}) {
  const csv = rows.map((r) => ({
    Number: r.invoice_no ?? '',
    Date: r.invoice_date,
    Party: r.party_name ?? '',
    Kind: r.doc_kind,
    Tax: TREATMENT_LABEL[r.tax_treatment] ?? r.tax_treatment,
    'Total (INR)': r.total_inr,
    Status: r.status,
    Zoho: r.zoho_invoice_id ?? 'not synced',
  }))

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <p className="text-xs text-muted">
          {kind === 'AR'
            ? 'Raised from a booking or shipment on its Invoicing tab.'
            : 'What vendors have billed against a booking.'}
        </p>
        <CsvButton filename={kind === 'AR' ? 'sales-invoices' : 'vendor-bills'} rows={csv} />
      </div>

      {loading ? (
        <p className="px-5 py-10 text-center text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-heading">
            No {kind === 'AR' ? 'sales invoices' : 'vendor bills'} yet.
          </p>
          <p className="mx-auto mt-1 max-w-lg text-xs text-muted">
            {kind === 'AR' ? (
              <>
                An invoice is raised from a booking, on its{' '}
                <Link to="/nvocc" className="text-link underline">Invoicing</Link> tab, so it
                carries the booking, the party and the charge lines with it.
              </>
            ) : (
              'A vendor bill is entered against the buy lines on a booking.'
            )}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Number</th>
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Party</th>
                <th className="px-3 py-3 font-medium">Kind</th>
                <th className="px-3 py-3 font-medium">Tax</th>
                <th className="px-3 py-3 text-right font-medium">Total (INR)</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Zoho</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                  <td className="px-5 py-3 font-mono text-xs font-medium text-link">
                    {r.invoice_no ?? '—'}
                  </td>
                  <td className="px-3 py-3 text-xs text-body">
                    {new Date(r.invoice_date).toLocaleDateString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className="px-3 py-3 text-xs text-body">{r.party_name ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-body">{r.doc_kind}</td>
                  <td className="px-3 py-3 text-xs text-body">
                    {TREATMENT_LABEL[r.tax_treatment] ?? r.tax_treatment}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs text-heading">
                    {inr(Number(r.total_inr))}
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={STATUS_TONE[r.status] ?? 'neutral'} label={r.status} />
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {r.zoho_invoice_id ? (
                      <span className="font-mono text-primary">{r.zoho_invoice_id}</span>
                    ) : (
                      <span className="text-muted">not synced</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

/**
 * A screen whose shape is agreed but whose rules are not.
 *
 * It shows the controls that will exist and states plainly what is missing,
 * because a disabled button with a reason is honest and a live-looking button
 * that silently does nothing is not.
 */
function NotSpecifiedYet({
  title,
  blurb,
  actions,
  needs,
  known,
}: {
  title: string
  blurb: string
  actions: string[]
  needs: string[]
  known?: string[]
}) {
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted">{blurb}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a} size="sm" variant="secondary" disabled title="Waiting on the accounts rules">
              {a}
            </Button>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-muted">
          These controls are switched off on purpose. The screen is here so its shape can be
          agreed; the behaviour waits on the decisions below.
        </p>
      </Card>

      <Card className="p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Still needed before this can work
        </p>
        <ul className="space-y-1.5">
          {needs.map((n) => (
            <li key={n} className="flex gap-2 text-sm text-body">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent-orange" />
              {n}
            </li>
          ))}
        </ul>

        {known && known.length > 0 && (
          <>
            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
              Already settled, from the company&rsquo;s own invoices
            </p>
            <ul className="space-y-1.5">
              {known.map((k) => (
                <li key={k} className="flex gap-2 text-sm text-muted">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  {k}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  )
}

/** The Zoho Books connection. Confirmed as the accounting system. */
function ZohoPanel({ unsynced }: { unsynced: number }) {
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start gap-2.5">
          <Plug size={18} className="mt-0.5 text-muted" />
          <div>
            <h3 className="text-[15px] font-semibold">Zoho Books</h3>
            <p className="text-xs text-muted">
              Confirmed as the accounting system. Every invoice carries a Zoho reference once
              it has been pushed, so the two can always be reconciled.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-btn border border-[#FDE68A] bg-[#FEF3C7]/50 px-3 py-2.5">
          <p className="text-xs text-[#B45309]">
            <strong>Not connected.</strong> {unsynced > 0
              ? `${unsynced} invoice${unsynced === 1 ? '' : 's'} not yet pushed.`
              : 'Nothing to push yet.'}{' '}
            Connecting needs credentials that only an Admin can create, below.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled title="Needs the Self Client credentials first">
            Connect Zoho Books
          </Button>
          <Button size="sm" variant="secondary" disabled title="Available once connected">
            <RefreshCw size={14} /> Push invoices
          </Button>
          <Button size="sm" variant="secondary" disabled title="Available once connected">
            <Download size={14} /> Pull payment status
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          What connecting needs
        </p>
        <ol className="space-y-2 text-sm text-body">
          <li className="flex gap-2">
            <span className="font-mono text-xs text-muted">1</span>
            <span>
              A <strong>Self Client</strong> created at api-console.zoho.com, which produces a
              Client ID and Client Secret. It has to be done from the account that owns the
              books, so it cannot be done for you.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-xs text-muted">2</span>
            <span>
              The <strong>organisation ID</strong> of each company&rsquo;s books. Kinetic and RKS
              are separate GST registrations, so they are separate organisations and each needs
              its own.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-xs text-muted">3</span>
            <span>
              Confirmation of the data centre. An Indian account is normally{' '}
              <span className="font-mono text-xs">zoho.in</span>, which has different endpoints
              from <span className="font-mono text-xs">zoho.com</span> — using the wrong one
              fails in a way that looks like bad credentials.
            </span>
          </li>
        </ol>
        <p className="mt-4 text-[11px] text-muted">
          The grant code from a Self Client expires in a few minutes, so it is exchanged for a
          refresh token as soon as it is issued. The refresh token is stored server-side and
          never reaches the browser.
        </p>
      </Card>
    </div>
  )
}
