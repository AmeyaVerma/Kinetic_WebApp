import { useState } from 'react'
import { Ban, AlertTriangle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Field'

/**
 * Stopping a booking, with the confirmation it never had.
 *
 * Void used to fire the moment it was clicked, from anyone, with the reason
 * hard-coded to "Ops request" — so the record said a booking had been stopped
 * and nothing about why (spec F5).
 *
 * Cancel and Void are offered as separate choices because they are separate
 * events: a cancelled booking was real and was called off; a void one should
 * never have existed. The spec's numbering rule depends on the difference —
 * a void is meant to leave a visible gap in the series.
 */

export type StopKind = 'cancel' | 'void'

const COPY: Record<StopKind, { title: string; verb: string; blurb: string; placeholder: string }> = {
  cancel: {
    title: 'Cancel this booking',
    verb: 'Cancel booking',
    blurb:
      'The booking was real and is being called off. It keeps its number and stays in the records as a cancelled booking.',
    placeholder: 'e.g. Customer withdrew the shipment, cargo not ready',
  },
  void: {
    title: 'Void this booking',
    verb: 'Void booking',
    blurb:
      'The booking should never have existed — a mis-key or a duplicate. Its number is not reused, so the series will show a gap here.',
    placeholder: 'e.g. Duplicate of KLNVO2627000028, entered twice',
  },
}

export function StopBookingDialog({
  open,
  kind,
  reference,
  onClose,
  onConfirm,
}: {
  open: boolean
  kind: StopKind
  reference: string
  onClose: () => void
  /** Returns an error message to show, or null when it succeeded. */
  onConfirm: (reason: string) => string | null
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const copy = COPY[kind]
  const tooShort = reason.trim().length < 3

  const close = () => {
    setReason('')
    setError(null)
    onClose()
  }

  const confirm = () => {
    const message = onConfirm(reason.trim())
    if (message) {
      setError(message)
      return
    }
    close()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={copy.title}
      subtitle={reference}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Keep the booking
          </Button>
          <Button
            onClick={confirm}
            disabled={tooShort}
            className="bg-accent-coral text-white hover:opacity-90 disabled:opacity-50"
          >
            <Ban size={14} /> {copy.verb}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-btn border border-[#FDE68A] bg-[#FEF3C7]/50 px-3 py-2.5">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#B45309]" />
          <p className="text-xs text-[#B45309]">{copy.blurb}</p>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Reason <span className="font-normal normal-case tracking-normal">(recorded against the booking)</span>
          </span>
          <Textarea
            autoFocus
            rows={3}
            value={reason}
            placeholder={copy.placeholder}
            onChange={(e) => {
              setReason(e.target.value)
              setError(null)
            }}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
