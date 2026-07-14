import { useState } from 'react'
import { Check, X, AlertTriangle, Plus } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Tabs } from '../ui/Tabs'
import { FieldPill, TextInput } from '../ui/Field'
import { ProgressBar } from '../ui/ProgressBar'
import { useDataStore } from '../../store/useDataStore'
import type { Employee } from '../../lib/types'

const TABS = [
  { key: 'profile', label: 'Profile' },
  { key: 'leave', label: 'Leave & balances' },
  { key: 'documents', label: 'Documents' },
  { key: 'compensation', label: 'Compensation' },
  { key: 'audit', label: 'Audit Log' },
]

export function EmployeeDetail({ employee: e }: { employee: Employee }) {
  const [tab, setTab] = useState('profile')
  const { activities, employees, confirmProbation, startNotice, setExitClearance, completeExit } = useDataStore()
  const audit = activities.filter((a) => a.bookingId === e.id)
  const manager = employees.find((m) => m.id === e.reportingTo)
  const [lastDay, setLastDay] = useState('')

  const clearanceItems = [
    { key: 'handover' as const, label: 'Knowledge handover complete' },
    { key: 'assetsReturned' as const, label: 'Assets returned (laptop, ID card, SIM)' },
    { key: 'financeSettled' as const, label: 'Final settlement processed (incl. EL encashment)' },
  ]
  const allCleared = clearanceItems.every((c) => e.exitClearance[c.key])

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold">{e.name}</h3>
          <p className="font-mono text-xs text-muted">{e.code} · {e.designation} · joined {e.dateOfJoining}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {e.status === 'Probation' && (
            <Button size="sm" onClick={() => confirmProbation(e.id)}>
              Confirm probation → Active
            </Button>
          )}
          {e.status === 'Active' && (
            <span className="flex items-center gap-2">
              <div className="w-36">
                <TextInput type="date" value={lastDay} onChange={(ev) => setLastDay(ev.target.value)} title="Last working day" />
              </div>
              <Button size="sm" variant="secondary" disabled={!lastDay} className="disabled:opacity-50" onClick={() => startNotice(e.id, lastDay)}>
                Accept resignation
              </Button>
            </span>
          )}
        </div>
      </div>

      {e.status === 'Probation' && e.probationEndsAt && (
        <p className="mt-3 rounded-btn border border-[#FDE68A] bg-[#FEF3C7]/50 px-3 py-2 text-xs text-[#B45309]">
          On probation until {e.probationEndsAt} — earned leave starts accruing on confirmation.
        </p>
      )}

      {e.status === 'On Notice' && (
        <div className="mt-3 rounded-btn border border-[#FDE68A] bg-[#FEF3C7]/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#B45309]">
            Exit clearance — all three gates must clear before exit (last day {e.noticeEndsAt})
          </p>
          <div className="mt-2 space-y-1.5">
            {clearanceItems.map((c) => (
              <p key={c.key} className="flex items-center gap-2 text-xs">
                {e.exitClearance[c.key] ? (
                  <Check size={13} className="text-primary" />
                ) : (
                  <X size={13} className="text-accent-coral" />
                )}
                <span className={e.exitClearance[c.key] ? 'text-heading' : 'text-body'}>{c.label}</span>
                {!e.exitClearance[c.key] && (
                  <Button size="sm" variant="ghost" onClick={() => setExitClearance(e.id, c.key)}>
                    Mark done
                  </Button>
                )}
              </p>
            ))}
          </div>
          <Button size="sm" className="mt-3 disabled:opacity-50" disabled={!allCleared} onClick={() => completeExit(e.id)}>
            Complete exit {!allCleared && '(blocked until all gates clear)'}
          </Button>
        </div>
      )}

      <div className="mt-4">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <div className="mt-4">
        {tab === 'profile' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <FieldPill label="Department" value={e.department} />
            <FieldPill label="Designation" value={e.designation} />
            <FieldPill label="Reports to" value={manager?.name ?? '—'} />
            <FieldPill label="Email" value={e.email} />
            <FieldPill label="Phone" value={e.phone} />
            <FieldPill label="Platform role" value={e.platformRole} />
            <FieldPill label="Date of joining" value={e.dateOfJoining} />
            <FieldPill label="Status" value={e.status} />
            {e.noticeEndsAt && <FieldPill label="Last working day" value={e.noticeEndsAt} />}
          </div>
        )}

        {tab === 'leave' && <LeaveBalances e={e} />}

        {tab === 'documents' && <DocumentsTabHr e={e} />}

        {tab === 'compensation' && (
          <div className="space-y-3">
            <p className="text-xs text-muted">
              Visible to Finance and HR roles only (per the platform role model). Full salary structures and
              statutory deductions arrive with Phase 2 payroll.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <FieldPill label="Monthly gross (INR)" value={`₹${e.salaryMonthlyInr.toLocaleString('en-IN')}`} />
              <FieldPill label="Annual CTC (approx.)" value={`₹${(e.salaryMonthlyInr * 12).toLocaleString('en-IN')}`} />
              <FieldPill label="Payment mode" value="Bank transfer — monthly" />
            </div>
          </div>
        )}

        {tab === 'audit' && (
          <div>
            {audit.map((a) => (
              <div key={a.id} className="flex items-start gap-3 border-b border-line py-2 text-xs last:border-0">
                <span className="w-32 shrink-0 font-mono text-muted">{new Date(a.at).toLocaleString()}</span>
                <span className="w-28 shrink-0 font-medium text-heading">{a.actor}</span>
                <span className="text-body">{a.action}</span>
              </div>
            ))}
            {audit.length === 0 && <p className="py-4 text-center text-sm text-muted">No changes logged yet</p>}
          </div>
        )}
      </div>
    </Card>
  )
}

function LeaveBalances({ e }: { e: Employee }) {
  const { leaveRequests } = useDataStore()
  const myRequests = leaveRequests.filter((r) => r.employeeId === e.id)
  const rows = [
    { label: 'Casual (CL)', b: e.leave.casual, note: '12/yr · no carry-forward' },
    { label: 'Sick (SL)', b: e.leave.sick, note: '12/yr · cert needed beyond 2 days' },
    { label: 'Earned (EL)', b: e.leave.earned, note: '15/yr · carry-forward up to 30 · encashable at exit' },
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {rows.map(({ label, b, note }) => {
          const total = b.entitled + b.carriedForward
          const left = total - b.used
          return (
            <div key={label} className="rounded-btn border border-line bg-surface-2/50 p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-semibold text-heading">{label}</p>
                <p className="font-mono text-lg font-bold text-primary">{left}<span className="text-xs text-muted">/{total}</span></p>
              </div>
              <div className="mt-2">
                <ProgressBar pct={total > 0 ? (left / total) * 100 : 0} color="#10B981" />
              </div>
              <p className="mt-2 text-[10px] text-muted">
                {note}
                {b.carriedForward > 0 && ` · ${b.carriedForward}d carried from 2025`}
              </p>
            </div>
          )
        })}
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Leave history</p>
        <div className="space-y-1.5">
          {myRequests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-btn border border-line bg-surface-2/40 px-3 py-2 text-xs">
              <span className="font-medium text-heading">{r.type}</span>
              <span className="font-mono text-muted">{r.from} → {r.to} ({r.days}d)</span>
              <span className="text-body">{r.reason}</span>
              <span className="ml-auto">
                <span className={`rounded-badge px-2 py-0.5 text-[10px] font-semibold ${
                  r.status === 'Approved' ? 'bg-[#DCFCE7] text-[#15803D]' : r.status === 'Pending' ? 'bg-[#FFF7ED] text-[#EA580C]' : 'bg-[#F3F4F6] text-[#6B7280]'
                }`}>
                  {r.status}{r.lopDays > 0 && ` · ${r.lopDays}d LOP`}
                </span>
              </span>
            </div>
          ))}
          {myRequests.length === 0 && <p className="text-xs text-muted">No leave taken yet</p>}
        </div>
      </div>
    </div>
  )
}

function DocumentsTabHr({ e }: { e: Employee }) {
  const { updateEmployee } = useDataStore()
  const soon = (d: string | null) => d && new Date(d).getTime() - Date.now() < 60 * 86400000
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {e.documents.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-btn border border-line bg-surface-2/40 px-3 py-2 text-xs">
            <span className="font-medium text-heading">{d.type}</span>
            {d.expiry ? (
              <span className={`font-mono ${soon(d.expiry) ? 'font-semibold text-accent-coral' : 'text-muted'}`}>
                expires {d.expiry}{soon(d.expiry) && ' — renewal window'}
              </span>
            ) : (
              <span className="text-muted">no expiry</span>
            )}
            {d.verified ? (
              <span className="ml-auto flex items-center gap-1 text-primary"><Check size={12} /> verified</span>
            ) : (
              <span className="ml-auto flex items-center gap-2">
                <span className="flex items-center gap-1 text-accent-orange"><AlertTriangle size={12} /> unverified</span>
                <Button size="sm" variant="secondary" onClick={() => updateEmployee(e.id, { documents: e.documents.map((x) => (x.id === d.id ? { ...x, verified: true } : x)) }, `Document verified: ${d.type}`)}>
                  Verify
                </Button>
              </span>
            )}
          </div>
        ))}
      </div>
      <Button
        size="sm" variant="secondary"
        onClick={() => updateEmployee(e.id, { documents: [...e.documents, { id: `ed-${Date.now()}`, type: 'Certification', expiry: '2028-06-30', verified: false }] }, 'Document uploaded: Certification')}
      >
        <Plus size={13} /> Upload document
      </Button>
    </div>
  )
}
