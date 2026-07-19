import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { StatusChip } from '../ui/StatusChip'
import { Select, TextInput } from '../ui/Field'
import { AddableSelect } from '../ui/AddableSelect'
import { useDataStore } from '../../store/useDataStore'
import type { Booking, ChipStatus, InvoiceStatus } from '../../lib/types'

const INVOICE_CHIP: Record<InvoiceStatus, ChipStatus> = {
  Draft: 'Draft',
  'Pending approval': 'Pending',
  Approved: 'Booked',
  'Zoho synced': 'In Transit',
  Emailed: 'Documentation',
  'Partially paid': 'Pending',
  Paid: 'Delivered',
  Overdue: 'Overdue',
  Cancelled: 'Cancelled',
}

const NEXT_LABEL: Partial<Record<InvoiceStatus, string>> = {
  Draft: 'Submit for approval',
  'Pending approval': 'Approve',
  Approved: 'Sync to Zoho',
  'Zoho synced': 'Mark emailed',
  Emailed: 'Record part-payment',
  'Partially paid': 'Record full payment',
}

export function InvoicingTab({ booking }: { booking: Booking }) {
  const { charges, invoices, addCharge, removeCharge, generateInvoice, advanceInvoice, masters, addMasterOption } = useDataStore()
  const bookingCharges = charges.filter((c) => c.bookingId === booking.id && c.type === 'sell')
  const bookingInvoices = invoices.filter((i) => i.bookingId === booking.id)

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
                addCharge({
                  bookingId: booking.id,
                  chargeCodeId: newCode,
                  chargeName: masters.chargeCodes.find((cc) => cc.id === newCode)?.name ?? 'Charge',
                  type: 'sell',
                  amount: newAmount,
                  currency: newCurrency,
                  vendorId: null,
                })
                setNewAmount(0)
                setAdding(false)
              }}
            >
              Add
            </Button>
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

        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            disabled={selected.length === 0}
            className="disabled:opacity-50"
            onClick={() => {
              generateInvoice(booking.id, 'AR', selected)
              setSelected([])
            }}
          >
            Generate invoice
          </Button>
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
                  <StatusChip status={INVOICE_CHIP[inv.status]} />
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
