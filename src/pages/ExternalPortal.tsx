import { useMemo } from 'react'
import { Ship, LogOut, Lock } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { StatusChip } from '../components/ui/StatusChip'
import { ProgressBar } from '../components/ui/ProgressBar'
import { useAuthStore } from '../store/useAuthStore'
import { useUiStore } from '../store/useUiStore'
import { useDataStore } from '../store/useDataStore'
import { cyclePct, deriveStatus, toChipStatus } from '../lib/milestones'
import { mockAgents } from '../mocks/masters'
import { ROLE_LABELS } from '../lib/rbac'
import type { AppUser } from '../store/useAuthStore'

/** The "different building" for external roles — a scoped, read-only
    view of only their own shipments. RLS enforces this for real later. */
export function ExternalPortal({ user }: { user: AppUser }) {
  const { signOut } = useAuthStore()
  const { theme, setTheme } = useUiStore()
  const { bookings, milestones } = useDataStore()

  const scoped = useMemo(() => {
    if (user.role === 'customer') {
      return bookings.filter((b) => b.bookingPartyName === user.scopeName)
    }
    // agent — bookings tagged to their agency relationship
    const agentId = mockAgents.find((a) => a.name === user.scopeName)?.id
    return bookings.filter((b) => b.originAgentId === agentId || b.destinationAgentId === agentId)
  }, [bookings, user])

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur-md lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Ship size={19} strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold tracking-wide text-heading">KINETIC LINE</p>
            <p className="text-[10px] font-medium tracking-[0.12em] text-muted">
              {ROLE_LABELS[user.role].toUpperCase()} PORTAL
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex rounded-badge border border-line bg-surface p-1">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`rounded-badge px-2.5 py-1 text-[11px] font-medium capitalize ${
                  theme === t ? 'bg-primary text-white' : 'text-body hover:bg-surface-2'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-[13px] font-semibold text-heading">{user.name}</p>
            <p className="text-[11px] text-muted">{user.scopeName}</p>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-btn border border-line bg-surface px-3 py-1.5 text-xs font-medium text-body hover:bg-surface-2"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-content px-4 py-8 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold">My shipments</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <Lock size={13} /> Scoped to {user.scopeName} — you only see your own bookings.
          </p>
        </div>

        <Card className="mt-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-medium">Booking Ref</th>
                  <th className="px-3 py-3 font-medium">POL → POD</th>
                  <th className="px-3 py-3 font-medium">Vessel / Voyage</th>
                  <th className="px-3 py-3 font-medium">ETD</th>
                  <th className="px-3 py-3 font-medium">Progress</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {scoped.map((b) => {
                  const entries = milestones.filter((m) => m.bookingId === b.id)
                  const status = deriveStatus(b.direction, entries, b.cancelled)
                  const pct = cyclePct(b.direction, entries)
                  return (
                    <tr key={b.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                      <td className="px-5 py-3 font-mono text-xs font-medium text-link">{b.bookingRef}</td>
                      <td className="px-3 py-3 text-xs text-body">{b.pol} → {b.pod}</td>
                      <td className="px-3 py-3 text-xs text-body">{b.vesselName} / {b.voyageNo}</td>
                      <td className="px-3 py-3 font-mono text-xs text-body">{b.etd}</td>
                      <td className="w-36 px-3 py-3">
                        <div className="flex items-center gap-2">
                          <ProgressBar pct={pct} color="#10B981" />
                          <span className="w-8 font-mono text-[11px] text-muted">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3"><StatusChip status={toChipStatus(status)} /></td>
                    </tr>
                  )
                })}
                {scoped.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted">
                      No shipments assigned to your account yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <p className="mt-4 text-xs text-muted">
          Booking requests, BL editing and document downloads appear here based on the permissions your
          Kinetic Line administrator has enabled for your account.
        </p>
      </main>
    </div>
  )
}
