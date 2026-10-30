import { useEffect, useState } from 'react'
import { UserPlus, ShieldCheck, KeyRound, Trash2, Eye, Check, X, UserCheck } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { CsvButton } from '../../components/ui/CsvButton'
import { AuditTrailTab } from '../../components/admin/AuditTrailTab'
import { PortalAccountsTab } from '../../components/admin/PortalAccountsTab'
import { Badge, type BadgeTone } from '../../components/ui/Badge'
import { Tabs } from '../../components/ui/Tabs'
import { Modal } from '../../components/ui/Modal'
import { Field, Select, TextInput } from '../../components/ui/Field'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import {
  ACCESS_LABEL,
  INTERNAL_ROLES,
  MODULES,
  ROLE_LABELS,
  ROLE_MATRIX,
  effectiveAccess,
} from '../../lib/rbac'
import type { Access } from '../../lib/rbac'
import type { Role } from '../../lib/types'
import type { AppUser, UserStatus } from '../../store/useAuthStore'

const STATUS_TONE: Record<UserStatus, BadgeTone> = {
  Active: 'success',
  Pending: 'attention',
  Invited: 'info',
  Suspended: 'danger',
}

const ALL_ROLES: Role[] = [...INTERNAL_ROLES, 'customer', 'agent']

export function UsersRolesPage() {
  const [tab, setTab] = useState('pending')
  const { users, pendingSignups, fetchPendingSignups } = useAuthStore()

  useEffect(() => {
    fetchPendingSignups()
  }, [fetchPendingSignups])

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-primary" />
          <h1 className="text-2xl font-bold">Users &amp; Roles</h1>
          <span className="rounded-badge bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            Admin only
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Assign roles, fine-tune per-person access, and manage staff logins. Changes take effect immediately
          and are recorded in the audit trail. External customer/agent logins are managed inside their own records.
        </p>
      </div>

      <Tabs
        tabs={[
          { key: 'pending', label: 'Pending approvals', badge: pendingSignups.length || undefined },
          { key: 'users', label: 'Users', badge: users.length },
          { key: 'portal', label: 'Portal accounts' },
          { key: 'roles', label: 'Roles & permissions' },
          { key: 'audit', label: 'Audit trail', badge: undefined },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'pending' && <PendingApprovalsTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'portal' && <PortalAccountsTab />}
      {tab === 'roles' && <RolesTab />}
      {tab === 'audit' && <AuditTrailTab />}
    </div>
  )
}

/* ── Pending approvals (real, Supabase-backed) ───────────────── */

function PendingApprovalsTab() {
  const { pendingSignups, approveSignup, rejectSignup } = useAuthStore()
  const [roleChoice, setRoleChoice] = useState<Record<string, Role>>({})

  if (pendingSignups.length === 0) {
    return (
      <Card className="flex h-40 items-center justify-center">
        <p className="flex items-center gap-2 text-sm text-muted">
          <UserCheck size={16} /> No signups waiting on approval
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {pendingSignups.map((p) => {
        const role = roleChoice[p.id] ?? 'ops'
        return (
          <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-[13px] font-medium text-heading">{p.name}</p>
              <p className="font-mono text-xs text-muted">{p.email}</p>
              <p className="text-[11px] text-muted">
                Signed up {new Date(p.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={role}
                onChange={(e) => setRoleChoice((r) => ({ ...r, [p.id]: e.target.value as Role }))}
              >
                {INTERNAL_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </Select>
              <Button size="sm" onClick={() => approveSignup(p.id, role)}>
                <Check size={14} /> Approve
              </Button>
              <Button size="sm" variant="ghost" className="text-accent-coral" onClick={() => rejectSignup(p.id)}>
                <X size={14} /> Reject
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

/* ── Users tab ───────────────────────────────────────────────── */

function UsersTab() {
  const { users, usersLoading, fetchUsers } = useAuthStore()

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const selected = users.find((u) => u.id === selectedId) ?? null

  const userRows = users.map((u) => ({
    Name: u.name,
    Email: u.email,
    Role: ROLE_LABELS[u.role],
    MFA: u.mfaEnabled ? 'On' : 'Off',
    Companies: (u.memberships ?? []).map((m) => `${m.tenantName} (${m.role})`).join('; '),
    Status: u.status,
  }))

  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2">
        <CsvButton filename="users" rows={userRows} />
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus size={15} /> Invite user
        </Button>
      </div>

      {usersLoading && (
        <p className="text-sm text-muted">Loading accounts…</p>
      )}
      {!usersLoading && users.length === 0 && (
        <p className="text-sm text-muted">No accounts found.</p>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Email</th>
                <th className="px-3 py-3 font-medium">Role</th>
                <th className="px-3 py-3 font-medium">MFA</th>
                <th className="px-3 py-3 font-medium">Companies</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const overridden = Object.keys(u.overrides).length
                return (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedId(u.id === selectedId ? null : u.id)}
                    className={`cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60 ${
                      selectedId === u.id ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="px-5 py-3">
                      <p className="text-[13px] font-medium text-heading">{u.name}</p>
                      {u.scopeName && <p className="text-[11px] text-muted">{u.scopeName}</p>}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-body">{u.email}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-badge bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-heading">
                        {ROLE_LABELS[u.role]}
                      </span>
                      {overridden > 0 && (
                        <span className="ml-1.5 rounded-badge bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-semibold text-[#B45309]">
                          {overridden} override{overridden > 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {u.mfaEnabled ? <span className="text-primary">On</span> : <span className="text-muted">Off</span>}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {(u.memberships?.length ?? 0) === 0 ? (
                        <span className="text-accent-orange">No access</span>
                      ) : (
                        <span className="text-body">
                          {u.memberships!.map((m) => m.tenantName).join(' · ')}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={STATUS_TONE[u.status]} label={u.status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && <UserDetail user={selected} />}
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  )
}

function UserDetail({ user: u }: { user: AppUser }) {
  const { assignRole, setOverride, setStatus, removeUser } = useAuthStore()
  const current = useCurrentUser()
  const isSelf = current?.id === u.id
  const external = !!u.scopeName

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{u.name}</h3>
          <p className="font-mono text-xs text-muted">{u.email}{u.scopeName ? ` · ${u.scopeName}` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {u.status !== 'Suspended' ? (
            <Button size="sm" variant="secondary" className="text-accent-coral" disabled={isSelf} onClick={() => setStatus(u.id, 'Suspended')}>
              Suspend
            </Button>
          ) : (
            <Button size="sm" onClick={() => setStatus(u.id, 'Active')}>Reactivate</Button>
          )}
          <Button size="sm" variant="ghost"><KeyRound size={14} /> Reset password</Button>
          <Button size="sm" variant="ghost" className="text-accent-coral" disabled={isSelf} onClick={() => removeUser(u.id)}>
            <Trash2 size={14} /> Remove
          </Button>
        </div>
      </div>

      <CompanyAccess user={u} isSelf={isSelf} />

      {isSelf && (
        <p className="mt-3 rounded-btn border border-[#FDE68A] bg-[#FEF3C7]/50 px-3 py-2 text-xs text-[#B45309]">
          This is your own account — you can't suspend or remove yourself.
        </p>
      )}

      {/* Role assignment */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Role — changes access immediately">
          <Select value={u.role} onChange={(e) => assignRole(u.id, e.target.value as Role)}>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end pb-1 text-xs text-muted">
          {external
            ? 'External login — module access is governed inside the customer/agent record, not here.'
            : 'Sets the default access below. Override individual modules on the right.'}
        </div>
      </div>

      {/* Per-user overrides (internal only) */}
      {!external && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Per-user access — override the role default where needed
          </p>
          <div className="overflow-x-auto rounded-card border border-line">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5 font-medium">Module</th>
                  <th className="px-3 py-2.5 font-medium">Role default</th>
                  <th className="px-3 py-2.5 font-medium">This user</th>
                </tr>
              </thead>
              <tbody>
                {MODULES.filter((m) => m.key !== 'users' || u.role === 'admin').map((m) => {
                  const def = ROLE_MATRIX[u.role][m.key]
                  const eff = effectiveAccess(u.role, u.overrides, m.key)
                  const isOverride = m.key in u.overrides
                  return (
                    <tr key={m.key} className="border-b border-line bg-surface last:border-0">
                      <td className="px-4 py-2 text-[13px] font-medium text-heading">{m.label}</td>
                      <td className="px-3 py-2 text-xs text-muted">{ACCESS_LABEL[def]}</td>
                      <td className="px-3 py-2">
                        <select
                          value={isOverride ? eff : 'inherit'}
                          onChange={(e) => setOverride(u.id, m.key, e.target.value as Access | 'inherit')}
                          className={`rounded-btn border px-2 py-1 text-xs ${
                            isOverride
                              ? 'border-[#F59E0B] bg-[#FEF3C7]/60 font-semibold text-[#B45309]'
                              : 'border-line bg-surface text-body'
                          }`}
                        >
                          <option value="inherit">Inherit ({ACCESS_LABEL[def]})</option>
                          <option value="full">Grant · Full</option>
                          <option value="view">Grant · View</option>
                          <option value="none">Revoke</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Highlighted rows differ from the role default. This is the "by your convenience" layer — grant one
            person extra access without inventing a new role.
          </p>
        </div>
      )}
    </Card>
  )
}

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inviteUser = useAuthStore((s) => s.inviteUser)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('ops')
  const valid = name && email.includes('@')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite a user"
      subtitle="They receive an email invite and set their own password"
      footer={
        <Button
          disabled={!valid}
          className="disabled:opacity-50"
          onClick={() => {
            inviteUser({ name, email, role })
            setName(''); setEmail(''); setRole('ops')
            onClose()
          }}
        >
          Send invite
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anjali Verma" />
        </Field>
        <Field label="Work email">
          <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@kintlog.com" />
        </Field>
        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {INTERNAL_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="mt-3 text-xs text-muted">
        The role sets their default access; you can fine-tune per-module overrides after they appear in the list.
      </p>
    </Modal>
  )
}

/* ── Roles & permissions matrix tab ──────────────────────────── */

function RolesTab() {
  const roles = INTERNAL_ROLES
  const cell = (a: Access) =>
    a === 'full'
      ? { t: 'Full', c: '#047857', bg: '#ECFDF5' }
      : a === 'view'
        ? { t: 'View', c: '#1D4ED8', bg: '#EFF6FF' }
        : { t: '—', c: '#94A3B8', bg: 'transparent' }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-5">
        <Eye size={15} className="text-muted" />
        <p className="text-xs text-muted">
          Live map of who can do what. This same matrix becomes the server-side security policy when the
          database is connected — the UI hides, RLS enforces.
        </p>
      </div>
      <div className="overflow-x-auto p-5">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted">
              <th className="sticky left-0 bg-surface px-3 py-2 font-medium">Module</th>
              {roles.map((r) => (
                <th key={r} className="px-3 py-2 text-center font-medium">{ROLE_LABELS[r]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m) => (
              <tr key={m.key} className="border-t border-line">
                <td className="sticky left-0 bg-surface px-3 py-2 text-[13px] font-medium text-heading">{m.label}</td>
                {roles.map((r) => {
                  const s = cell(ROLE_MATRIX[r][m.key])
                  return (
                    <td key={r} className="px-3 py-2 text-center">
                      <span
                        className="inline-block min-w-[44px] rounded-badge px-2 py-0.5 text-[11px] font-semibold"
                        style={{ color: s.c, backgroundColor: s.bg }}
                      >
                        {s.t}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-5 pb-5 text-[11px] text-muted">
        Customer &amp; Agent roles aren't shown — they never enter the internal shell; they get a scoped portal
        of only their own shipments.
      </p>
    </Card>
  )
}

/**
 * Which companies this person may open, and as what.
 *
 * Siddharth: "Yes admin can also choose who can login to which company."
 * Access is a membership row, which is also what row-level security reads —
 * so revoking here genuinely stops the data reaching them, rather than just
 * hiding a menu.
 */
function CompanyAccess({ user: u, isSelf }: { user: AppUser; isSelf: boolean }) {
  const companies = useAuthStore((s) => s.companies)
  const setMembership = useAuthStore((s) => s.setMembership)
  const [busy, setBusy] = useState<string | null>(null)

  const roleIn = (tenantId: string) =>
    u.memberships?.find((m) => m.tenantId === tenantId)?.role ?? null

  const change = async (tenantId: string, role: Role | null) => {
    setBusy(tenantId)
    await setMembership(u.id, tenantId, role)
    setBusy(null)
  }

  if (companies.length === 0) return null

  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Company access</p>
      <p className="mb-3 text-xs text-muted">
        A person can hold a different role in each company. Removing access here stops their
        data reaching them, not just the menu item.
      </p>
      <div className="space-y-2">
        {companies.map((c) => {
          const role = roleIn(c.id)
          // Taking your own last company away would lock you out of the app
          // with no way back in, so that one choice is blocked.
          const lastOwn = isSelf && (u.memberships?.length ?? 0) <= 1 && role !== null
          return (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-btn border border-line bg-surface-2/40 px-3 py-2"
            >
              <span className="text-[13px] font-medium text-heading">{c.name}</span>
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={role ?? ''}
                  disabled={busy === c.id || lastOwn}
                  onChange={(e) => change(c.id, (e.target.value || null) as Role | null)}
                  className="rounded-btn border border-line bg-surface px-2.5 py-1 text-xs font-medium text-heading focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">No access</option>
                  {INTERNAL_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                {busy === c.id && <span className="text-[11px] text-muted">Saving…</span>}
              </div>
              {lastOwn && (
                <p className="w-full text-[11px] text-accent-orange">
                  This is your only company — removing it would lock you out.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
