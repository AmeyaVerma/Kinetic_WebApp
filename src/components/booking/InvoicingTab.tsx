import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge, type BadgeTone } from '../ui/Badge'
import { Select, TextInput } from '../ui/Field'
import { AddableSelect } from '../ui/AddableSelect'
import { BookingMilestonesSection } from './BookingMilestonesSection'
import { useDataStore } from '../../store/useDataStore'
import { supabase } from '../../lib/supabaseClient'
import { raiseInvoice } from '../../lib/invoiceFromBooking'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import type { Booking, InvoiceStatus, MilestoneDef, MilestoneEntry } from '../../lib/types'

const INVOICE_TONE: Record<InvoiceStatus, BadgeTone> = {
  Draft: 'neutral',
  'Pending approval': 'attention',
  Approved: 'success',
  'Zoho synced': 'info',
  Emailed: 'info',
  'Partially paid': 'warn',
  Paid: 'done',
  Overdue: 'critical',
  Cancelled: 'danger',
}

const NEXT_LABEL: Partial<Record<InvoiceStatus, string>> = {
  Draft: 'Submit for approval',
  'Pending approval': 'Approve',
  Approved: 'Sync to Zoho',
  'Zoho synced': 'Mark emailed',
  Emailed: 'Record part-payment',
  'Partially paid': 'Record full payment',
}

export function InvoicingTab({
  booking,
  milestones,
}: {
  booking: Booking
  milestones?: {
    defs: MilestoneDef[]
    entries: MilestoneEntry[]
    onMark: (key: string, completedAt: string) => void
    onEditDate: (key: string, completedAt: string) => void
  }
}) {
  const { charges, invoices, approvals, addCharge, requestChargeApproval, removeCharge, advanceInvoice, masters, addMasterOption, fetchCharges } = useDataStore()

  // The booking's own charge lines live in the database; without this the tab
  // showed only the seeded ones and a real booking looked like it had none.
  useEffect(() => {
    void fetchCharges()
  }, [fetchCharges])
  const [raising, setRaising] = useState(false)
  const [raiseError, setRaiseError] = useState<string | null>(null)
  const [raisedNo, setRaisedNo] = useState<string | null>(null)

  /**
   * Raise a real invoice from the selected charge lines.
   *
   * This used to build an object in browser memory with a number made from
   * the length of an array; it vanished on refresh and no other screen ever
   * saw it. Now the number is allocated by the database and the invoice is
   * stored, so Accounts and financial closure have something to read.
   *
   * The tax treatment is not chosen here: it follows from the customer\u2019s
   * GSTIN and whether the company holds an LUT, exactly as their own two
   * invoices do.
   */
  const raise = async () => {
    setRaising(true)
    setRaiseError(null)
    setRaisedNo(null)

    const chosen = charges.filter((c) => selected.includes(c.id))
    if (chosen.length === 0) {
      setRaising(false)
      setRaiseError('Select at least one charge line.')
      return
    }
    if (!booking.dbId) {
      setRaising(false)
      setRaiseError('This booking is not in the database, so it cannot be invoiced.')
      return
    }

    const [{ data: settings }, { data: party }] = await Promise.all([
      supabase
        .from('company_settings')
        .select('legal_name, corporate_address, gst_address, tel, email, website, gstin, pan, cin, lut_number, state_code, bank_name, bank_account, bank_ifsc, invoice_series')
        .maybeSingle(),
      booking.bookingPartyId
        ? supabase
            .from('parties')
            .select('id, legal_name, display_name, address_line, address_raw, gstin, state')
            .eq('id', booking.bookingPartyId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    if (!settings) {
      setRaising(false)
      setRaiseError('Company settings are missing, so an invoice cannot carry its own identity.')
      return
    }

    // An export is zero-rated only where the company actually holds an LUT.
    const isExport = booking.direction === 'Export'

    const result = await raiseInvoice({
      bookingId: booking.dbId,
      type: 'AR',
      company: {
        legalName: settings.legal_name,
        corporateAddress: settings.corporate_address,
        gstAddress: settings.gst_address,
        tel: settings.tel,
        email: settings.email,
        website: settings.website,
        gstin: settings.gstin,
        pan: settings.pan,
        cin: settings.cin,
        lutNumber: settings.lut_number,
        stateCode: settings.state_code,
        bankName: settings.bank_name,
        bankAccount: settings.bank_account,
        bankIfsc: settings.bank_ifsc,
        invoiceSeries: settings.invoice_series,
      },
      party: {
        id: party?.id ?? null,
        name: party?.display_name || party?.legal_name || booking.bookingPartyName,
        address: party?.address_line ?? party?.address_raw ?? null,
        gstin: party?.gstin ?? null,
        state: party?.state ?? null,
      },
      isExport,
      lines: chosen.map((c) => ({
        particulars: c.chargeName,
        code: null,
        qty: 1,
        uom: 'NOS',
        rate: c.amount,
        currency: c.currency,
        // Their invoices strike the rate on the face of the document rather
        // than pulling a live one, so an invoice never re-prices later.
        exRate: c.currency === 'INR' ? 1 : 1,
        gstRate: 0,
        chargeLineId: c.id,
      })),
      createdBy: currentUser?.name ?? 'Finance',
    })

    setRaising(false)
    if (!result.ok) {
      setRaiseError(result.error)
      return
    }
    setRaisedNo(result.invoice.invoiceNo)
    setSelected([])
  }
  const currentUser = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? currentUser?.role) === 'admin'
  const actor = currentUser?.name ?? 'Ops'
  const bookingCharges = charges.filter((c) => c.bookingId === booking.id && c.type === 'sell')
  const bookingInvoices = invoices.filter((i) => i.bookingId === booking.id)
  const pendingCosting = approvals.filter(
    (a) => a.bookingId === booking.id && a.entityType === 'booking_costing' && a.status === 'Pending',
  )

  const [selected, setSelected] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [newCode, setNewCode] = useState('cc8')
  const [newAmount, setNewAmount] = useState(0)
  const [newCurrency, setNewCurrency] = useState<'USD' | 'INR'>('USD')

  const totals = useMemo(() => {
    const fx = (amount: number, cur: string) => (cur === 'INR' ? amount / 84 : amount)
    const rate = bookingCharges.reduce((a, c) => a + fx(c.amount, c.currency), 0)
    return { rate }
  }, [bookingCharges])

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-line bg-surface p-4 shadow-card">
          <p className="text-xs text-muted">Rate total (USD eq.)</p>
          <p className="mt-1 font-mono text-xl font-bold text-[#10B981]">
            ${Math.round(totals.rate).toLocaleString()}
          </p>
        </div>
      </div>

      {milestones && (
        <BookingMilestonesSection
          title="Booking milestones"
          defs={milestones.defs}
          entries={milestones.entries}
          onMark={milestones.onMark}
          onEditDate={milestones.onEditDate}
        />
      )}

      {/* Rates / charge sheet (doc §8 "Rates tab") */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Charge sheet — select lines, then generate
          </p>
          <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}>
            <Plus size={13} /> Add line
          </Button>
        </div>

        {adding && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-btn border border-line bg-surface-2/50 p-3">
            <AddableSelect
              value={newCode}
              onChange={setNewCode}
              addLabel="Add charge code"
              options={masters.chargeCodes.map((cc) => ({ value: cc.id, label: cc.name }))}
              onAdd={(name) => addMasterOption('chargeCodes', name)}
            />
            <TextInput
              type="number"
              placeholder="Amount"
              value={newAmount || ''}
              onChange={(e) => setNewAmount(+e.target.value)}
            />
            <Select value={newCurrency} onChange={(e) => setNewCurrency(e.target.value as 'USD' | 'INR')}>
              <option>USD</option>
              <option>INR</option>
            </Select>
            <Button
              size="sm"
              onClick={() => {
                if (!newAmount) return
                const chargeName = masters.chargeCodes.find((cc) => cc.id === newCode)?.name ?? 'Charge'
                const charge = {
                  bookingId: booking.id,
                  chargeCodeId: newCode,
                  chargeName,
                  type: 'sell' as const,
                  amount: newAmount,
                  currency: newCurrency,
                  vendorId: null,
                }
                if (isAdmin) {
                  addCharge(charge)
                } else {
                  requestChargeApproval(
                    booking.id,
                    [charge],
                    `Costing added on ${booking.bookingRef}: ${chargeName} ${newCurrency} ${newAmount.toLocaleString()}`,
                    actor,
                  )
                }
                setNewAmount(0)
                setAdding(false)
              }}
            >
              {isAdmin ? 'Add' : 'Submit for approval'}
            </Button>
          </div>
        )}
        {!isAdmin && pendingCosting.length > 0 && (
          <div className="mb-3 rounded-btn border border-accent-orange/30 bg-accent-orange/5 px-3 py-2">
            <p className="text-xs text-accent-orange">
              {pendingCosting.length} costing {pendingCosting.length === 1 ? 'line is' : 'batch is'} pending Admin approval and not yet on the charge sheet below.
            </p>
          </div>
        )}

        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/60 text-[11px] uppercase tracking-wide text-muted">
                <th className="w-10 px-4 py-2.5" />
                <th className="px-3 py-2.5 font-medium">Charge</th>
                <th className="px-3 py-2.5 font-medium">Amount</th>
                <th className="px-3 py-2.5 font-medium">Currency</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {bookingCharges.map((c) => (
                <tr key={c.id} className="border-b border-line bg-surface last:border-0">
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={() => toggle(c.id)}
                      className="h-4 w-4 accent-[#10B981]"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-[13px] text-heading">{c.chargeName}</td>
                  <td className="px-3 py-2.5 font-mono text-[13px] text-heading">{c.amount.toLocaleString()}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-body">{c.currency}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => removeCharge(c.id)}
                      className="text-muted transition-colors hover:text-accent-coral"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {bookingCharges.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                    No charges on this booking yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={selected.length === 0 || raising}
            className="disabled:opacity-50"
            onClick={() => void raise()}
          >
            {raising ? 'Raising\u2026' : 'Generate invoice'}
          </Button>
          {raiseError && <p className="text-sm text-red-600">{raiseError}</p>}
          {raisedNo && (
            <p className="text-sm text-primary">
              Raised {raisedNo}. It is on the{' '}
              <Link to="/accounts" className="underline">Accounts</Link> page.
            </p>
          )}
        </div>
      </div>

      {/* Invoices (10-state lifecycle) */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Invoices & vendor bills</p>
        <div className="space-y-2">
          {bookingInvoices.map((inv) => (
            <div key={inv.id} className="rounded-btn border border-line bg-surface px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[13px] font-semibold text-heading">{inv.invoiceNo}</span>
                  <span className="rounded-badge bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-heading">
                    {inv.type}
                  </span>
                  <Badge tone={INVOICE_TONE[inv.status]} label={inv.status} />
                  {inv.zohoInvoiceId && (
                    <span className="rounded-badge bg-[#DBEAFE] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#1D4ED8]">
                      Zoho {inv.zohoInvoiceId}
                    </span>
                  )}
                </div>
                {NEXT_LABEL[inv.status] && (
                  <Button size="sm" variant="secondary" onClick={() => advanceInvoice(inv.id)}>
                    {NEXT_LABEL[inv.status]}
                  </Button>
                )}
              </div>
              <div className="mt-2 space-y-1">
                {inv.lines.map((l, i) => (
                  <div key={i} className="flex justify-between text-xs text-body">
                    <span>{l.chargeName}</span>
                    <span className="font-mono">
                      {l.currency} {l.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {bookingInvoices.length === 0 && (
            <p className="rounded-btn border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
              No invoices yet — select charges above and generate
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
