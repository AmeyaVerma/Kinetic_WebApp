import { useEffect, useMemo, useState } from 'react'
import { FileText, Ship, Boxes, Users, Receipt } from 'lucide-react'
import { FieldPill } from '../ui/Field'
import { Badge, type BadgeTone } from '../ui/Badge'
import { useDataStore } from '../../store/useDataStore'
import { supabase } from '../../lib/supabaseClient'
import { docStatusOf } from '../../lib/docStatus'
import { milestoneDefs } from '../../lib/milestones'
import type { Booking } from '../../lib/types'

const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-GB') : '—'

interface InvoiceLine {
  invoice_no: string
  status: string
  total_inr: number | string | null
  doc_kind: string | null
}

/**
 * Overview — what a booking is, in one screen (spec U2).
 *
 * A booking used to open on Container info, which answers a question nobody
 * asks first. This answers the ones they do: where is it going, on what, for
 * whom, is the BL out, has it been invoiced, and what is the next thing
 * somebody has to do.
 *
 * Nothing here is editable and nothing is computed twice -- each block reads
 * the same source the tab behind it reads, so Overview cannot drift from the
 * detail. The cycle percentage, the roadmap and the latest activity are
 * deliberately left out: the page header already carries them, above the
 * tabs, on every tab.
 */
export function BookingOverviewTab({ booking }: { booking: Booking }) {
  const { blStates, charges, milestones } = useDataStore()
  const [invoices, setInvoices] = useState<InvoiceLine[]>([])

  // Invoices are read from Postgres, not the store. The store's copy is the
  // seeded list -- the same trap that made global search miss real invoices.
  useEffect(() => {
    if (!booking.dbId) {
      setInvoices([])
      return
    }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('invoices')
        .select('invoice_no, status, total_inr, doc_kind')
        .eq('booking_id', booking.dbId)
        .order('invoice_date', { ascending: false })
      if (!cancelled) setInvoices((data as InvoiceLine[]) ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [booking.dbId])

  const bl = blStates.find((b) => b.bookingId === booking.id)
  const blStatus = docStatusOf(bl)

  const money = useMemo(() => {
    const mine = charges.filter((c) => c.bookingId === booking.id)
    const by = (type: 'buy' | 'sell', currency: 'USD' | 'INR') =>
      mine
        .filter((c) => c.type === type && c.currency === currency)
        .reduce((a, c) => a + c.amount, 0)
    // Currencies are kept apart, never added -- see src/lib/kpi.ts.
    return {
      usd: { sell: by('sell', 'USD'), buy: by('buy', 'USD') },
      inr: { sell: by('sell', 'INR'), buy: by('buy', 'INR') },
      lines: mine.length,
    }
  }, [charges, booking.id])

  /** The first milestone on this direction's ladder that nobody has marked. */
  const nextStep = useMemo(() => {
    const done = new Set(
      milestones
        .filter((m) => m.bookingId === booking.id && m.completedAt)
        .map((m) => m.key),
    )
    return milestoneDefs(booking.direction).find((d) => !done.has(d.key)) ?? null
  }, [milestones, booking.direction, booking.id])

  const blTone: BadgeTone =
    blStatus === 'Released' ? 'done' : blStatus === 'Approved' ? 'success' : 'warn'

  return (
    <div className="space-y-5">
      <Section icon={<Ship size={15} />} title="Shipment">
        <FieldPill label="Direction" value={booking.direction} />
        <FieldPill label="Port of loading" value={booking.pol} />
        <FieldPill label="Port of discharge" value={booking.pod} />
        <FieldPill label="Vessel / voyage" value={[booking.vesselName, booking.voyageNo].filter(Boolean).join(' / ')} />
        <FieldPill label="ETD" value={day(booking.etd)} />
        <FieldPill label="ETA" value={day(booking.eta)} />
      </Section>

      <Section icon={<Users size={15} />} title="Parties">
        <FieldPill label="Booking party" value={booking.bookingPartyName} />
        <FieldPill label="Shipper" value={booking.shipper} />
        <FieldPill label="Consignee" value={booking.consignee} />
        <FieldPill label="Notify party" value={booking.notifyParty} />
      </Section>

      <Section icon={<Boxes size={15} />} title="Equipment">
        <FieldPill label="Container type" value={booking.containerType} />
        <FieldPill label="Containers" value={String(booking.containerQty ?? 0)} />
        <FieldPill label="Free days (origin)" value={String(booking.freeDaysOrigin ?? 0)} />
        <FieldPill label="Free days (destination)" value={String(booking.freeDaysDest ?? 0)} />
        <FieldPill label="Commodity" value={booking.commodity} />
        <FieldPill label="Gross weight" value={booking.grossWeightKg ? `${booking.grossWeightKg} kg` : ''} />
      </Section>

      <Section icon={<FileText size={15} />} title="Documents">
        <div className="rounded-btn border border-line bg-surface-2/60 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Bill of lading</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] text-heading">
              {bl?.blNumber || bl?.currentFields?.blNumber || booking.hblNo || 'Not created'}
            </span>
            {bl && <Badge tone={blTone} label={blStatus} />}
          </div>
        </div>
        <FieldPill label="MBL number" value={booking.mblNo ?? ''} />
        <FieldPill label="Next milestone" value={nextStep ? nextStep.label : 'All marked'} />
      </Section>

      <Section icon={<Receipt size={15} />} title="Money">
        {money.usd.sell !== 0 || money.usd.buy !== 0 ? (
          <FieldPill
            label="Dollar charges (sell / cost)"
            value={`$${money.usd.sell.toLocaleString()} / $${money.usd.buy.toLocaleString()}`}
          />
        ) : null}
        {money.inr.sell !== 0 || money.inr.buy !== 0 ? (
          <FieldPill
            label="Rupee charges (sell / cost)"
            value={`₹${money.inr.sell.toLocaleString('en-IN')} / ₹${money.inr.buy.toLocaleString('en-IN')}`}
          />
        ) : null}
        <FieldPill label="Charge lines" value={String(money.lines)} />
        <div className="rounded-btn border border-line bg-surface-2/60 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Invoices</p>
          {invoices.length === 0 ? (
            <p className="mt-0.5 text-[13px] text-heading">None raised</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {invoices.map((i) => (
                <li key={i.invoice_no} className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="font-mono text-heading">{i.invoice_no}</span>
                  <span className="text-muted">₹{Number(i.total_inr ?? 0).toLocaleString('en-IN')}</span>
                  <Badge tone={i.status === 'Paid' ? 'success' : 'warn'} label={i.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {money.lines === 0 && (
        <p className="text-xs text-muted">
          No costing has been entered on this booking, so there is nothing to invoice yet.
        </p>
      )}
    </div>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-heading">
        <span className="text-primary">{icon}</span>
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  )
}
