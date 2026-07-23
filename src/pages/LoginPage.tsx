import { useState } from 'react'
import { Ship, Eye, EyeOff } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useAuthStore } from '../store/useAuthStore'

type Mode = 'signin' | 'signup' | 'forgot'

export function LoginPage() {
  const { signIn, signUp, sendPasswordReset } = useAuthStore()
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const switchMode = (m: Mode) => {
    setMode(m)
    setError('')
    setInfo('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    if (mode === 'signin') {
      const { error } = await signIn(email.trim(), password)
      if (error) setError(error)
    } else if (mode === 'signup') {
      const { error } = await signUp(email.trim(), password, name.trim())
      if (error) {
        setError(error)
      } else {
        setInfo('Account created. If email confirmation is required, check your inbox — otherwise you\'re signed in.')
      }
    } else {
      const { error } = await sendPasswordReset(email.trim())
      if (error) {
        setError(error)
      } else {
        setInfo('If an account exists for that email, a password-reset link is on its way. Check your inbox.')
      }
    }
    setBusy(false)
  }

  const heading =
    mode === 'signin' ? 'Sign in to continue'
    : mode === 'signup' ? 'Create your account'
    : 'Reset your password'

  const subheading =
    mode === 'signin' ? 'Use your work email and password.'
    : mode === 'signup' ? 'First account created becomes Admin automatically.'
    : 'Enter your email and we\'ll send you a link to set a new password.'

  const cta =
    mode === 'signin' ? 'Sign in'
    : mode === 'signup' ? 'Create account'
    : 'Send reset link'

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
          <h2 className="text-base font-semibold text-heading">{heading}</h2>
          <p className="mt-0.5 text-xs text-muted">{subheading}</p>

          <form onSubmit={submit} className="mt-5 space-y-3">
            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-body">Full name</label>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Siddharth Singh"
                  required
                  className="w-full rounded-input border border-[#E5E7EB] dark:border-line bg-surface px-3.5 py-2.5 text-sm text-heading placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-body">Email</label>
              <input
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@kintlog.com"
                required
                className="w-full rounded-input border border-[#E5E7EB] dark:border-line bg-surface px-3.5 py-2.5 text-sm text-heading placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {mode !== 'forgot' && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-xs font-medium text-body">Password</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-[11px] text-link hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    name="password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
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
            )}
            {error && <p className="text-xs text-accent-coral">{error}</p>}
            {info && <p className="text-xs text-primary">{info}</p>}
            <Button type="submit" disabled={busy} className="w-full justify-center disabled:opacity-50">
              {busy ? 'Please wait…' : cta}
            </Button>
          </form>

          {mode === 'forgot' ? (
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="mt-4 block w-full text-center text-xs text-link hover:underline"
            >
              Back to sign in
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              className="mt-4 block w-full text-center text-xs text-link hover:underline"
            >
              {mode === 'signin' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
            </button>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-muted">
          Access is role-based — you'll only see what your role allows.
        </p>
      </div>
    </div>
  )
}
