import { useEffect, useState } from 'react'
import { User, ShieldCheck, SlidersHorizontal, Building2, Sun, Moon } from 'lucide-react'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useAuthStore, useCurrentUser } from '../store/useAuthStore'
import { useUiStore } from '../store/useUiStore'
import { useOrgStore } from '../store/useOrgStore'
import { ROLE_LABELS } from '../lib/rbac'

const inputCls =
  'w-full rounded-input border border-[#E5E7EB] dark:border-line bg-surface px-3.5 py-2.5 text-sm text-heading placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

export function SettingsPage() {
  const user = useCurrentUser()

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-heading">Settings</h1>
      <p className="mt-1 text-sm text-muted">Manage your profile, security, and preferences.</p>

      <div className="mt-6 space-y-5">
        <ProfileSection />
        <SecuritySection />
        <PreferencesSection />
        {user?.role === 'admin' && <WorkspaceSection />}
      </div>
    </div>
  )
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User
  title: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Icon size={16} className="text-primary" />
            {title}
          </span>
        }
      />
      <div className="px-5 pb-5">{children}</div>
    </Card>
  )
}

function ProfileSection() {
  const user = useCurrentUser()
  if (!user) return null
  return (
    <SectionCard icon={User} title="Profile">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" value={user.name} />
        <Field label="Email" value={user.email} />
        <Field label="Role" value={ROLE_LABELS[user.role]} />
        <Field label="Status" value={user.status} />
      </dl>
      <p className="mt-4 text-xs text-muted">
        Name and role changes are managed by an Admin under Users &amp; Roles.
      </p>
    </SectionCard>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-heading">{value}</dd>
    </div>
  )
}

function SecuritySection() {
  const user = useCurrentUser()
  const { updatePassword, sendPasswordReset } = useAuthStore()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    const { error } = await updatePassword(password)
    setBusy(false)
    if (error) {
      setError(error)
    } else {
      setInfo('Password updated.')
      setPassword('')
      setConfirm('')
    }
  }

  const emailReset = async () => {
    if (!user) return
    setError('')
    setInfo('')
    setResetBusy(true)
    const { error } = await sendPasswordReset(user.email)
    setResetBusy(false)
    if (error) setError(error)
    else setInfo(`A password-reset link has been sent to ${user.email}.`)
  }

  return (
    <SectionCard icon={ShieldCheck} title="Security">
      <form onSubmit={changePassword} className="space-y-3">
        {/* Hidden username field so browser/Google password managers associate
            the new password with this account when they offer to save it. */}
        <input type="text" name="username" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-body">New password</label>
            <input
              type="password"
              name="new-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-body">Confirm new password</label>
            <input
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              className={inputCls}
            />
          </div>
        </div>
        {error && <p className="text-xs text-accent-coral">{error}</p>}
        {info && <p className="text-xs text-primary">{info}</p>}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="submit" disabled={busy || !password} className="disabled:opacity-50">
            {busy ? 'Saving…' : 'Update password'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={emailReset}
            disabled={resetBusy}
            className="disabled:opacity-50"
          >
            {resetBusy ? 'Sending…' : 'Email me a reset link'}
          </Button>
        </div>
      </form>
    </SectionCard>
  )
}

function PreferencesSection() {
  const { theme, setTheme } = useUiStore()
  return (
    <SectionCard icon={SlidersHorizontal} title="Preferences">
      <div>
        <p className="text-xs font-medium text-body">Theme</p>
        <div className="mt-2 inline-flex rounded-btn border border-line p-1">
          <button
            onClick={() => setTheme('light')}
            className={`flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-medium ${
              theme === 'light' ? 'bg-primary text-white' : 'text-body hover:bg-surface-2'
            }`}
          >
            <Sun size={13} /> Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-medium ${
              theme === 'dark' ? 'bg-primary text-white' : 'text-body hover:bg-surface-2'
            }`}
          >
            <Moon size={13} /> Dark
          </button>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted">
        Default landing page and date/number formatting — coming soon.
      </p>
    </SectionCard>
  )
}

function WorkspaceSection() {
  const { name, defaultCurrency, taxId, address, setOrgProfile } = useOrgStore()
  const { accountCount, fetchAccountCount } = useAuthStore()
  const [form, setForm] = useState({ name, defaultCurrency, taxId, address })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchAccountCount()
  }, [fetchAccountCount])

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    setOrgProfile(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const limitPct = accountCount != null ? Math.min(100, (accountCount / 10) * 100) : 0
  const nearLimit = accountCount != null && accountCount >= 8

  return (
    <SectionCard icon={Building2} title="Workspace (Admin)">
      <div className="mb-5">
        <p className="text-xs font-medium text-body">Account usage</p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full ${nearLimit ? 'bg-accent-coral' : 'bg-primary'}`}
            style={{ width: `${limitPct}%` }}
          />
        </div>
        <p className={`mt-1.5 text-xs ${nearLimit ? 'text-accent-coral' : 'text-muted'}`}>
          {accountCount != null ? `${accountCount} of 10 accounts used` : 'Loading…'}
          {nearLimit && ' — approaching the workspace limit.'}
        </p>
      </div>

      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-body">Organization name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-body">Default currency</label>
            <select
              value={form.defaultCurrency}
              onChange={(e) => setForm((f) => ({ ...f, defaultCurrency: e.target.value as 'USD' | 'INR' }))}
              className={inputCls}
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-body">Tax ID / GSTIN</label>
            <input
              type="text"
              value={form.taxId}
              onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
              placeholder="e.g. 27AAAAA0000A1Z5"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-body">Registered address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Button type="submit">Save organization profile</Button>
          {saved && <p className="text-xs text-primary">Saved.</p>}
        </div>
      </form>

      <p className="mt-4 text-xs text-muted">
        This isn't wired into app branding yet (sidebar/login still show "Kinetic Line" as fixed text) —
        that's a separate follow-up so it doesn't get changed silently.
      </p>

      <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
        Dropdown master options (customers, container types, charge codes) and audit-log export — coming soon.
      </p>
    </SectionCard>
  )
}
