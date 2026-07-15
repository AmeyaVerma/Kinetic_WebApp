import { useState } from 'react'
import { Ship, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useAuthStore } from '../store/useAuthStore'
import { ROLE_LABELS } from '../lib/rbac'
import type { AppUser } from '../store/useAuthStore'

/** MFA is required for high-privilege roles (design §1). */
const MFA_ROLES = ['admin', 'finance']

export function LoginPage() {
  const { users, login } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [pendingUser, setPendingUser] = useState<AppUser | null>(null)
  const [code, setCode] = useState('')

  const activeUsers = users.filter((u) => u.status !== 'Suspended')
  const staff = activeUsers.filter((u) => !u.scopeName)
  const external = activeUsers.filter((u) => u.scopeName)

  const attempt = (u: AppUser | undefined) => {
    setError('')
    if (!u) {
      setError('No account matches that email. Try a demo account below.')
      return
    }
    if (u.status === 'Suspended') {
      setError('This account is suspended. Contact your administrator.')
      return
    }
    if (MFA_ROLES.includes(u.role) && u.mfaEnabled) {
      setPendingUser(u)
      return
    }
    login(u.id)
  }

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault()
    attempt(users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()))
  }

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your authenticator.')
      return
    }
    if (pendingUser) login(pendingUser.id)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Ship size={26} strokeWidth={2.2} />
          </div>
          <h1 className="mt-3 font-display text-xl font-bold tracking-wide text-heading">KINETIC LINE</h1>
          <p className="text-[11px] font-medium tracking-[0.16em] text-muted">LOGISTICS ERP</p>
        </div>

        <div className="rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
          {!pendingUser ? (
            <>
              <h2 className="text-base font-semibold text-heading">Sign in to continue</h2>
              <p className="mt-0.5 text-xs text-muted">Use your work email, or pick a demo account below.</p>

              <form onSubmit={submitEmail} className="mt-5 space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-body">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@kintlog.com"
                    className="w-full rounded-input border border-[#E5E7EB] dark:border-line bg-surface px-3.5 py-2.5 text-sm text-heading placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-body">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-input border border-[#E5E7EB] dark:border-line bg-surface px-3.5 py-2.5 pr-10 text-sm text-heading placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-body"
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-xs text-accent-coral">{error}</p>}
                <Button type="submit" className="w-full justify-center">Sign in</Button>
                <button type="button" className="block w-full text-center text-xs text-link hover:underline">
                  Forgot password?
                </button>
              </form>

              <div className="mt-6 border-t border-line pt-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Demo sign-in — staff
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {staff.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => attempt(u)}
                      className="rounded-badge border border-line bg-surface-2/60 px-2.5 py-1 text-[11px] font-medium text-body hover:bg-primary/10 hover:text-primary"
                      title={u.email}
                    >
                      {u.name.split(' ')[0]} · {ROLE_LABELS[u.role]}
                    </button>
                  ))}
                </div>
                <p className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Demo sign-in — external portals
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {external.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => attempt(u)}
                      className="rounded-badge border border-line bg-surface-2/60 px-2.5 py-1 text-[11px] font-medium text-body hover:bg-primary/10 hover:text-primary"
                      title={u.email}
                    >
                      {ROLE_LABELS[u.role]}: {u.scopeName}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck size={18} />
                <h2 className="text-base font-semibold text-heading">Two-factor verification</h2>
              </div>
              <p className="mt-1 text-xs text-muted">
                {ROLE_LABELS[pendingUser.role]} access requires MFA. Enter the 6-digit code for{' '}
                <span className="font-medium text-body">{pendingUser.email}</span>.
              </p>
              <form onSubmit={submitCode} className="mt-5 space-y-3">
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full rounded-input border border-[#E5E7EB] dark:border-line bg-surface px-3.5 py-3 text-center font-mono text-lg tracking-[0.4em] text-heading placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {error && <p className="text-xs text-accent-coral">{error}</p>}
                <Button type="submit" className="w-full justify-center">
                  Verify & sign in <ArrowRight size={15} />
                </Button>
                <button
                  type="button"
                  onClick={() => { setPendingUser(null); setCode(''); setError('') }}
                  className="block w-full text-center text-xs text-muted hover:text-body"
                >
                  Back
                </button>
              </form>
              <p className="mt-3 text-center text-[10px] text-muted">Demo: any 6 digits work.</p>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-muted">
          Access is role-based — you'll only see what your role allows.
        </p>
      </div>
    </div>
  )
}
