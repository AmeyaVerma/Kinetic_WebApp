import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, Trash2 } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'
import { useCurrentUser } from '../../store/useAuthStore'
import { MFA_REQUIRED_ROLES, roleRequiresMfa } from '../../lib/mfa'
import { ROLE_LABELS } from '../../lib/rbac'

/**
 * Two-factor authentication, for real.
 *
 * `profiles.mfa_enabled` was a boolean nothing ever set: the app displayed it
 * but had no way to turn it on, so "MFA mandatory for Admin, Finance and HR"
 * could only have been enforced by locking those people out of their own
 * system. This enrols a TOTP factor through Supabase Auth, which is what the
 * sign-in actually checks, and keeps the display flag in step with it.
 */

type Factor = { id: string; friendlyName?: string; status: string }

export function TwoFactorSection() {
  const user = useCurrentUser()
  const [factors, setFactors] = useState<Factor[]>([])
  const [loading, setLoading] = useState(true)

  // Enrolment in progress
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const verified = factors.filter((f) => f.status === 'verified')
  const required = roleRequiresMfa(user?.role)

  const refresh = useCallback(async () => {
    const { data, error: err } = await supabase.auth.mfa.listFactors()
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    const totp = (data?.totp ?? []) as Factor[]
    setFactors(totp)
    setLoading(false)
    // Keep the flag the Users screen reads in step with the real factors.
    if (user) {
      const on = totp.some((f) => f.status === 'verified')
      await supabase.from('profiles').update({ mfa_enabled: on }).eq('id', user.id)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const startEnrolment = async () => {
    setError('')
    setInfo('')
    setBusy(true)
    const { data, error: err } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Authenticator ${new Date().toLocaleDateString()}`,
    })
    setBusy(false)
    if (err || !data) {
      setError(
        err?.message.includes('not enabled')
          ? 'Two-factor authentication is not switched on for this project yet — an Admin needs to enable TOTP in the Supabase Auth settings first.'
          : (err?.message ?? 'Could not start enrolment.'),
      )
      return
    }
    setPendingId(data.id)
    setQr(data.totp.qr_code)
    setSecret(data.totp.secret)
  }

  const confirmEnrolment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingId) return
    setError('')
    setBusy(true)
    const challenge = await supabase.auth.mfa.challenge({ factorId: pendingId })
    if (challenge.error || !challenge.data) {
      setBusy(false)
      setError(challenge.error?.message ?? 'Could not start the check.')
      return
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: pendingId,
      challengeId: challenge.data.id,
      code: code.trim(),
    })
    setBusy(false)
    if (verifyError) {
      setError('That code was not accepted. Check your authenticator and try again.')
      return
    }
    setQr(null)
    setSecret(null)
    setPendingId(null)
    setCode('')
    setInfo('Two-factor authentication is on for this account.')
    await refresh()
  }

  const cancelEnrolment = async () => {
    if (pendingId) await supabase.auth.mfa.unenroll({ factorId: pendingId })
    setQr(null)
    setSecret(null)
    setPendingId(null)
    setCode('')
    setError('')
    await refresh()
  }

  const remove = async (factorId: string) => {
    if (required && verified.length <= 1) {
      setError(
        `Your role (${ROLE_LABELS[user!.role]}) requires two-factor authentication, so the last method cannot be removed.`,
      )
      return
    }
    setBusy(true)
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setInfo('Two-factor method removed.')
    await refresh()
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start gap-2.5">
        {verified.length > 0 ? (
          <ShieldCheck size={18} className="mt-0.5 text-primary" />
        ) : (
          <ShieldAlert size={18} className="mt-0.5 text-accent-orange" />
        )}
        <div>
          <h3 className="text-[15px] font-semibold">Two-factor authentication</h3>
          <p className="text-xs text-muted">
            A code from your phone on top of your password. Required for{' '}
            {MFA_REQUIRED_ROLES.map((r) => ROLE_LABELS[r]).join(', ')} — these roles can
            release bills of lading, move money and see payroll.
          </p>
        </div>
      </div>

      {required && verified.length === 0 && !qr && (
        <p className="rounded-btn border border-[#FDE68A] bg-[#FEF3C7]/50 px-3 py-2 text-xs text-[#B45309]">
          Your role requires two-factor authentication and it is not set up yet.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted">Checking…</p>
      ) : qr ? (
        <form onSubmit={confirmEnrolment} className="space-y-3">
          <p className="text-sm text-body">
            Scan this with Google Authenticator, Authy or 1Password, then enter the six-digit
            code it shows.
          </p>
          <img src={qr} alt="Two-factor QR code" className="h-44 w-44 rounded-btn border border-line bg-white p-2" />
          {secret && (
            <p className="text-xs text-muted">
              Can't scan? Enter this key by hand: <span className="font-mono text-heading">{secret}</span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <TextInput
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              inputMode="numeric"
              className="w-32 font-mono"
            />
            <Button type="submit" size="sm" disabled={busy || code.trim().length < 6}>
              {busy ? 'Checking…' : 'Turn on'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancelEnrolment} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      ) : verified.length > 0 ? (
        <div className="space-y-2">
          {verified.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-btn border border-line bg-surface-2/40 px-3 py-2"
            >
              <ShieldCheck size={14} className="text-primary" />
              <span className="text-[13px] text-heading">{f.friendlyName || 'Authenticator app'}</span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto text-accent-coral"
                disabled={busy}
                onClick={() => remove(f.id)}
              >
                <Trash2 size={13} /> Remove
              </Button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={startEnrolment} disabled={busy}>
            Add another device
          </Button>
        </div>
      ) : (
        <Button size="sm" onClick={startEnrolment} disabled={busy}>
          {busy ? 'Starting…' : 'Set up two-factor authentication'}
        </Button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {info && <p className="text-sm text-primary">{info}</p>}
    </Card>
  )
}
