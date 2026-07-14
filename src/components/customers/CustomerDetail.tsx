import { useState } from 'react'
import { Check, X, AlertTriangle, Plus, ShieldAlert } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Tabs } from '../ui/Tabs'
import { Field, FieldPill, Select, TextInput } from '../ui/Field'
import { useDataStore } from '../../store/useDataStore'
import { INCOTERMS } from '../../lib/ff'
import type {
  BlEditPermission,
  CustomerRecord,
  NotificationPref,
} from '../../lib/types'

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'commercial', label: 'Commercial Terms' },
  { key: 'portal', label: 'Access & Portal' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'compliance', label: 'Documents & Compliance' },
  { key: 'audit', label: 'Audit Log' },
]

export function CustomerDetail({ customer: c }: { customer: CustomerRecord }) {
  const [tab, setTab] = useState('general')
  const { activities } = useDataStore()
  const auditEntries = activities.filter((a) => a.bookingId === c.id)

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold">{c.displayName || c.legalName}</h3>
          <p className="font-mono text-xs text-muted">{c.code} · created {c.createdAt}</p>
        </div>
        <LifecycleActions customer={c} />
      </div>

      {c.status === 'Prospect' && <OnboardingChecklist customer={c} />}

      <div className="mt-4">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <div className="mt-4">
        {tab === 'general' && <GeneralTab c={c} />}
        {tab === 'contacts' && <ContactsTab c={c} />}
        {tab === 'commercial' && <CommercialTab c={c} />}
        {tab === 'portal' && <PortalTab c={c} />}
        {tab === 'notifications' && <NotificationsTab c={c} />}
        {tab === 'compliance' && <ComplianceTab c={c} />}
        {tab === 'audit' && (
          <div>
            <p className="mb-2 text-xs text-muted">
              Every field change, status change and portal-access change — immutable, with user and timestamp.
            </p>
            {auditEntries.map((a) => (
              <div key={a.id} className="flex items-start gap-3 border-b border-line py-2 text-xs last:border-0">
                <span className="w-32 shrink-0 font-mono text-muted">{new Date(a.at).toLocaleString()}</span>
                <span className="w-28 shrink-0 font-medium text-heading">{a.actor}</span>
                <span className="text-body">{a.action}</span>
              </div>
            ))}
            {auditEntries.length === 0 && <p className="py-4 text-center text-sm text-muted">No changes logged yet</p>}
          </div>
        )}
      </div>
    </Card>
  )
}

/* ── Lifecycle (§8) ──────────────────────────────────────────── */

function LifecycleActions({ customer: c }: { customer: CustomerRecord }) {
  const { updateCustomer, requestBlacklist, requestBlacklistReversal } = useDataStore()
  const [blacklistOpen, setBlacklistOpen] = useState(false)
  const [reason, setReason] = useState('Non-payment')

  return (
    <div className="flex flex-wrap items-center gap-2">
      {c.status === 'Active' && (
        <>
          <Button size="sm" variant="secondary" onClick={() => updateCustomer(c.id, { status: 'On Hold' }, 'Status → On Hold (manual/credit control) — new bookings blocked, existing continue')}>
            Put On Hold
          </Button>
          <Button size="sm" variant="secondary" onClick={() => updateCustomer(c.id, { status: 'Inactive', portalEnabled: false }, 'Status → Inactive — portal access auto-suspended (not deleted)')}>
            Set Inactive
          </Button>
          {!blacklistOpen ? (
            <Button size="sm" variant="ghost" className="text-accent-coral" onClick={() => setBlacklistOpen(true)}>
              <ShieldAlert size={13} /> Blacklist…
            </Button>
          ) : (
            <span className="flex items-center gap-2">
              <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                <option>Non-payment</option>
                <option>Fraud</option>
                <option>Sanctions match</option>
                <option>Compliance breach</option>
                <option>Other</option>
              </Select>
              <Button size="sm" variant="secondary" className="text-accent-coral" onClick={() => { requestBlacklist(c.id, reason); setBlacklistOpen(false) }}>
                Request (→ Regional Head)
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setBlacklistOpen(false)}>Cancel</Button>
            </span>
          )}
        </>
      )}
      {c.status === 'On Hold' && (
        <Button size="sm" onClick={() => updateCustomer(c.id, { status: 'Active' }, 'Balance cleared / Finance override — status returns to Active')}>
          Clear hold → Active
        </Button>
      )}
      {c.status === 'Inactive' && (
        <Button size="sm" onClick={() => updateCustomer(c.id, { status: 'Active' }, 'Reactivated — manual admin action')}>
          Reactivate
        </Button>
      )}
      {c.status === 'Blacklisted' && (
        <Button size="sm" variant="secondary" onClick={() => requestBlacklistReversal(c.id)}>
          Request reversal (→ Regional Head)
        </Button>
      )}
    </div>
  )
}

/* ── Onboarding checklist (§8.1 — the 4-condition gate) ──────── */

function OnboardingChecklist({ customer: c }: { customer: CustomerRecord }) {
  const kycOk = c.kycDocs.length > 0 && c.kycDocs.every((d) => d.verified)
  const conditions = [
    { label: 'KYC documents uploaded & verified', ok: kycOk },
    { label: 'Sanctions screening: Clear', ok: c.screening === 'Clear' },
    { label: 'Credit approved (or cash-in-advance)', ok: c.creditApproved || c.cashInAdvanceOnly },
    { label: 'Sales Manager sign-off', ok: c.salesSignoff },
  ]
  return (
    <div className="mt-4 rounded-btn border border-[#FDE68A] bg-[#FEF3C7]/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#B45309]">
        Onboarding — all four conditions auto-flip Prospect → Active
      </p>
      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {conditions.map((cond) => (
          <p key={cond.label} className="flex items-center gap-2 text-xs">
            {cond.ok ? (
              <Check size={13} className="text-primary" />
            ) : (
              <X size={13} className="text-accent-coral" />
            )}
            <span className={cond.ok ? 'text-heading' : 'text-body'}>{cond.label}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

/* ── Tab: General (§3) ───────────────────────────────────────── */

function GeneralTab({ c }: { c: CustomerRecord }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <FieldPill label="Legal name" value={c.legalName} />
      <FieldPill label="Trading name" value={c.displayName} />
      <FieldPill label="Customer type" value={c.roles.join(', ')} />
      <FieldPill label="Industry" value={c.industry} />
      <FieldPill label="Tax ID (GSTIN/TRN)" value={c.taxId} />
      <FieldPill label="Billing address" value={c.billingAddress} />
      <FieldPill label="Sales owner" value={c.salesOwner} />
      <FieldPill label="CS rep" value={c.csRep} />
      <FieldPill label="Source" value={c.source} />
    </div>
  )
}

/* ── Tab: Contacts (§3.2) ────────────────────────────────────── */

function ContactsTab({ c }: { c: CustomerRecord }) {
  const { updateCustomer } = useDataStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [dept, setDept] = useState<'Commercial' | 'Operations' | 'Finance' | 'Documentation'>('Operations')
  const primaryCount = c.contacts.filter((x) => x.primary).length

  return (
    <div className="space-y-3">
      {primaryCount !== 1 && (
        <p className="flex items-center gap-1.5 text-xs text-accent-orange">
          <AlertTriangle size={12} /> Exactly one contact should be marked primary — currently {primaryCount}.
        </p>
      )}
      <div className="space-y-1.5">
        {c.contacts.map((ct) => (
          <div key={ct.id} className="flex flex-wrap items-center gap-2 rounded-btn border border-line bg-surface-2/40 px-3 py-2 text-xs">
            <span className="font-medium text-heading">{ct.name}</span>
            <span className="text-muted">{ct.designation}</span>
            <span className="rounded-badge bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-heading">{ct.department}</span>
            {ct.primary && (
              <span className="rounded-badge bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-semibold text-[#15803D]">primary</span>
            )}
            <span className="ml-auto text-muted">{ct.email} · {ct.phone} · {ct.preferredMethod}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2 rounded-btn border border-line bg-surface-2/50 p-3">
        <div className="w-40"><p className="mb-1 text-[11px] text-body">Name</p><TextInput value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="w-52"><p className="mb-1 text-[11px] text-body">Email</p><TextInput value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="w-40"><p className="mb-1 text-[11px] text-body">Department</p>
          <Select value={dept} onChange={(e) => setDept(e.target.value as typeof dept)}>
            <option>Commercial</option><option>Operations</option><option>Finance</option><option>Documentation</option>
          </Select>
        </div>
        <Button
          size="sm" variant="secondary"
          disabled={!name || !email.includes('@')}
          className="disabled:opacity-50"
          onClick={() => {
            updateCustomer(c.id, {
              contacts: [...c.contacts, {
                id: `ct-${Date.now()}`, name, designation: '', email, phone: '', department: dept,
                preferredMethod: 'Email', primary: c.contacts.length === 0,
              }],
            }, `Contact added: ${name} (${dept})`)
            setName(''); setEmail('')
          }}
        >
          <Plus size={13} /> Add contact
        </Button>
      </div>
    </div>
  )
}

/* ── Tab: Commercial Terms (§4) ──────────────────────────────── */

function CommercialTab({ c }: { c: CustomerRecord }) {
  const { updateCustomer, requestCreditLimit } = useDataStore()
  const [newLimit, setNewLimit] = useState(0)
  const [lane, setLane] = useState({ origin: '', destination: '', rate: 0 })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Default Incoterm (pre-fills bookings)">
          <Select value={c.defaultIncoterm} onChange={(e) => updateCustomer(c.id, { defaultIncoterm: e.target.value }, `Default Incoterm → ${e.target.value}`)}>
            {INCOTERMS.map((i) => <option key={i}>{i}</option>)}
          </Select>
        </Field>
        <Field label="Payment terms">
          <Select value={c.paymentTerms} onChange={(e) => updateCustomer(c.id, { paymentTerms: e.target.value }, `Payment terms → ${e.target.value}`)}>
            <option>Net 15</option><option>Net 30</option><option>Net 45</option><option>Net 60</option><option>Advance 50%</option><option>Cash in advance</option>
          </Select>
        </Field>
        <Field label="Credit hold policy (read by Finance)">
          <Select value={c.creditHoldPolicy} onChange={(e) => updateCustomer(c.id, { creditHoldPolicy: e.target.value as CustomerRecord['creditHoldPolicy'] }, `Credit hold policy → ${e.target.value}`)}>
            <option>Hard-block</option><option>Soft-warn</option>
          </Select>
        </Field>
        <Field label="Invoicing">
          <Select
            value={c.consolidatedInvoicing ? 'consolidated' : 'per-shipment'}
            onChange={(e) => updateCustomer(c.id, { consolidatedInvoicing: e.target.value === 'consolidated' }, `Consolidated invoicing → ${e.target.value === 'consolidated' ? 'Yes' : 'No'}`)}
          >
            <option value="per-shipment">Per shipment</option>
            <option value="consolidated">Consolidated</option>
          </Select>
        </Field>
      </div>

      <div className="rounded-btn border border-line bg-surface-2/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Credit limit — gated by Finance approval matrix</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="font-mono text-lg font-bold text-heading">
            {c.cashInAdvanceOnly ? 'Cash in advance' : `${c.creditCurrency} ${c.creditLimit.toLocaleString()}`}
          </span>
          {c.pendingCreditRequest ? (
            <span className="rounded-badge bg-[#FEF3C7] px-2.5 py-1 text-xs font-semibold text-[#B45309]">
              ${c.pendingCreditRequest.toLocaleString()} awaiting Finance approval
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <div className="w-32">
                <TextInput type="number" placeholder="New limit $" value={newLimit || ''} onChange={(e) => setNewLimit(+e.target.value)} />
              </div>
              <Button size="sm" variant="secondary" disabled={!newLimit} className="disabled:opacity-50" onClick={() => { requestCreditLimit(c.id, newLimit); setNewLimit(0) }}>
                Request change
              </Button>
            </span>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Contracted lane rates (override standard tariff)</p>
        <div className="space-y-1.5">
          {c.laneRates.map((lr) => (
            <div key={lr.id} className="flex items-center gap-3 rounded-btn border border-line bg-surface-2/40 px-3 py-2 text-xs">
              <span className="font-medium text-heading">{lr.origin} → {lr.destination}</span>
              <span className="text-muted">{lr.mode}</span>
              <span className="ml-auto font-mono text-body">{lr.currency} {lr.rate.toLocaleString()} · valid till {lr.validUntil}</span>
            </div>
          ))}
          {c.laneRates.length === 0 && <p className="text-xs text-muted">None — standard tariff / price list applies</p>}
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="w-36"><p className="mb-1 text-[11px] text-body">Origin</p><TextInput value={lane.origin} onChange={(e) => setLane((l) => ({ ...l, origin: e.target.value.toUpperCase() }))} /></div>
          <div className="w-36"><p className="mb-1 text-[11px] text-body">Destination</p><TextInput value={lane.destination} onChange={(e) => setLane((l) => ({ ...l, destination: e.target.value.toUpperCase() }))} /></div>
          <div className="w-28"><p className="mb-1 text-[11px] text-body">Rate (USD)</p><TextInput type="number" value={lane.rate || ''} onChange={(e) => setLane((l) => ({ ...l, rate: +e.target.value }))} /></div>
          <Button
            size="sm" variant="secondary"
            disabled={!lane.origin || !lane.destination || !lane.rate}
            className="disabled:opacity-50"
            onClick={() => {
              updateCustomer(c.id, {
                laneRates: [...c.laneRates, { id: `lr-${Date.now()}`, origin: lane.origin, destination: lane.destination, mode: 'Sea FCL', rate: lane.rate, currency: 'USD', validUntil: '2026-12-31' }],
              }, `Contracted lane rate added: ${lane.origin} → ${lane.destination} $${lane.rate}`)
              setLane({ origin: '', destination: '', rate: 0 })
            }}
          >
            <Plus size={13} /> Add lane rate
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ── Tab: Access & Portal (§5) ───────────────────────────────── */

function PortalTab({ c }: { c: CustomerRecord }) {
  const { updateCustomer } = useDataStore()
  const toggle = (field: keyof CustomerRecord, label: string) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    updateCustomer(c.id, { [field]: e.target.value === 'yes' } as Partial<CustomerRecord>, `${label} → ${e.target.value === 'yes' ? 'Yes' : 'No'}`)

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Every toggle here is enforced server-side (Row Level Security) — the portal has no permission logic of its own.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Portal access (master switch)">
          <Select value={c.portalEnabled ? 'yes' : 'no'} onChange={toggle('portalEnabled', 'Portal access')}>
            <option value="yes">Enabled</option><option value="no">Disabled</option>
          </Select>
        </Field>
        <Field label="NVOCC bookings visible">
          <Select value={c.visNvocc ? 'yes' : 'no'} onChange={toggle('visNvocc', 'NVOCC visibility')}>
            <option value="yes">Yes</option><option value="no">No</option>
          </Select>
        </Field>
        <Field label="Freight FWD visible">
          <Select value={c.visFf ? 'yes' : 'no'} onChange={toggle('visFf', 'FF visibility')}>
            <option value="yes">Yes</option><option value="no">No</option>
          </Select>
        </Field>
        <Field label="BL edit permission">
          <Select
            value={c.blEditPermission}
            onChange={(e) => updateCustomer(c.id, { blEditPermission: e.target.value as BlEditPermission }, `BL Edit Permission changed from ${c.blEditPermission} to ${e.target.value}`)}
          >
            <option>None</option>
            <option>Can request edits</option>
            <option>Cannot view drafts</option>
          </Select>
        </Field>
        <Field label="Booking creation">
          <Select value={c.bookingCreation ? 'yes' : 'no'} onChange={toggle('bookingCreation', 'Booking creation')}>
            <option value="yes">Self-submit allowed</option><option value="no">View only</option>
          </Select>
        </Field>
        <Field label="Quote requests">
          <Select value={c.quoteRequest ? 'yes' : 'no'} onChange={toggle('quoteRequest', 'Quote requests')}>
            <option value="yes">Allowed (feeds Lead capture)</option><option value="no">Through BD only</option>
          </Select>
        </Field>
        <Field label="Document download">
          <Select value={c.docDownload} onChange={(e) => updateCustomer(c.id, { docDownload: e.target.value as CustomerRecord['docDownload'] }, `Document download → ${e.target.value}`)}>
            <option>All</option><option>Invoice</option><option>BL</option><option>None</option>
          </Select>
        </Field>
        <Field label="Enterprise security">
          <Select
            value={c.mfaMandated ? 'yes' : 'no'}
            onChange={(e) => updateCustomer(c.id, { mfaMandated: e.target.value === 'yes', ipRestriction: e.target.value === 'yes' }, `Enterprise security (IP allow-list + mandatory MFA) → ${e.target.value === 'yes' ? 'On' : 'Off'}`)}
          >
            <option value="no">Standard (MFA optional)</option>
            <option value="yes">IP allow-list + mandatory MFA</option>
          </Select>
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Portal users (RLS-scoped to this customer)</p>
        <div className="space-y-1.5">
          {c.portalUsers.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-2 rounded-btn border border-line bg-surface-2/40 px-3 py-2 text-xs">
              <span className="font-medium text-heading">{u.name}</span>
              <span className="text-muted">{u.email}</span>
              <span className="rounded-badge bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-heading">{u.role}</span>
              {u.mfaEnabled && <span className="rounded-badge bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-semibold text-[#15803D]">MFA</span>}
              <span className="ml-auto text-muted">
                {u.status} · last login {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'never'}
              </span>
              <Button
                size="sm" variant="ghost"
                onClick={() =>
                  updateCustomer(c.id, {
                    portalUsers: c.portalUsers.map((x) => (x.id === u.id ? { ...x, status: x.status === 'Active' ? 'Suspended' : 'Active' } : x)),
                  }, `Portal user ${u.name} ${u.status === 'Active' ? 'suspended' : 'reactivated'}`)
                }
              >
                {u.status === 'Active' ? 'Suspend' : 'Reactivate'}
              </Button>
            </div>
          ))}
          {c.portalUsers.length === 0 && <p className="text-xs text-muted">No portal users yet</p>}
        </div>
      </div>
    </div>
  )
}

/* ── Tab: Notifications (§6 — event × channel × digest matrix) ─ */

const CHANNELS: NotificationPref['channels'] = ['Email', 'WhatsApp', 'SMS', 'In-app']

function NotificationsTab({ c }: { c: CustomerRecord }) {
  const { updateCustomer } = useDataStore()
  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        A matrix, not a single toggle — event type × channel × digest frequency, per subscribed contact.
      </p>
      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-[10px] uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5 font-medium">Event</th>
              {CHANNELS.map((ch) => <th key={ch} className="px-3 py-2.5 text-center font-medium">{ch}</th>)}
              <th className="px-4 py-2.5 font-medium">Frequency</th>
            </tr>
          </thead>
          <tbody>
            {c.notificationPrefs.map((p) => (
              <tr key={p.event} className="border-b border-line bg-surface last:border-0">
                <td className="px-4 py-2.5 font-medium text-heading">{p.event}</td>
                {CHANNELS.map((ch) => (
                  <td key={ch} className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={p.channels.includes(ch)}
                      onChange={() =>
                        updateCustomer(c.id, {
                          notificationPrefs: c.notificationPrefs.map((x) =>
                            x.event === p.event
                              ? { ...x, channels: x.channels.includes(ch) ? x.channels.filter((y) => y !== ch) : [...x.channels, ch] }
                              : x,
                          ),
                        }, `Notification ${p.event}: ${ch} ${p.channels.includes(ch) ? 'off' : 'on'}`)
                      }
                      className="h-3.5 w-3.5 accent-[#10B981]"
                    />
                  </td>
                ))}
                <td className="px-4 py-2.5">
                  <select
                    value={p.digest}
                    disabled={p.event === 'Customs Hold'}
                    onChange={(e) =>
                      updateCustomer(c.id, {
                        notificationPrefs: c.notificationPrefs.map((x) =>
                          x.event === p.event ? { ...x, digest: e.target.value as NotificationPref['digest'] } : x,
                        ),
                      }, `Notification ${p.event}: digest → ${e.target.value}`)
                    }
                    className="rounded-btn border border-line bg-surface px-2 py-1 text-xs text-body"
                  >
                    <option>Real-time</option>
                    <option>Daily digest</option>
                  </select>
                  {p.event === 'Customs Hold' && <span className="ml-1.5 text-[10px] text-muted">(time-sensitive — real-time only)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Tab: Documents & Compliance (§7) ────────────────────────── */

function ComplianceTab({ c }: { c: CustomerRecord }) {
  const { updateCustomer } = useDataStore()
  const soon = (d: string) => new Date(d).getTime() - Date.now() < 60 * 86400000

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-btn border border-line bg-surface-2/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sanctions / denied-party screening</p>
          <div className="mt-2 flex items-center gap-2">
            <Select
              value={c.screening}
              onChange={(e) => updateCustomer(c.id, { screening: e.target.value as CustomerRecord['screening'] }, `Screening status → ${e.target.value}`)}
            >
              <option>Clear</option>
              <option>Flagged</option>
              <option>Under Review</option>
            </Select>
          </div>
          {c.screening === 'Flagged' && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-accent-coral">
              <AlertTriangle size={12} /> Flagged — onboarding blocked until Compliance clears manually. Re-screening every 6 months.
            </p>
          )}
        </div>
        <div className="rounded-btn border border-line bg-surface-2/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sales Manager sign-off (§8.1)</p>
          {c.salesSignoff ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-primary"><Check size={13} /> Commercial terms signed off</p>
          ) : (
            <Button size="sm" className="mt-2" onClick={() => updateCustomer(c.id, { salesSignoff: true }, 'Sales Manager sign-off on commercial terms recorded')}>
              Record sign-off
            </Button>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">KYC documents — expiry tracked</p>
        <div className="space-y-1.5">
          {c.kycDocs.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-btn border border-line bg-surface-2/40 px-3 py-2 text-xs">
              <span className="font-medium text-heading">{d.type}</span>
              <span className={`font-mono ${soon(d.expiry) ? 'font-semibold text-accent-coral' : 'text-muted'}`}>
                expires {d.expiry}{soon(d.expiry) && ' — <60d'}
              </span>
              {d.verified ? (
                <span className="ml-auto flex items-center gap-1 text-primary"><Check size={12} /> verified</span>
              ) : (
                <Button
                  size="sm" variant="secondary" className="ml-auto"
                  onClick={() => updateCustomer(c.id, { kycDocs: c.kycDocs.map((x) => (x.id === d.id ? { ...x, verified: true } : x)) }, `KYC verified: ${d.type}`)}
                >
                  Verify
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button
          size="sm" variant="secondary" className="mt-2"
          onClick={() =>
            updateCustomer(c.id, {
              kycDocs: [...c.kycDocs, { id: `kd-${Date.now()}`, type: 'Trade license', expiry: '2027-12-31', verified: false }],
            }, 'KYC document uploaded: Trade license')
          }
        >
          <Plus size={13} /> Upload KYC document
        </Button>
      </div>
    </div>
  )
}
