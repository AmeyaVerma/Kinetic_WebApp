import { useState } from 'react'
import { Check, X, AlertTriangle } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { ProgressBar } from '../ui/ProgressBar'
import { Field, Select, TextInput } from '../ui/Field'
import { useDataStore } from '../../store/useDataStore'
import {
  approvalRequirements,
  CONTAINER_PANELS,
  DAMAGE_CODES,
  isTotalLossCandidate,
  latestEstimate,
  MNR_STAGES,
} from '../../lib/mnr'
import { mockVendors } from '../../mocks/masters'
import type { DamageSeverity, MnrJob, ResponsibleParty, WarrantyClaimStatus } from '../../lib/types'

export function JobDetail({ job }: { job: MnrJob }) {
  const { fleet, activities } = useDataStore()
  const container = fleet.find((f) => f.id === job.containerId)
  const jobActivities = activities.filter((a) => a.bookingId === job.id)
  const stageIdx = MNR_STAGES.indexOf(job.stage)

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono text-lg font-bold">{job.containerNo}</h3>
        <div className="flex items-center gap-2 text-xs text-muted">
          {container && (
            <>
              <span>{container.isoType}</span>·<span>{container.ownership}</span>
              {container.lessor && <>·<span>{container.lessor}</span></>}
              ·<span>insured ${container.insuredValue.toLocaleString()}</span>
            </>
          )}
        </div>
      </div>

      {/* Stage stepper */}
      <div className="mt-4 flex flex-wrap items-center gap-1">
        {MNR_STAGES.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <span
              className={`rounded-badge px-2.5 py-1 text-[11px] font-medium ${
                i < stageIdx
                  ? 'bg-primary/15 text-primary'
                  : i === stageIdx
                    ? 'bg-primary text-white'
                    : 'bg-surface-2 text-muted'
              }`}
            >
              {s}
            </span>
            {i < MNR_STAGES.length - 1 && <span className="text-line">→</span>}
          </div>
        ))}
      </div>

      <div className="mt-5">
        {job.stage === 'Initial Inspection' && <InspectionPanel job={job} />}
        {job.stage === 'Damage Survey' && <SurveyPanel job={job} />}
        {(job.stage === 'Estimate' || job.stage === 'Approval') && <EstimatePanel job={job} />}
        {job.stage === 'Repair Execution' && <RepairPanel job={job} />}
        {job.stage === 'Quality Control' && <QcPanel job={job} />}
        {job.stage === 'Finance Posting' && <FinancePanel job={job} container={container} />}
        {job.stage === 'Closed' && (
          <p className="rounded-btn border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
            <Check size={14} className="mr-1 inline" /> Cycle closed — outcome: {job.outcome}. Immutable history entry appended.
          </p>
        )}
      </div>

      {/* Damage points table (visible from survey onwards) */}
      {job.damagePoints.length > 0 && job.stage !== 'Quality Control' && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Damage points (DSR)</p>
          <div className="space-y-1.5">
            {job.damagePoints.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-btn border border-line bg-surface-2/40 px-3 py-2 text-xs">
                <span className="font-medium text-heading">{d.panel}</span>
                <span className="text-muted">{DAMAGE_CODES.find((c) => c.code === d.damageCode)?.label ?? d.damageCode} · {d.component} · {d.dims}</span>
                <SeverityBadge severity={d.severity} />
                {d.preExisting && <span className="rounded-badge bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">pre-existing</span>}
                <span className="ml-auto text-muted">{d.photos} photos · {d.responsibleParty}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-job audit log */}
      <div className="mt-5 border-t border-line pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Job audit log (immutable)</p>
        {jobActivities.slice(0, 6).map((a) => (
          <div key={a.id} className="flex items-start gap-3 py-1.5 text-xs">
            <span className="w-32 shrink-0 font-mono text-muted">{new Date(a.at).toLocaleString()}</span>
            <span className="w-28 shrink-0 font-medium text-heading">{a.actor}</span>
            <span className="text-body">{a.action}</span>
          </div>
        ))}
        {jobActivities.length === 0 && <p className="text-xs text-muted">No entries yet</p>}
      </div>
    </Card>
  )
}

function SeverityBadge({ severity }: { severity: DamageSeverity }) {
  const colors = {
    Minor: { bg: '#DCFCE7', text: '#15803D' },
    Major: { bg: '#FEF3C7', text: '#B45309' },
    Structural: { bg: '#FEE2E2', text: '#DC2626' },
  }[severity]
  return (
    <span className="rounded-badge px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: colors.bg, color: colors.text }}>
      {severity}
    </span>
  )
}

/* ── Initial Inspection (flow 1, §4.B) ───────────────────────── */

function InspectionPanel({ job }: { job: MnrJob }) {
  const { setChecklistItem, completeInspection } = useDataStore()
  const [cleanliness, setCleanliness] = useState<NonNullable<MnrJob['cleanliness']>>('Clean')
  const [ptiPass, setPtiPass] = useState<'na' | 'pass' | 'fail'>('na')
  const [contamination, setContamination] = useState(false)
  const { fleet } = useDataStore()
  const isReefer = fleet.find((f) => f.id === job.containerId)?.isReefer ?? false
  const allAnswered = job.checklist.every((c) => c.pass !== null) && (!isReefer || ptiPass !== 'na')

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Structural checklist — every item pass/fail. SLA: 24 hrs from depot-in.
        {job.cscExpiringSoon && (
          <span className="ml-2 rounded-badge bg-[#FECACA] px-2 py-0.5 text-[10px] font-semibold text-[#B91C1C]">
            CSC expiring &lt;90d — periodic test flagged
          </span>
        )}
        {job.sealIntact === false && (
          <span className="ml-2 rounded-badge bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-semibold text-[#DC2626]">
            priority inspection — seal broken
          </span>
        )}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {job.checklist.map((c) => (
          <div key={c.key} className="rounded-btn border border-line bg-surface px-3 py-2.5">
            <p className="text-xs font-medium text-heading">{c.label}</p>
            <div className="mt-1.5 flex gap-1.5">
              <button
                onClick={() => setChecklistItem(job.id, c.key, true)}
                className={`flex-1 rounded-badge py-1 text-[11px] font-semibold ${c.pass === true ? 'bg-primary text-white' : 'bg-surface-2 text-body hover:bg-primary/10'}`}
              >
                Pass
              </button>
              <button
                onClick={() => setChecklistItem(job.id, c.key, false)}
                className={`flex-1 rounded-badge py-1 text-[11px] font-semibold ${c.pass === false ? 'bg-accent-coral text-white' : 'bg-surface-2 text-body hover:bg-[#FEE2E2]'}`}
              >
                Fail
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Cleanliness grade">
          <Select value={cleanliness} onChange={(e) => setCleanliness(e.target.value as NonNullable<MnrJob['cleanliness']>)}>
            <option>Clean</option>
            <option>Broom clean</option>
            <option>Requires cleaning</option>
            <option>Requires washing</option>
          </Select>
        </Field>
        {isReefer && (
          <Field label="PTI test (reefer)">
            <Select value={ptiPass} onChange={(e) => setPtiPass(e.target.value as 'na' | 'pass' | 'fail')}>
              <option value="na">Not run yet…</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail — route to reefer specialist</option>
            </Select>
          </Field>
        )}
        <Field label="Odor / contamination">
          <Select value={contamination ? 'yes' : 'no'} onChange={(e) => setContamination(e.target.value === 'yes')}>
            <option value="no">Clear</option>
            <option value="yes">Detected — blocks allocation</option>
          </Select>
        </Field>
      </div>
      {(cleanliness === 'Requires cleaning' || cleanliness === 'Requires washing') && (
        <p className="text-[11px] text-muted">→ Routed to Empty Yard cleaning station (parallel — does not block repair path)</p>
      )}
      <Button
        disabled={!allAnswered}
        className="disabled:opacity-50"
        onClick={() =>
          completeInspection(job.id, {
            cleanliness,
            ptiPass: isReefer ? ptiPass === 'pass' : null,
            contamination,
          })
        }
      >
        Complete inspection
      </Button>
      <p className="text-[11px] text-muted">
        All pass → fast path to Available (bypasses Survey/Estimate/Approval/Repair/QC). Any fail → Damage Survey.
      </p>
    </div>
  )
}

/* ── Damage Survey (flow 2, §4.C) ────────────────────────────── */

function SurveyPanel({ job }: { job: MnrJob }) {
  const { addDamagePoint, completeSurvey } = useDataStore()
  const [panel, setPanel] = useState<string>(CONTAINER_PANELS[0])
  const [code, setCode] = useState<string>(DAMAGE_CODES[0].code)
  const [component, setComponent] = useState('')
  const [dims, setDims] = useState('')
  const [severity, setSeverity] = useState<DamageSeverity>('Minor')
  const [photos, setPhotos] = useState(0)
  const [preExisting, setPreExisting] = useState(false)
  const [party, setParty] = useState<ResponsibleParty>('Unknown')

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Graphical damage mapping — pick the affected zone, code, dimensions and severity. Min 2 photos per point
        (wide + close-up). Gate-out photos auto-pulled for new-vs-pre-existing comparison.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Panel / zone">
          <Select value={panel} onChange={(e) => setPanel(e.target.value)}>
            {CONTAINER_PANELS.map((p) => <option key={p}>{p}</option>)}
          </Select>
        </Field>
        <Field label="Damage code">
          <Select value={code} onChange={(e) => setCode(e.target.value)}>
            {DAMAGE_CODES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
          </Select>
        </Field>
        <Field label="Component">
          <TextInput value={component} onChange={(e) => setComponent(e.target.value)} placeholder="e.g. Side panel 3" />
        </Field>
        <Field label="Dimensions (L×W×D)">
          <TextInput value={dims} onChange={(e) => setDims(e.target.value)} placeholder="e.g. 60×40×3 cm" />
        </Field>
        <Field label="Severity">
          <Select value={severity} onChange={(e) => setSeverity(e.target.value as DamageSeverity)}>
            <option>Minor</option>
            <option>Major</option>
            <option>Structural</option>
          </Select>
        </Field>
        <Field label="New vs pre-existing">
          <Select value={preExisting ? 'pre' : 'new'} onChange={(e) => setPreExisting(e.target.value === 'pre')}>
            <option value="new">New damage since last movement</option>
            <option value="pre">Pre-existing — already logged</option>
          </Select>
        </Field>
        <Field label="Responsible party (draft)">
          <Select value={party} onChange={(e) => setParty(e.target.value as ResponsibleParty)}>
            <option>Carrier</option>
            <option>Customer</option>
            <option>Terminal</option>
            <option>Unknown</option>
          </Select>
        </Field>
        <Field label={`Photos (min 2) — ${photos} captured`}>
          <Button size="sm" variant="secondary" onClick={() => setPhotos((p) => p + 1)}>+ Capture</Button>
        </Field>
      </div>
      {severity === 'Structural' && (
        <p className="flex items-center gap-1.5 text-xs text-accent-coral">
          <AlertTriangle size={13} /> Structural — mandatory Engineering sign-off will be added at Approval (cannot be bypassed).
        </p>
      )}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={photos < 2 || !component}
          className="disabled:opacity-50"
          onClick={() => {
            addDamagePoint(job.id, { panel, damageCode: code, component, dims, severity, photos, preExisting, responsibleParty: party })
            setComponent(''); setDims(''); setPhotos(0)
          }}
        >
          Add damage point
        </Button>
        <Button
          disabled={job.damagePoints.length === 0}
          className="disabled:opacity-50"
          onClick={() => completeSurvey(job.id)}
        >
          Generate signed DSR → Estimate
        </Button>
      </div>
    </div>
  )
}

/* ── Estimate + Approval (flows 2–3, §4.D–E) ─────────────────── */

function EstimatePanel({ job }: { job: MnrJob }) {
  const { fleet, submitMnrEstimate } = useDataStore()
  const container = fleet.find((f) => f.id === job.containerId)
  const leased = container ? container.ownership !== 'Owned' : false
  const est = latestEstimate(job)
  const [vendorId, setVendorId] = useState('vn4')
  const [labour, setLabour] = useState(0)
  const [material, setMaterial] = useState(0)
  const [tax, setTax] = useState(0)
  const [validUntil, setValidUntil] = useState('')
  const [revisionReason, setRevisionReason] = useState('')
  const total = labour + material + tax

  if (job.stage === 'Approval' && est) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-body">
          Estimate v{est.version} — <span className="font-mono font-semibold text-heading">${est.total.toLocaleString()}</span> awaiting approval.
        </p>
        <div className="rounded-btn border border-line bg-surface-2/50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Approval requirements (matrix §4.E)</p>
          {approvalRequirements(job, est.total, leased).map((r) => (
            <p key={r} className="flex items-center gap-2 py-0.5 text-xs text-body">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-orange" /> {r}
            </p>
          ))}
        </div>
        <p className="text-xs text-muted">
          Pending in the shared <span className="font-medium text-heading">Approvals queue</span> — decide it there (partial/line-item supported in production; full-estimate here).
        </p>
        {container && isTotalLossCandidate(est.total, container.insuredValue) && (
          <p className="flex items-center gap-1.5 rounded-btn border border-[#FECACA] bg-[#FEE2E2] px-3 py-2 text-xs font-medium text-[#B91C1C]">
            <AlertTriangle size={13} /> Estimate ≥70% of insured value (${container.insuredValue.toLocaleString()}) — total-loss review suggested (§4.K)
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Auto-suggested repair codes + Tariff Master pricing pre-fill; vendor accepts or submits own worksheet.
        Validity default 15 days. Revisions require a reason (versioned).
        {est?.status === 'Rejected' && (
          <span className="ml-2 rounded-badge bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-semibold text-[#DC2626]">
            v{est.version} rejected — re-quote required
          </span>
        )}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Vendor">
          <Select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            {mockVendors.filter((v) => v.kind === 'Repair' || v.kind === 'Surveyor').map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Labour ($)">
          <TextInput type="number" value={labour || ''} onChange={(e) => setLabour(+e.target.value)} />
        </Field>
        <Field label="Material ($)">
          <TextInput type="number" value={material || ''} onChange={(e) => setMaterial(+e.target.value)} />
        </Field>
        <Field label="Tax ($)">
          <TextInput type="number" value={tax || ''} onChange={(e) => setTax(+e.target.value)} />
        </Field>
        <Field label="Valid until (default 15 days)">
          <TextInput type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </Field>
        {job.estimates.length > 0 && (
          <Field label="Revision reason (mandatory)">
            <TextInput value={revisionReason} onChange={(e) => setRevisionReason(e.target.value)} placeholder="Why is this being revised?" />
          </Field>
        )}
      </div>
      <div className="flex items-center gap-4">
        <Button
          disabled={total <= 0 || !validUntil || (job.estimates.length > 0 && !revisionReason)}
          className="disabled:opacity-50"
          onClick={() => submitMnrEstimate(job.id, { vendorId, labour, material, tax, validUntil, revisionReason: revisionReason || null })}
        >
          Submit estimate {total > 0 && `— $${total.toLocaleString()}`}
        </Button>
        <span className="text-xs text-muted">
          Routing: {total > 0 ? (total < 300 ? 'auto-approval (<$300, within tariff)' : total <= 1500 ? 'Depot Supervisor' : total <= 5000 ? 'MNR Manager' : 'Regional Head + Finance') : '—'}
          {job.engineeringRequired && ' + Engineering'}
          {leased && ' + Lessor notification'}
        </span>
      </div>
    </div>
  )
}

/* ── Repair Execution (flow 4, §4.F) ─────────────────────────── */

function RepairPanel({ job }: { job: MnrJob }) {
  const { setRepairProgress, submitAdditionalDamage, vendorCompleteRepair } = useDataStore()
  const [deltaAmount, setDeltaAmount] = useState(0)
  const [deltaDesc, setDeltaDesc] = useState('')

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-body">Live progress (vendor portal / mobile)</span>
          <span className="font-mono font-semibold text-heading">{job.progressPct}%</span>
        </div>
        <ProgressBar pct={job.progressPct} color="#10B981" height={7} />
        <div className="mt-2 flex gap-2">
          {[25, 50, 75, 100].map((p) => (
            <Button key={p} size="sm" variant="secondary" onClick={() => setRepairProgress(job.id, p, job.materialsDeviation)}>
              {p}%
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setRepairProgress(job.id, job.progressPct, true)} className="text-accent-orange">
            Flag material deviation &gt;10%
          </Button>
        </div>
        {job.materialsDeviation && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-accent-orange">
            <AlertTriangle size={13} /> Material usage deviation alert raised
          </p>
        )}
      </div>

      <div className="rounded-btn border border-line bg-surface-2/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Additional Damage Request (hidden damage mid-repair)</p>
        {job.additionalDamagePending ? (
          <p className="mt-2 text-xs text-accent-orange">Delta estimate pending in Approval Engine — approved items continue in parallel.</p>
        ) : (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="w-32">
              <p className="mb-1 text-[11px] text-body">Delta ($)</p>
              <TextInput type="number" value={deltaAmount || ''} onChange={(e) => setDeltaAmount(+e.target.value)} />
            </div>
            <div className="flex-1 min-w-40">
              <p className="mb-1 text-[11px] text-body">Description</p>
              <TextInput value={deltaDesc} onChange={(e) => setDeltaDesc(e.target.value)} placeholder="e.g. hidden floor rot under panel" />
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={!deltaAmount || !deltaDesc}
              className="disabled:opacity-50"
              onClick={() => { submitAdditionalDamage(job.id, deltaAmount, deltaDesc); setDeltaAmount(0); setDeltaDesc('') }}
            >
              Submit delta → Approval
            </Button>
          </div>
        )}
      </div>

      <Button
        disabled={job.progressPct < 100 || job.additionalDamagePending}
        className="disabled:opacity-50"
        onClick={() => vendorCompleteRepair(job.id)}
      >
        Vendor marks repair complete → QC
      </Button>
    </div>
  )
}

/* ── Quality Control (flow 4, §4.G) ──────────────────────────── */

function QcPanel({ job }: { job: MnrJob }) {
  const { fleet, setQcLine, qcRework, qcSignoff } = useDataStore()
  const isReefer = fleet.find((f) => f.id === job.containerId)?.isReefer ?? false
  const [cscRecert, setCscRecert] = useState(false)
  const [ptiRepeat, setPtiRepeat] = useState(false)
  const [punchItem, setPunchItem] = useState('')
  const [punchList, setPunchList] = useState<string[]>([])

  const anyFail = job.damagePoints.some((d) => d.qcPass === false)
  const allPass = job.damagePoints.length > 0 && job.damagePoints.every((d) => d.qcPass === true)
  const structuralOk = !job.engineeringRequired || cscRecert
  const reeferOk = !isReefer || ptiRepeat

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Independent inspector (system-enforced). Checklist auto-generated — one line per damage point, nothing silently dropped. Before/after photo comparison per point.
      </p>
      <div className="space-y-1.5">
        {job.damagePoints.map((d) => (
          <div key={d.id} className="flex items-center gap-3 rounded-btn border border-line bg-surface px-3 py-2 text-xs">
            <span className="flex-1 text-heading">{d.panel} · {d.component} · <SeverityBadge severity={d.severity} /></span>
            <button
              onClick={() => setQcLine(job.id, d.id, true)}
              className={`rounded-badge px-3 py-1 text-[11px] font-semibold ${d.qcPass === true ? 'bg-primary text-white' : 'bg-surface-2 text-body hover:bg-primary/10'}`}
            >
              <Check size={11} className="mr-0.5 inline" />Pass
            </button>
            <button
              onClick={() => setQcLine(job.id, d.id, false)}
              className={`rounded-badge px-3 py-1 text-[11px] font-semibold ${d.qcPass === false ? 'bg-accent-coral text-white' : 'bg-surface-2 text-body hover:bg-[#FEE2E2]'}`}
            >
              <X size={11} className="mr-0.5 inline" />Fail
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {job.engineeringRequired && (
          <label className="flex items-center gap-2 rounded-btn border border-line bg-surface-2/50 px-3 py-2.5 text-xs text-heading">
            <input type="checkbox" checked={cscRecert} onChange={(e) => setCscRecert(e.target.checked)} className="h-4 w-4 accent-[#10B981]" />
            CSC re-certification done — plate re-stamped, test date → Container Master (mandatory after structural)
          </label>
        )}
        {isReefer && (
          <label className="flex items-center gap-2 rounded-btn border border-line bg-surface-2/50 px-3 py-2.5 text-xs text-heading">
            <input type="checkbox" checked={ptiRepeat} onChange={(e) => setPtiRepeat(e.target.checked)} className="h-4 w-4 accent-[#10B981]" />
            Repeat PTI test passed (reefer repair)
          </label>
        )}
      </div>

      <div className="rounded-btn border border-line bg-surface-2/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Punch-list (minor, non-blocking — 5-day close window)</p>
        <div className="mt-2 flex gap-2">
          <TextInput value={punchItem} onChange={(e) => setPunchItem(e.target.value)} placeholder="e.g. touch-up paint LH panel" />
          <Button size="sm" variant="secondary" disabled={!punchItem} className="disabled:opacity-50" onClick={() => { setPunchList((l) => [...l, punchItem]); setPunchItem('') }}>
            Add
          </Button>
        </div>
        {punchList.map((p, i) => (
          <p key={i} className="mt-1.5 text-xs text-body">• {p}</p>
        ))}
      </div>

      <div className="flex gap-2">
        {anyFail && (
          <Button variant="secondary" className="text-accent-coral" onClick={() => qcRework(job.id)}>
            Fail → back to Repair (vendor liability, not billable)
          </Button>
        )}
        <Button
          disabled={!allPass || !structuralOk || !reeferOk}
          className="disabled:opacity-50"
          onClick={() => qcSignoff(job.id, { cscRecertDone: cscRecert, ptiRepeatDone: ptiRepeat, punchList })}
        >
          Digital signature — QC sign-off → Finance
        </Button>
      </div>
    </div>
  )
}

/* ── Finance Posting + Close (flow 5, §4.H–L) ────────────────── */

function FinancePanel({ job, container }: { job: MnrJob; container: ReturnType<typeof useDataStore.getState>['fleet'][number] | undefined }) {
  const { postFinance, issueDebitNote, closeMnrJob } = useDataStore()
  const est = latestEstimate(job)
  const [bill, setBill] = useState(est?.total ?? 0)
  const [rootCause, setRootCause] = useState<ResponsibleParty>('Carrier')
  const [costClass, setCostClass] = useState<'Capitalize' | 'Expense'>('Expense')
  const [warranty, setWarranty] = useState<WarrantyClaimStatus>('None')
  const posted = job.vendorBill !== null

  const variancePct = est && est.total > 0 && bill > 0 ? ((bill - est.total) / est.total) * 100 : 0

  if (!posted) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-muted">
          Vendor bill matched vs approved estimate (${est?.total.toLocaleString() ?? '—'}). Variance &gt;10% routes to the shared Approvals Queue instead of posting directly.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Vendor bill ($)">
            <TextInput type="number" value={bill || ''} onChange={(e) => setBill(+e.target.value)} />
          </Field>
          <Field label="Confirmed root-cause">
            <Select value={rootCause} onChange={(e) => setRootCause(e.target.value as ResponsibleParty)}>
              <option>Carrier</option>
              <option>Customer</option>
              <option>Terminal</option>
              <option>Unknown</option>
            </Select>
          </Field>
          <Field label="Cost classification">
            <Select value={costClass} onChange={(e) => setCostClass(e.target.value as 'Capitalize' | 'Expense')}>
              <option>Expense</option>
              <option>Capitalize</option>
            </Select>
          </Field>
          <Field label="Warranty coverage">
            <Select value={warranty} onChange={(e) => setWarranty(e.target.value as WarrantyClaimStatus)}>
              <option value="None">Not covered</option>
              <option value="Claimed">Covered — claim opened</option>
            </Select>
          </Field>
        </div>
        {Math.abs(variancePct) > 10 && (
          <p className="flex items-center gap-1.5 text-xs text-accent-orange">
            <AlertTriangle size={13} /> Variance {variancePct.toFixed(1)}% — will route to Approvals Queue before posting
          </p>
        )}
        <Button disabled={!bill} className="disabled:opacity-50" onClick={() => postFinance(job.id, { vendorBill: bill, rootCause, costClass, warrantyClaim: warranty })}>
          Match bill & post to GL
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-body">
        Posted: <span className="font-mono font-semibold text-heading">${job.vendorBill?.toLocaleString()}</span> · {job.costClass} · root-cause {job.rootCause}
        {job.warrantyClaim !== 'None' && ` · warranty ${job.warrantyClaim}`}
      </p>
      {job.rootCause === 'Customer' && !job.debitNoteIssued && (
        <Button variant="secondary" onClick={() => issueDebitNote(job.id)}>
          Confirm & issue customer debit note (via shared Invoicing)
        </Button>
      )}
      {job.debitNoteIssued && (
        <p className="text-xs text-primary"><Check size={13} className="mr-1 inline" />Debit note issued — dispute handling via case if customer contests</p>
      )}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Close — outcome for this container</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => closeMnrJob(job.id, 'Available')}>Available → Empty Yard pool</Button>
          <Button variant="secondary" onClick={() => closeMnrJob(job.id, 'Off-Hire')}>Off-Hire / redelivery</Button>
          <Button variant="secondary" className="text-accent-coral" onClick={() => closeMnrJob(job.id, 'Scrap')}>
            Total loss / scrap {container && `(≥70% of $${container.insuredValue.toLocaleString()})`}
          </Button>
        </div>
      </div>
    </div>
  )
}
