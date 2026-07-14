import { useState } from 'react'
import { Check, X, AlertTriangle, Plus, ShieldAlert, Gauge } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Tabs } from '../ui/Tabs'
import { Field, FieldPill, Select, TextInput } from '../ui/Field'
import { ProgressBar } from '../ui/ProgressBar'
import { useDataStore } from '../../store/useDataStore'
import type { AgentBlEdit, AgentRecord, SoaCycle } from '../../lib/types'

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'commercial', label: 'Commercial Terms' },
  { key: 'portal', label: 'Access & Portal' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'compliance', label: 'Documents & Compliance' },
  { key: 'performance', label: 'Performance & SLA' },
  { key: 'audit', label: 'Audit Log' },
]

export function AgentDetail({ agent: a }: { agent: AgentRecord }) {
  const [tab, setTab] = useState('general')
  const { activities } = useDataStore()
  const auditEntries = activities.filter((x) => x.bookingId === a.id)

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold">{a.displayName || a.legalName}</h3>
          <p className="font-mono text-xs text-muted">{a.code} · {a.direction} · created {a.createdAt}</p>
        </div>
        <LifecycleActions agent={a} />
      </div>

      {a.status === 'Prospect' && <OnboardingChecklist agent={a} />}

      <div className="mt-4">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <div className="mt-4">
        {tab === 'general' && <GeneralTab a={a} />}
        {tab === 'contacts' && <ContactsTab a={a} />}
        {tab === 'commercial' && <CommercialTab a={a} />}
        {tab === 'portal' && <PortalTab a={a} />}
        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'compliance' && <ComplianceTab a={a} />}
        {tab === 'performance' && <PerformanceTab a={a} />}
        {tab === 'audit' && (
          <div>
            <p className="mb-2 text-xs text-muted">
              Every field, status and permission change — access changes logged individually given the risk profile.
            </p>
            {auditEntries.map((x) => (
              <div key={x.id} className="flex items-start gap-3 border-b border-line py-2 text-xs last:border-0">
                <span className="w-32 shrink-0 font-mono text-muted">{new Date(x.at).toLocaleString()}</span>
                <span className="w-32 shrink-0 font-medium text-heading">{x.actor}</span>
                <span className="text-body">{x.action}</span>
              </div>
            ))}
            {auditEntries.length === 0 && <p className="py-4 text-center text-sm text-muted">No changes logged yet</p>}
          </div>
        )}
      </div>
    </Card>
  )
}

/* ── Lifecycle (§9) ──────────────────────────────────────────── */

function LifecycleActions({ agent: a }: { agent: AgentRecord }) {
  const { suspendAgent, clearAgentSuspension, requestAgentTermination, updateAgent } = useDataStore()
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [reason, setReason] = useState('Compliance issue')

  return (
    <div className="flex flex-wrap items-center gap-2">
      {a.status === 'Active' && (
        <>
          {!suspendOpen ? (
            <Button size="sm" variant="ghost" className="text-accent-coral" onClick={() => setSuspendOpen(true)}>
              <ShieldAlert size={13} /> Suspend (immediate)…
            </Button>
          ) : (
            <span className="flex items-center gap-2">
              <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                <option>Performance flag</option>
                <option>Compliance issue</option>
                <option>Direct report</option>
              </Select>
              <Button size="sm" variant="secondary" className="text-accent-coral" onClick={() => { suspendAgent(a.id, reason); setSuspendOpen(false) }}>
                Suspend now (Ops Manager)
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSuspendOpen(false)}>Cancel</Button>
            </span>
          )}
        </>
      )}
      {a.status === 'Suspended' && (
        <>
          <Button size="sm" onClick={() => clearAgentSuspension(a.id)}>
            Investigation cleared → Active
          </Button>
          <Button
            size="sm" variant="secondary" className="text-accent-coral"
            onClick={() => requestAgentTermination(a.id)}
            title={a.soaBalanceUsd !== 0 ? 'Blocked — SOA must be reconciled first' : ''}
          >
            Terminate… {a.soaBalanceUsd !== 0 && '(SOA open — will block)'}
          </Button>
          {a.soaBalanceUsd !== 0 && (
            <Button
              size="sm" variant="ghost"
              onClick={() => updateAgent(a.id, { soaBalanceUsd: 0 }, 'Final SOA settlement completed — balance reconciled to zero in both directions')}
            >
              Settle SOA (${Math.abs(a.soaBalanceUsd).toLocaleString()})
            </Button>
          )}
        </>
      )}
      {a.status === 'Terminated' && (
        <span className="text-xs text-muted">Terminal — history remains queryable for audit</span>
      )}
    </div>
  )
}

/* ── Onboarding (§9.1 — Regional Head gate) ──────────────────── */

function OnboardingChecklist({ agent: a }: { agent: AgentRecord }) {
  const { requestAgentActivation, updateAgent } = useDataStore()
  const agreement = a.documents.find((d) => d.type === 'Agency agreement')
  const accreditationOk =
    !a.accreditationRequired ||
    a.documents.some((d) => (d.type === 'IATA certification' || d.type === 'FIATA certification') && d.verified)
  const conditions = [
    { label: 'Agency agreement uploaded, validity confirmed', ok: !!agreement?.verified },
    { label: a.accreditationRequired ? 'Accreditation (IATA/FIATA) verified' : 'Accreditation — not required for this type', ok: accreditationOk },
    { label: 'Commercial terms proposed & confirmed', ok: a.commercialConfirmed },
    { label: 'Regional Head approval', ok: false },
  ]
  const readyToSubmit = conditions.slice(0, 3).every((c) => c.ok)

  return (
    <div className="mt-4 rounded-btn border border-[#FDE68A] bg-[#FEF3C7]/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#B45309]">
        Onboarding — Regional Head gate (higher bar than customers: Active grants booking/document rights)
      </p>
      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {conditions.map((cond) => (
          <p key={cond.label} className="flex items-center gap-2 text-xs">
            {cond.ok ? <Check size={13} className="text-primary" /> : <X size={13} className="text-accent-coral" />}
            <span className={cond.ok ? 'text-heading' : 'text-body'}>{cond.label}</span>
          </p>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {!a.commercialConfirmed && (
          <Button size="sm" variant="secondary" onClick={() => updateAgent(a.id, { commercialConfirmed: true }, 'Commercial terms (commission, SOA cycle, disbursement limit) confirmed')}>
            Confirm commercial terms
          </Button>
        )}
        {a.activationRequested ? (
          <span className="rounded-badge bg-surface-2 px-2.5 py-1 text-xs font-medium text-heading">
            Awaiting Regional Head in Approvals queue
          </span>
        ) : (
          <Button size="sm" disabled={!readyToSubmit} className="disabled:opacity-50" onClick={() => requestAgentActivation(a.id)}>
            Submit for Regional Head approval
          </Button>
        )}
      </div>
    </div>
  )
}

/* ── Tabs ────────────────────────────────────────────────────── */

function GeneralTab({ a }: { a: AgentRecord }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <FieldPill label="Legal name" value={a.legalName} />
      <FieldPill label="Agent type" value={a.agentTypes.join(', ')} />
      <FieldPill label="Direction" value={a.direction} />
      <FieldPill label="Ports / regions" value={a.portsCovered.join(', ')} />
      <FieldPill label="Tax ID" value={a.taxId} />
      <FieldPill label="Address" value={a.address} />
      <FieldPill label="Relationship owner" value={a.relationshipOwner} />
    </div>
  )
}

function ContactsTab({ a }: { a: AgentRecord }) {
  const primaryCount = a.contacts.filter((x) => x.primary).length
  return (
    <div className="space-y-3">
      {primaryCount !== 1 && (
        <p className="flex items-center gap-1.5 text-xs text-accent-orange">
          <AlertTriangle size={12} /> Exactly one contact should be marked primary — currently {primaryCount}.
        </p>
      )}
      {a.contacts.map((ct) => (
        <div key={ct.id} className="flex flex-wrap items-center gap-2 rounded-btn border border-line bg-surface-2/40 px-3 py-2 text-xs">
          <span className="font-medium text-heading">{ct.name}</span>
          <span className="text-muted">{ct.designation}</span>
          <span className="rounded-badge bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-heading">{ct.department}</span>
          {ct.primary && <span className="rounded-badge bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-semibold text-[#15803D]">primary</span>}
          <span className="ml-auto text-muted">{ct.email} · {ct.phone} · {ct.preferredMethod}</span>
        </div>
      ))}
    </div>
  )
}

function CommercialTab({ a }: { a: AgentRecord }) {
  const { updateAgent, requestCommissionChange } = useDataStore()
  const [proposal, setProposal] = useState('')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FieldPill
          label={a.direction === 'Both' ? 'Commission (we are Principal)' : 'Commission structure'}
          value={a.commissionType === '% of freight' ? `${a.commissionValue}% of freight` : a.commissionType === 'Flat fee per shipment' ? `$${a.commissionValue} per shipment` : 'Tiered by volume'}
        />
        {a.direction === 'Both' && (
          <FieldPill
            label="Commission (we are Agent)"
            value={a.commissionTypeReverse === '% of freight' ? `${a.commissionValueReverse}% of freight` : a.commissionTypeReverse === 'Flat fee per shipment' ? `$${a.commissionValueReverse} per shipment` : 'Tiered by volume'}
          />
        )}
        <Field label="Agency SOA cycle">
          <Select value={a.soaCycle} onChange={(e) => updateAgent(a.id, { soaCycle: e.target.value as SoaCycle }, `SOA cycle → ${e.target.value}`)}>
            <option>Weekly</option><option>Monthly</option><option>Per-shipment</option>
          </Select>
        </Field>
        <Field label="Settlement terms">
          <Select value={a.settlementTerms} onChange={(e) => updateAgent(a.id, { settlementTerms: e.target.value }, `Settlement terms → ${e.target.value}`)}>
            <option>Net 15</option><option>Net 30</option><option>Net 45</option>
          </Select>
        </Field>
      </div>

      <div className="rounded-btn border border-line bg-surface-2/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Disbursement pre-approval limit — spend above routes to Finance before acceptance
        </p>
        <p className="mt-1.5 font-mono text-lg font-bold text-heading">${a.disbursementLimit.toLocaleString()}</p>
      </div>

      <div className="rounded-btn border border-line bg-surface-2/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Commission change on an Active agent — Finance Head approval, prior terms kept for historical SOAs
        </p>
        {a.pendingCommissionChange ? (
          <p className="mt-2 rounded-badge bg-[#FEF3C7] px-2.5 py-1 text-xs font-semibold text-[#B45309] inline-block">
            Pending: {a.pendingCommissionChange}
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-52">
              <TextInput value={proposal} onChange={(e) => setProposal(e.target.value)} placeholder='e.g. "3% → 2.5% of freight from August"' />
            </div>
            <Button size="sm" variant="secondary" disabled={!proposal || a.status !== 'Active'} className="disabled:opacity-50" onClick={() => { requestCommissionChange(a.id, proposal); setProposal('') }}>
              Propose change
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function PortalTab({ a }: { a: AgentRecord }) {
  const { updateAgent } = useDataStore()
  const weAreAgent = a.direction !== 'We are Principal'
  const riskyUsers = a.portalUsers.filter((u) => !u.mfaEnabled && (u.role === 'Agent Admin' || u.role === 'Booking Creator'))

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        The highest-risk section — booking creation and direct document-edit rights on Kinetic Line's behalf.
        Enforced server-side via Row Level Security, scoped to this agency relationship only.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Portal access (master switch)">
          <Select value={a.portalEnabled ? 'yes' : 'no'} onChange={(e) => updateAgent(a.id, { portalEnabled: e.target.value === 'yes' }, `Portal access → ${e.target.value === 'yes' ? 'Enabled' : 'Disabled'}`)}>
            <option value="yes">Enabled</option><option value="no">Disabled</option>
          </Select>
        </Field>
        <Field label="Scope restriction (within own bookings)">
          <Select value={a.scopeRestriction || 'none'} onChange={(e) => updateAgent(a.id, { scopeRestriction: e.target.value === 'none' ? '' : e.target.value }, `Booking visibility scope → ${e.target.value === 'none' ? 'full relationship scope' : e.target.value}`)}>
            <option value="none">Full relationship scope</option>
            {a.portsCovered.map((p) => <option key={p} value={p}>{p} only</option>)}
          </Select>
        </Field>
        <Field label={weAreAgent ? 'Create-booking permission' : 'Create-booking (n/a — we are Principal)'}>
          <Select
            disabled={!weAreAgent}
            value={a.createBooking ? 'yes' : 'no'}
            onChange={(e) => updateAgent(a.id, { createBooking: e.target.value === 'yes' }, `Create-Booking Permission changed to ${e.target.value === 'yes' ? 'Granted' : 'Revoked'}`)}
          >
            <option value="no">Not granted</option>
            <option value="yes">Can raise booking requests</option>
          </Select>
        </Field>
        <Field label="BL edit permission">
          <Select value={a.blEdit} onChange={(e) => updateAgent(a.id, { blEdit: e.target.value as AgentBlEdit }, `BL Edit Permission changed from ${a.blEdit} to ${e.target.value}`)}>
            <option>Edit live (versioned)</option>
            <option>Submit for approval</option>
            <option>None</option>
          </Select>
        </Field>
        <Field label="Document upload">
          <Select value={a.docUpload ? 'yes' : 'no'} onChange={(e) => updateAgent(a.id, { docUpload: e.target.value === 'yes' }, `Document upload → ${e.target.value === 'yes' ? 'Allowed' : 'Off'}`)}>
            <option value="yes">Allowed</option><option value="no">Off</option>
          </Select>
        </Field>
        <Field label="Agency SOA visibility">
          <Select value={a.soaVisibility ? 'yes' : 'no'} onChange={(e) => updateAgent(a.id, { soaVisibility: e.target.value === 'yes' }, `SOA visibility → ${e.target.value === 'yes' ? 'Online' : 'Issued only'}`)}>
            <option value="yes">Running SOA online</option><option value="no">Wait for issued SOA</option>
          </Select>
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Milestone update permission — which events this agent logs directly
        </p>
        <div className="flex gap-2">
          {(['CAN', 'DO', 'POD'] as const).map((m) => (
            <label key={m} className="flex items-center gap-1.5 rounded-btn border border-line bg-surface-2/50 px-3 py-2 text-xs text-heading">
              <input
                type="checkbox"
                checked={a.milestonePerms.includes(m)}
                onChange={() =>
                  updateAgent(a.id, {
                    milestonePerms: a.milestonePerms.includes(m) ? a.milestonePerms.filter((x) => x !== m) : [...a.milestonePerms, m],
                  }, `Milestone permission ${m} ${a.milestonePerms.includes(m) ? 'revoked' : 'granted'}`)
                }
                className="h-3.5 w-3.5 accent-[#10B981]"
              />
              {m === 'CAN' ? 'CAN (Cargo Arrival Notice)' : m === 'DO' ? 'DO (Delivery Order)' : 'POD (Proof of Delivery)'}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Portal users</p>
        {riskyUsers.length > 0 && (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-accent-orange">
            <AlertTriangle size={12} /> {riskyUsers.length} user(s) with create/edit rights lack MFA — mandatory recommended.
          </p>
        )}
        <div className="space-y-1.5">
          {a.portalUsers.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-2 rounded-btn border border-line bg-surface-2/40 px-3 py-2 text-xs">
              <span className="font-medium text-heading">{u.name}</span>
              <span className="text-muted">{u.email}</span>
              <span className="rounded-badge bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-heading">{u.role}</span>
              {u.mfaEnabled && <span className="rounded-badge bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-semibold text-[#15803D]">MFA</span>}
              <span className="ml-auto text-muted">{u.status} · last login {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'never'}</span>
            </div>
          ))}
          {a.portalUsers.length === 0 && <p className="text-xs text-muted">No portal users yet</p>}
        </div>
      </div>
    </div>
  )
}

function NotificationsTab() {
  const rows = [
    ['New Booking Assigned', 'Real-time → agent Operations contact'],
    ['BL Approval Needed', 'Fires internally to the Ops owner (when BL edit = Submit for approval)'],
    ['Agency SOA Generated', '→ agent Finance contact'],
    ['Disbursement Approval Needed', 'Fires internally to Kinetic Finance when spend exceeds the pre-approval limit'],
    ['Milestone Reminder', 'When an agent-owned milestone approaches its expected date without an update'],
  ]
  return (
    <div className="space-y-1.5">
      {rows.map(([event, detail]) => (
        <div key={event} className="flex flex-wrap items-center gap-2 rounded-btn border border-line bg-surface-2/40 px-3 py-2.5 text-xs">
          <span className="font-medium text-heading">{event}</span>
          <span className="ml-auto text-muted">{detail}</span>
        </div>
      ))}
    </div>
  )
}

function ComplianceTab({ a }: { a: AgentRecord }) {
  const { updateAgent } = useDataStore()
  const soon = (d: string) => new Date(d).getTime() - Date.now() < 60 * 86400000
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {a.documents.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-btn border border-line bg-surface-2/40 px-3 py-2 text-xs">
            <span className="font-medium text-heading">{d.type}</span>
            <span className={`font-mono ${soon(d.expiry) ? 'font-semibold text-accent-coral' : 'text-muted'}`}>
              expires {d.expiry}{soon(d.expiry) && ' — renewal reminder window'}
            </span>
            {d.verified ? (
              <span className="ml-auto flex items-center gap-1 text-primary"><Check size={12} /> verified</span>
            ) : (
              <Button size="sm" variant="secondary" className="ml-auto" onClick={() => updateAgent(a.id, { documents: a.documents.map((x) => (x.id === d.id ? { ...x, verified: true } : x)) }, `Document verified: ${d.type} (validity confirmed)`)}>
                Verify
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button
        size="sm" variant="secondary"
        onClick={() => updateAgent(a.id, { documents: [...a.documents, { id: `ad-${Date.now()}`, type: 'FIATA certification', expiry: '2027-12-31', verified: false }] }, 'Document uploaded: FIATA certification')}
      >
        <Plus size={13} /> Upload document
      </Button>
    </div>
  )
}

/* ── Performance & SLA (§8 + flow 4) ─────────────────────────── */

function PerformanceTab({ a }: { a: AgentRecord }) {
  const { updateAgent } = useDataStore()
  const totalW = a.weightOnTime + a.weightDocAccuracy + a.weightResponsiveness
  const score = Math.round(
    (a.scoreOnTime * a.weightOnTime + a.scoreDocAccuracy * a.weightDocAccuracy + a.scoreResponsiveness * a.weightResponsiveness) /
      (totalW || 1),
  )
  const below = score < a.autoFlagThreshold

  return (
    <div className="space-y-4">
      <div className="rounded-btn border border-line bg-surface-2/50 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Gauge size={18} className={below ? 'text-accent-coral' : 'text-primary'} />
          <span className="text-sm font-semibold text-heading">Composite Agent Performance Score</span>
          <span className={`font-mono text-2xl font-bold ${below ? 'text-accent-coral' : 'text-primary'}`}>{score}</span>
          <span className="text-xs text-muted">auto-flag below {a.autoFlagThreshold}</span>
          {below && (
            <span className="rounded-badge bg-[#FEE2E2] px-2.5 py-1 text-xs font-semibold text-[#DC2626]">
              Below threshold — review task auto-created for {a.relationshipOwner}
            </span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            ['On-time %', a.scoreOnTime, a.weightOnTime],
            ['Documentation accuracy', a.scoreDocAccuracy, a.weightDocAccuracy],
            ['Responsiveness', a.scoreResponsiveness, a.weightResponsiveness],
          ].map(([label, val, w]) => (
            <div key={label as string}>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-body">{label} <span className="text-muted">(weight {w}%)</span></span>
                <span className="font-mono font-semibold text-heading">{val}</span>
              </div>
              <ProgressBar pct={val as number} color={(val as number) >= a.autoFlagThreshold ? '#10B981' : '#EF4444'} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Response time SLA (hrs)">
          <TextInput type="number" value={a.responseSlaHrs} onChange={(e) => updateAgent(a.id, { responseSlaHrs: +e.target.value }, `Response Time SLA → ${e.target.value}h`)} />
        </Field>
        <Field label="Milestone update SLA (hrs)">
          <TextInput type="number" value={a.milestoneSlaHrs} onChange={(e) => updateAgent(a.id, { milestoneSlaHrs: +e.target.value }, `Milestone Update SLA → ${e.target.value}h`)} />
        </Field>
        <Field label="Auto-flag threshold">
          <TextInput type="number" value={a.autoFlagThreshold} onChange={(e) => updateAgent(a.id, { autoFlagThreshold: +e.target.value }, `Auto-flag threshold → ${e.target.value}`)} />
        </Field>
        <Field label={`Weights (${totalW}%${totalW !== 100 ? ' — should be 100' : ''})`}>
          <div className="flex gap-1">
            <TextInput type="number" title="On-time" value={a.weightOnTime} onChange={(e) => updateAgent(a.id, { weightOnTime: +e.target.value }, `Weight on-time → ${e.target.value}%`)} />
            <TextInput type="number" title="Doc accuracy" value={a.weightDocAccuracy} onChange={(e) => updateAgent(a.id, { weightDocAccuracy: +e.target.value }, `Weight doc accuracy → ${e.target.value}%`)} />
            <TextInput type="number" title="Responsiveness" value={a.weightResponsiveness} onChange={(e) => updateAgent(a.id, { weightResponsiveness: +e.target.value }, `Weight responsiveness → ${e.target.value}%`)} />
          </div>
        </Field>
      </div>
      <p className="text-[11px] text-muted">
        Scoring runs automatically from booking and milestone data; a below-threshold score creates a review task
        for the Relationship Owner — persistent issues escalate toward Suspension (flow 5).
      </p>
    </div>
  )
}
