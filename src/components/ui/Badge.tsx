/**
 * A status badge that shows the word the record actually uses.
 *
 * Every module used to reuse the shipment badge, mapping its own statuses
 * onto shipment words to borrow the colour. An Active employee came out as
 * "Delivered", a suspended user as "Cancelled" and an on-hire container as
 * "In Transit". The colour was right; the word was somebody else's.
 *
 * So a module now picks a tone and supplies its own label. The tones stay
 * shared, which is what kept the colours consistent in the first place.
 */

export type BadgeTone =
  /** Live, healthy, in good standing. */
  | 'success'
  /** Finished successfully. */
  | 'done'
  /** Moving, in progress. */
  | 'info'
  /** Being worked on, needs attention soon. */
  | 'warn'
  /** Waiting on someone. */
  | 'attention'
  /** Stopped, rejected, cancelled. */
  | 'danger'
  /** Late — worse than danger. */
  | 'critical'
  /** Not started, inactive, nothing to say. */
  | 'neutral'

const TONE_STYLES: Record<BadgeTone, { bg: string; text: string }> = {
  success: { bg: '#DCFCE7', text: '#15803D' },
  done: { bg: '#ECFDF5', text: '#047857' },
  info: { bg: '#DBEAFE', text: '#1D4ED8' },
  warn: { bg: '#FEF3C7', text: '#B45309' },
  attention: { bg: '#FFF7ED', text: '#EA580C' },
  danger: { bg: '#FEE2E2', text: '#DC2626' },
  critical: { bg: '#FECACA', text: '#B91C1C' },
  neutral: { bg: '#F3F4F6', text: '#6B7280' },
}

export function Badge({ tone, label }: { tone: BadgeTone; label: string }) {
  const s = TONE_STYLES[tone] ?? TONE_STYLES.neutral
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-badge px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {label}
    </span>
  )
}
