import { useCallback, useEffect, useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { Download, KeyRound, PenLine, Stamp } from 'lucide-react'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'
import { BlDocument } from '../../lib/pdf/templates/BlFrontSheet'
import { paginateBlCargo } from '../../lib/pdf/paginateBl'
import type { BlSnapshot } from '../../lib/pdf/blSnapshot'

/**
 * Signed and Surrender stamp, the two PIN-gated actions.
 *
 * The signature and stamp images are never sent to the browser -- the
 * `company-assets` bucket has no select policy, so this component cannot
 * fetch them even on behalf of an admin. It renders the unsigned PDF, hands
 * it to the sign-document Edge Function with a PIN, and receives back a PDF
 * with the artwork already composited. The PIN is posted and never stored.
 *
 * Every refusal here is a convenience, not the control: the function repeats
 * the admin check and the PIN check server-side, so calling the endpoint
 * directly gains nothing.
 */
export function SigningPanel({
  snapshot,
  blNumber,
  blType,
  bookingId,
  isAdmin,
}: {
  snapshot: BlSnapshot
  blNumber: string
  blType: string
  bookingId: string
  isAdmin: boolean
}) {
  const [hasPin, setHasPin] = useState<boolean | null>(null)
  const [lockedUntil, setLockedUntil] = useState<string | null>(null)
  const [mode, setMode] = useState<'idle' | 'signed' | 'surrender' | 'setpin'>('idle')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // The signed PDF is shown before it is saved. Downloading straight out of
  // the PIN prompt gave nobody a chance to check the stamp landed correctly
  // -- on a document that carries legal weight, that is the wrong default.
  const [signed, setSigned] = useState<{ url: string; fileName: string } | null>(null)

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error: err } = await supabase.functions.invoke('sign-document', { body })
    if (err) {
      // Edge function errors carry the real message in the response body.
      let message = err.message
      try {
        const ctx = (err as { context?: Response }).context
        if (ctx) message = (await ctx.json()).error ?? message
      } catch {
        /* keep the generic message */
      }
      throw new Error(message)
    }
    return data as Record<string, unknown>
  }, [])

  const refreshStatus = useCallback(async () => {
    if (!isAdmin) return
    try {
      const data = await invoke({ action: 'pin_status' })
      setHasPin(Boolean(data.hasPin))
      setLockedUntil((data.lockedUntil as string) ?? null)
    } catch {
      setHasPin(null)
    }
  }, [invoke, isAdmin])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  if (!isAdmin) return null

  const canSign = blType !== 'Draft'
  const canSurrender = blType === 'Surrender'
  const locked = lockedUntil ? new Date(lockedUntil) > new Date() : false

  const handleSetPin = async () => {
    setBusy(true)
    setError(null)
    try {
      await invoke({ action: 'set_pin', pin })
      setNote('Signing PIN set.')
      setMode('idle')
      setPin('')
      refreshStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not set PIN')
    }
    setBusy(false)
  }

  const handleSign = async (option: 'signed' | 'surrender') => {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      // Render the unsigned document, then let the server composite onto it.
      const blob = await pdf(<BlDocument snapshot={snapshot} />).toBlob()
      const base64 = await blobToBase64(blob)
      const { totalFrontSheets } = paginateBlCargo(snapshot)

      const data = await invoke({
        action: 'sign',
        option,
        pin,
        pdf: base64,
        scan: snapshot.printMode === 'Scan',
        // The backside is the last page and must never carry artwork.
        frontSheets: totalFrontSheets,
        blNumber,
        bookingId,
      })

      const fileName =
        blNumber + (option === 'surrender' ? '_SURRENDER_STAMP' : '_SIGNED') + '.pdf'
      if (signed) URL.revokeObjectURL(signed.url)
      setSigned({ url: base64ToBlobUrl(data.pdf as string), fileName })
      setNote(
        option === 'surrender'
          ? 'Surrender stamp applied — check it below, then download.'
          : 'Signed — check it below, then download.',
      )
      setMode('idle')
      setPin('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signing failed')
      refreshStatus()
    }
    setBusy(false)
  }

  return (
    <div className="space-y-2 rounded border border-line p-3">
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-muted">
        <KeyRound size={13} /> Admin only — PIN required
      </p>

      {hasPin === false && mode !== 'setpin' && (
        <p className="text-sm text-muted">
          You have no signing PIN yet. Set one to use Signed or the Surrender
          stamp — it is personal to you, so the audit trail records who signed.
        </p>
      )}

      {locked && (
        <p className="text-sm text-red-600">
          Locked after repeated failed attempts until{' '}
          {new Date(lockedUntil!).toLocaleTimeString()}.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {hasPin === false ? (
          <Button size="sm" variant="ghost" onClick={() => setMode('setpin')} disabled={busy}>
            Set signing PIN
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMode('signed')}
              disabled={!canSign || busy || locked}
              title={canSign ? undefined : 'A Draft BL cannot be signed'}
            >
              <PenLine size={14} /> Signed
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMode('surrender')}
              disabled={!canSurrender || busy || locked}
              title={canSurrender ? undefined : 'Only a Surrender BL can carry the surrender stamp'}
            >
              <Stamp size={14} /> Surrender stamp
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('setpin')} disabled={busy}>
              Change PIN
            </Button>
          </>
        )}
      </div>

      {mode !== 'idle' && (
        <div className="flex flex-wrap items-center gap-2">
          <TextInput
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder={mode === 'setpin' ? 'New PIN (4–12 digits)' : 'Signing PIN'}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="max-w-[12rem]"
          />
          <Button
            size="sm"
            disabled={busy || pin.length < 4}
            onClick={() =>
              mode === 'setpin' ? handleSetPin() : handleSign(mode as 'signed' | 'surrender')
            }
          >
            {busy ? 'Working…' : mode === 'setpin' ? 'Save PIN' : 'Confirm'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setMode('idle')
              setPin('')
              setError(null)
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {note && <p className="text-sm text-emerald-700">{note}</p>}

      {signed && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted">
              Signed preview — {signed.fileName}
            </span>
            <Button
              size="sm"
              className="ml-auto"
              onClick={() => saveUrl(signed.url, signed.fileName)}
            >
              <Download size={14} /> Download
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                URL.revokeObjectURL(signed.url)
                setSigned(null)
                setNote(null)
              }}
            >
              Close preview
            </Button>
          </div>
          <iframe
            title="Signed document preview"
            src={signed.url}
            className="h-[70vh] w-full rounded border border-line"
          />
        </div>
      )}
    </div>
  )
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function base64ToBlobUrl(base64: string): string {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
}

function saveUrl(url: string, fileName: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
}
