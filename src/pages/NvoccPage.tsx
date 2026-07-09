import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowRight } from 'lucide-react'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusChip } from '../components/ui/StatusChip'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Tabs } from '../components/ui/Tabs'
import { Modal } from '../components/ui/Modal'
import { Field, Select, TextInput } from '../components/ui/Field'
import { NewBookingWizard } from '../components/nvocc/NewBookingWizard'
import { useDataStore } from '../store/useDataStore'
import { cyclePct, deriveStatus, toChipStatus } from '../lib/milestones'
import { mockCustomers } from '../mocks/masters'
import type { Lead, LeadMode, Quote } from '../lib/types'

const QUOTE_CHIP: Record<Quote['status'], 'Draft' | 'Pending' | 'In Transit' | 'Booked' | 'Cancelled' | 'Overdue'> = {
  Draft: 'Draft',
  'Pending approval': 'Pending',
  Sent: 'In Transit',
  Accepted: 'Booked',
  Rejected: 'Cancelled',
  Expired: 'Overdue',
}

const LEAD_CHIP: Record<Lead['status'], 'Draft' | 'Documentation' | 'Booked' | 'Cancelled'> = {
  New: 'Draft',
  Quoted: 'Documentation',
  Won: 'Booked',
  Lost: 'Cancelled',
}

export function NvoccPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('bookings')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [leadModal, setLeadModal] = useState(false)
  const [quoteFor, setQuoteFor] = useState<Lead | null>(null)
  const [convertLead, setConvertLead] = useState<Lead | null>(null)

  const { bookings, milestones, leads } = useDataStore()

  const nvoccBookings = useMemo(
    () => bookings.filter((b) => b.module === 'nvocc'),
    [bookings],
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">NVOCC (FCL)</h1>
          <p className="mt-1 text-sm text-muted">
            We own the BL — carrier of record. Lead → Quote → Booking → BL → Financial closure.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setLeadModal(true)}>
            <Plus size={15} /> New lead
          </Button>
          <Button onClick={() => setWizardOpen(true)}>
            <Plus size={15} /> New booking
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[
          { key: 'bookings', label: 'Bookings', badge: nvoccBookings.length },
          { key: 'leads', label: 'Leads & Quotes', badge: leads.filter((l) => l.status !== 'Won' && l.status !== 'Lost').length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'bookings' ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-medium">Booking Ref</th>
                  <th className="px-3 py-3 font-medium">Direction</th>
                  <th className="px-3 py-3 font-medium">POL → POD</th>
                  <th className="px-3 py-3 font-medium">Vessel / Voyage</th>
                  <th className="px-3 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">Cycle</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {nvoccBookings.map((b) => {
                  const entries = milestones.filter((m) => m.bookingId === b.id)
                  const status = deriveStatus(b.direction, entries, b.cancelled)
                  const pct = cyclePct(b.direction, entries)
                  return (
                    <tr
                      key={b.id}
                      onClick={() => navigate(`/nvocc/${b.id}`)}
                      className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60"
                    >
                      <td className="px-5 py-3 font-mono text-xs font-medium text-link">{b.bookingRef}</td>
                      <td className="px-3 py-3 text-xs text-body">{b.direction}</td>
                      <td className="px-3 py-3 text-xs text-body">{b.pol} → {b.pod}</td>
                      <td className="px-3 py-3 text-xs text-body">{b.vesselName} / {b.voyageNo}</td>
                      <td className="px-3 py-3 text-xs text-body">{b.bookingPartyName}</td>
                      <td className="w-36 px-3 py-3">
                        <div className="flex items-center gap-2">
                          <ProgressBar pct={pct} color="#10B981" />
                          <span className="w-8 font-mono text-[11px] text-muted">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3"><StatusChip status={toChipStatus(status)} /></td>
                      <td className="px-5 py-3 text-right">
                        <ArrowRight size={15} className="inline text-muted" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <LeadsQuotesPanel
          onQuote={(l) => setQuoteFor(l)}
          onConvert={(l) => setConvertLead(l)}
        />
      )}

      <NewBookingWizard
        open={wizardOpen || !!convertLead}
        prefill={
          convertLead
            ? {
                customerId: convertLead.customerId,
                customerName: convertLead.customerName,
                origin: convertLead.origin,
                destination: convertLead.destination,
              }
            : undefined
        }
        onClose={() => {
          setWizardOpen(false)
          setConvertLead(null)
        }}
        onCreated={(id) => {
          setWizardOpen(false)
          setConvertLead(null)
          navigate(`/nvocc/${id}`)
        }}
      />

      <NewLeadModal open={leadModal} onClose={() => setLeadModal(false)} />
      {quoteFor && <NewQuoteModal lead={quoteFor} onClose={() => setQuoteFor(null)} />}
    </div>
  )
}

/* ── Leads & Quotes (doc §0.5) ───────────────────────────────── */

function LeadsQuotesPanel({
  onQuote,
  onConvert,
}: {
  onQuote: (l: Lead) => void
  onConvert: (l: Lead) => void
}) {
  const { leads, quotes, quoteAction } = useDataStore()
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Leads" />
        <div className="space-y-2 px-5 pb-5">
          {leads.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-btn border border-line bg-surface-2/40 px-4 py-3">
              <div>
                <p className="text-[13px] font-medium text-heading">{l.customerName}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {l.origin} → {l.destination} · {l.mode.toUpperCase()} · {l.cargoType} · target {l.targetDate}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusChip status={LEAD_CHIP[l.status]} />
                {l.status === 'New' && (
                  <Button size="sm" variant="secondary" onClick={() => onQuote(l)}>
                    Quote
                  </Button>
                )}
                {l.status === 'Quoted' && (
                  <Button size="sm" onClick={() => onConvert(l)}>
                    Convert
                  </Button>
                )}
              </div>
            </div>
          ))}
          {leads.length === 0 && <p className="py-6 text-center text-sm text-muted">No leads yet</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Quotes" />
        <div className="space-y-2 px-5 pb-5">
          {quotes.map((q) => {
            const lead = leads.find((l) => l.id === q.leadId)
            return (
              <div key={q.id} className="flex items-center justify-between rounded-btn border border-line bg-surface-2/40 px-4 py-3">
                <div>
                  <p className="text-[13px] font-medium text-heading">{lead?.customerName ?? q.leadId}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted">
                    buy {q.currency} {q.buyTotal.toLocaleString()} · sell {q.currency} {q.sellTotal.toLocaleString()} · valid till {q.validUntil}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip status={QUOTE_CHIP[q.status]} />
                  {q.status === 'Sent' && (
                    <>
                      <Button size="sm" onClick={() => quoteAction(q.id, 'accept')}>Accept</Button>
                      <Button size="sm" variant="ghost" onClick={() => quoteAction(q.id, 'reject')}>Reject</Button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
          {quotes.length === 0 && <p className="py-6 text-center text-sm text-muted">No quotes yet</p>}
        </div>
      </Card>
    </div>
  )
}

function NewLeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createLead = useDataStore((s) => s.createLead)
  const [customerId, setCustomerId] = useState('')
  const [walkIn, setWalkIn] = useState('')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [mode, setMode] = useState<LeadMode>('sea')
  const [cargoType, setCargoType] = useState('')
  const [targetDate, setTargetDate] = useState('')

  const customer = mockCustomers.find((c) => c.id === customerId)
  const valid = (customer || walkIn) && origin && destination

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New lead"
      subtitle="Enquiry captured — phone/email or portal 'Get a quote'"
      footer={
        <Button
          disabled={!valid}
          className="disabled:opacity-50"
          onClick={() => {
            createLead({
              customerId: customer?.id ?? null,
              customerName: customer?.name ?? `${walkIn} (walk-in)`,
              origin,
              destination,
              mode,
              cargoType,
              targetDate,
            })
            onClose()
          }}
        >
          Capture lead
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Customer (master)">
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Walk-in (enter name below)</option>
            {mockCustomers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Walk-in name (if no master record)">
          <TextInput value={walkIn} onChange={(e) => setWalkIn(e.target.value)} disabled={!!customerId} />
        </Field>
        <Field label="Origin">
          <TextInput value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g. INNSA" />
        </Field>
        <Field label="Destination">
          <TextInput value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. JEBEL ALI" />
        </Field>
        <Field label="Mode">
          <Select value={mode} onChange={(e) => setMode(e.target.value as LeadMode)}>
            <option value="sea">Sea</option>
            <option value="air">Air</option>
            <option value="road">Road</option>
          </Select>
        </Field>
        <Field label="Cargo type">
          <TextInput value={cargoType} onChange={(e) => setCargoType(e.target.value)} placeholder="e.g. Rice, 25t" />
        </Field>
        <Field label="Target date">
          <TextInput type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function NewQuoteModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const createQuote = useDataStore((s) => s.createQuote)
  const [buy, setBuy] = useState(0)
  const [sell, setSell] = useState(0)
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD')
  const [validUntil, setValidUntil] = useState('')

  const marginPct = sell > 0 ? ((sell - buy) / sell) * 100 : 0

  return (
    <Modal
      open
      onClose={onClose}
      title={`Quote — ${lead.customerName}`}
      subtitle={`${lead.origin} → ${lead.destination} · ${lead.cargoType}`}
      footer={
        <Button
          disabled={!sell || !validUntil}
          className="disabled:opacity-50"
          onClick={() => {
            createQuote(lead.id, buy, sell, currency, validUntil)
            onClose()
          }}
        >
          {marginPct > 20 ? 'Submit for approval' : 'Send quote'}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Indicative buy total">
          <TextInput type="number" value={buy || ''} onChange={(e) => setBuy(+e.target.value)} />
        </Field>
        <Field label="Sell total">
          <TextInput type="number" value={sell || ''} onChange={(e) => setSell(+e.target.value)} />
        </Field>
        <Field label="Currency">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value as 'USD' | 'INR')}>
            <option>USD</option>
            <option>INR</option>
          </Select>
        </Field>
        <Field label="Valid until">
          <TextInput type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 rounded-btn border border-line bg-surface-2/60 p-3 text-xs text-body">
        Margin: <span className={`font-mono font-semibold ${marginPct > 20 ? 'text-accent-orange' : 'text-primary'}`}>{marginPct.toFixed(1)}%</span>
        {marginPct > 20 && ' — over threshold, will route to manager approval (doc §0.5b)'}
      </div>
    </Modal>
  )
}
