import { useState } from 'react'
import { Ship } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useAuthStore } from '../store/useAuthStore'

/** Shown after a user clicks the reset link in their email (Supabase has put
    them in a temporary recovery session). They set a new password here; on
    success we drop the recovery flag and the app routes them in normally. */
export function ResetPasswordPage() {
  const { updatePassword, clearRecoveryMode, signOut } = useAuthStore()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
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
      clearRecoveryMode()
    }
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
          <h2 className="text-base font-semibold text-heading">Set a new password</h2>
          <p className="mt-0.5 text-xs text-muted">Choose a new password for your account.</p>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-body">New password</label>
              <input
                type="password"
                name="new-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full rounded-input border border-[#E5E7EB] dark:border-line bg-surface px-3.5 py-2.5 text-sm text-heading placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                required
                minLength={6}
                className="w-full rounded-input border border-[#E5E7EB] dark:border-line bg-surface px-3.5 py-2.5 text-sm text-heading placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {error && <p className="text-xs text-accent-coral">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full justify-center disabled:opacity-50">
              {busy ? 'Saving…' : 'Save new password'}
            </Button>
          </form>

          <button
            type="button"
            onClick={async () => { await signOut() }}
            className="mt-4 block w-full text-center text-xs text-link hover:underline"
          >
            Cancel and sign out
          </button>
        </div>
      </div>
    </div>
  )
}
