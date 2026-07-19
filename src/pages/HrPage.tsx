import { useMemo, useState } from 'react'
import { Users, CalendarOff, ClipboardCheck, FileWarning, GraduationCap, Plus } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatKpi } from '../components/ui/StatKpi'
import { CsvButton } from '../components/ui/CsvButton'
import { StatusChip } from '../components/ui/StatusChip'
import { Tabs } from '../components/ui/Tabs'
import { Modal } from '../components/ui/Modal'
import { Field, Select, TextInput } from '../components/ui/Field'
import { EmployeeDetail } from '../components/hr/EmployeeDetail'
import { useDataStore } from '../store/useDataStore'
import { balanceFor, daysBetween, HOLIDAYS_2026, SICK_CERT_THRESHOLD_DAYS } from '../lib/hr'
import type { ChipStatus, EmployeeStatus, LeaveStatus, LeaveType } from '../lib/types'

const EMP_CHIP: Record<EmployeeStatus, ChipStatus> = {
  Onboarding: 'Draft',
  Probation: 'Documentation',
  Active: 'Delivered',
  'On Notice': 'Pending',
  Exited: 'Cancelled',
}

const LEAVE_CHIP: Record<LeaveStatus, ChipStatus> = {
  Pending: 'Pending',
  Approved: 'Delivered',
  Rejected: 'Cancelled',
  Cancelled: 'Draft',
}

export function HrPage() {
  const [tab, setTab] = useState('employees')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [leaveModal, setLeaveModal] = useState(false)
  const { employees, leaveRequests, payrollRuns, approvals, cancelLeave } = useDataStore()

  const kpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const onLeaveToday = leaveRequests.filter(
      (r) => r.status === 'Approved' && r.from <= today && r.to >= today,
    ).length
    const docsExpiring = employees.reduce(
      (n, e) =>
        n +
        e.documents.filter(
          (d) => d.expiry && new Date(d.expiry).getTime() - Date.now() < 60 * 86400000,
        ).length,
      0,
    )
    return {
      headcount: employees.filter((e) => e.status !== 'Exited').length,
      onLeaveToday,
      pendingLeave: approvals.filter((a) => a.entityType === 'leave_request' && a.status === 'Pending').length,
      docsExpiring,
      probation: employees.filter((e) => e.status === 'Probation').length,
    }
  }, [employees, leaveRequests, approvals])

  const selected = employees.find((e) => e.id === selectedId) ?? null

  const employeeRows = employees.map((e) => ({
    Code: e.code,
    Name: e.name,
    Designation: e.designation,
    Department: e.department,
    'Date of Joining': e.dateOfJoining,
    'Reports To': employees.find((m) => m.id === e.reportingTo)?.name ?? '',
    'CL Left': balanceFor(e, 'Casual'),
    'SL Left': balanceFor(e, 'Sick'),
    'EL Left': balanceFor(e, 'Earned'),
    Status: e.status,
  }))

  const leaveRows = leaveRequests.map((r) => ({
    Employee: r.employeeName,
    Type: r.type,
    From: r.from,
    To: r.to,
    Days: r.days,
    'LOP Days': r.lopDays,
    Reason: r.reason,
    Status: r.status,
  }))

  const payrollRows = payrollRuns.map((p) => ({
    Month: p.month,
    Employees: p.employees,
    'Gross (INR)': p.grossInr,
    'LOP Deductions (INR)': p.lopDeductionsInr,
    Status: p.status,
  }))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">HR</h1>
          <p className="mt-1 text-sm text-muted">
            Employee register, Indian leave engine (CL 12 · SL 12 · EL 15 + carry-forward), manager approvals via
            the shared queue, clearance-gated exits, and the payroll register (full payroll: Phase 2).
          </p>
        </div>
        <Button onClick={() => setLeaveModal(true)}>
          <Plus size={15} /> Apply for leave
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatKpi label="Headcount" value={kpis.headcount} icon={<Users size={17} />} tint="#ECFDF5" color="#10B981" />
        <StatKpi label="On leave today" value={kpis.onLeaveToday} icon={<CalendarOff size={17} />} tint="#EFF6FF" color="#3B82F6" />
        <StatKpi label="Pending approvals" value={kpis.pendingLeave} icon={<ClipboardCheck size={17} />} tint="#FFF7ED" color="#F97316" />
        <StatKpi label="Docs expiring <60d" value={kpis.docsExpiring} icon={<FileWarning size={17} />} tint="#FEE2E2" color="#DC2626" />
        <StatKpi label="On probation" value={kpis.probation} icon={<GraduationCap size={17} />} tint="#F5F3FF" color="#8B5CF6" />
      </div>

      <Tabs
        tabs={[
          { key: 'employees', label: 'Employees', badge: kpis.headcount },
          { key: 'leave', label: 'Leave requests', badge: leaveRequests.filter((r) => r.status === 'Pending').length },
          { key: 'holidays', label: 'Holiday calendar' },
          { key: 'payroll', label: 'Payroll', badge: undefined },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'employees' && (
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-end border-b border-line px-4 py-2.5">
              <CsvButton filename="hr-employees" rows={employeeRows} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-5 py-3 font-medium">Code</th>
                    <th className="px-3 py-3 font-medium">Employee</th>
                    <th className="px-3 py-3 font-medium">Department</th>
                    <th className="px-3 py-3 font-medium">Joined</th>
                    <th className="px-3 py-3 font-medium">Reports to</th>
                    <th className="px-3 py-3 font-medium">Leave left (CL/SL/EL)</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => setSelectedId(e.id === selectedId ? null : e.id)}
                      className={`cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60 ${
                        selectedId === e.id ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="px-5 py-3 font-mono text-xs font-medium text-link">{e.code}</td>
                      <td className="px-3 py-3">
                        <p className="text-[13px] font-medium text-heading">{e.name}</p>
                        <p className="text-[11px] text-muted">{e.designation}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-body">{e.department}</td>
                      <td className="px-3 py-3 font-mono text-xs text-body">{e.dateOfJoining}</td>
                      <td className="px-3 py-3 text-xs text-body">
                        {employees.find((m) => m.id === e.reportingTo)?.name ?? '—'}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-body">
                        {balanceFor(e, 'Casual')} / {balanceFor(e, 'Sick')} / {balanceFor(e, 'Earned')}
                      </td>
                      <td className="px-5 py-3">
                        <StatusChip status={EMP_CHIP[e.status]} />
                        <span className="ml-2 text-[11px] text-muted">{e.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {selected && <EmployeeDetail employee={selected} />}
        </div>
      )}

      {tab === 'leave' && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-end border-b border-line px-4 py-2.5">
            <CsvButton filename="hr-leave-requests" rows={leaveRows} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-medium">Employee</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 font-medium">Dates</th>
                  <th className="px-3 py-3 font-medium">Days</th>
                  <th className="px-3 py-3 font-medium">Reason</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 text-[13px] font-medium text-heading">{r.employeeName}</td>
                    <td className="px-3 py-3 text-xs text-body">
                      {r.type}
                      {r.medicalCert && <span className="ml-1.5 rounded-badge bg-[#DBEAFE] px-1.5 py-0.5 text-[10px] font-semibold text-[#1D4ED8]">cert</span>}
                      {r.lopDays > 0 && <span className="ml-1.5 rounded-badge bg-[#FEE2E2] px-1.5 py-0.5 text-[10px] font-semibold text-[#DC2626]">{r.lopDays}d LOP</span>}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-body">{r.from} → {r.to}</td>
                    <td className="px-3 py-3 font-mono text-xs text-body">{r.days}</td>
                    <td className="px-3 py-3 text-xs text-body">{r.reason}</td>
                    <td className="px-3 py-3"><StatusChip status={LEAVE_CHIP[r.status]} /></td>
                    <td className="px-5 py-3 text-right">
                      {r.status === 'Pending' && (
                        <Button size="sm" variant="ghost" onClick={() => cancelLeave(r.id)}>Cancel</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            Pending requests are decided in the shared Approvals queue — approving deducts the balance; shortfalls
            convert to Loss of Pay and flow to the payroll deduction.
          </p>
        </Card>
      )}

      {tab === 'holidays' && (
        <Card>
          <div className="px-5 pb-5 pt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Company holidays — 2026 (Maharashtra)</p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {HOLIDAYS_2026.map((h) => (
                <div key={h.date} className="flex items-center gap-3 rounded-btn border border-line bg-surface-2/40 px-3 py-2 text-xs">
                  <span className="font-mono font-medium text-heading">{h.date}</span>
                  <span className="text-body">{h.name}</span>
                  <span className="ml-auto text-muted">{new Date(h.date).toLocaleDateString('en-GB', { weekday: 'long' })}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {tab === 'payroll' && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-end border-b border-line px-4 py-2.5">
            <CsvButton filename="hr-payroll" rows={payrollRows} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-medium">Month</th>
                  <th className="px-3 py-3 font-medium">Employees</th>
                  <th className="px-3 py-3 font-medium">Gross (INR)</th>
                  <th className="px-3 py-3 font-medium">LOP deductions</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {payrollRuns.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-mono text-xs font-medium text-heading">{p.month}</td>
                    <td className="px-3 py-3 font-mono text-xs text-body">{p.employees}</td>
                    <td className="px-3 py-3 font-mono text-xs text-body">₹{p.grossInr.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-3 font-mono text-xs text-body">
                      {p.lopDeductionsInr > 0 ? `−₹${p.lopDeductionsInr.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-5 py-3"><StatusChip status={p.status === 'Paid' ? 'Delivered' : 'Pending'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            Payroll register (read-only). Full payroll processing — salary structures, statutory deductions
            (PF/ESI/PT/TDS), payslips — lands in Phase 2 per the product reference; approved-LOP days already
            feed this register.
          </p>
        </Card>
      )}

      <LeaveModal open={leaveModal} onClose={() => setLeaveModal(false)} onDone={() => { setLeaveModal(false); setTab('leave') }} />
    </div>
  )
}

/* ── Apply-for-leave modal ───────────────────────────────────── */

function LeaveModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { employees, requestLeave } = useDataStore()
  const [employeeId, setEmployeeId] = useState('')
  const [type, setType] = useState<LeaveType>('Casual')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [medicalCert, setMedicalCert] = useState(false)

  const emp = employees.find((e) => e.id === employeeId)
  const days = from && to ? daysBetween(from, to) : 0
  const bal = emp && type !== 'Loss of Pay' ? balanceFor(emp, type) : Infinity
  const shortfall = Math.max(0, days - bal)
  const needsCert = type === 'Sick' && days > SICK_CERT_THRESHOLD_DAYS
  const valid = emp && days > 0 && reason && (!needsCert || medicalCert)

  const reset = () => { setEmployeeId(''); setFrom(''); setTo(''); setReason(''); setMedicalCert(false); setType('Casual') }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title="Apply for leave"
      subtitle="Routes to manager approval in the shared queue"
      footer={
        <Button
          disabled={!valid}
          className="disabled:opacity-50"
          onClick={() => {
            requestLeave({ employeeId, type, from, to, reason, medicalCert })
            reset()
            onDone()
          }}
        >
          Submit request
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Employee">
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select…</option>
            {employees.filter((e) => e.status !== 'Exited').map((e) => (
              <option key={e.id} value={e.id}>{e.name} — {e.department}</option>
            ))}
          </Select>
        </Field>
        <Field label="Leave type">
          <Select value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
            <option>Casual</option>
            <option>Sick</option>
            <option>Earned</option>
            <option>Loss of Pay</option>
          </Select>
        </Field>
        <Field label="From">
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Reason">
          <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Short reason" />
        </Field>
        {needsCert && (
          <label className="flex items-end gap-2 pb-2.5 text-xs text-heading">
            <input type="checkbox" checked={medicalCert} onChange={(e) => setMedicalCert(e.target.checked)} className="h-4 w-4 accent-[#10B981]" />
            Medical certificate attached (required for sick leave beyond {SICK_CERT_THRESHOLD_DAYS} days)
          </label>
        )}
      </div>
      {emp && days > 0 && (
        <div className="mt-4 rounded-btn border border-line bg-surface-2/60 p-3 text-xs text-body">
          {days} day(s) requested
          {type !== 'Loss of Pay' && <> · balance {bal} day(s)</>}
          {shortfall > 0 && (
            <span className="ml-2 rounded-badge bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-semibold text-[#DC2626]">
              {shortfall}d beyond balance — will convert to Loss of Pay on approval
            </span>
          )}
        </div>
      )}
    </Modal>
  )
}
