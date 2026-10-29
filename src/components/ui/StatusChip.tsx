import type { ChipStatus } from '../../lib/types'
import { Badge, type BadgeTone } from './Badge'

/* The shipment vocabulary and its tones. Other entities have their own
   words and map them to the same tones through Badge — they no longer
   borrow a shipment status to get a colour. */
const CHIP_TONES: Record<ChipStatus, BadgeTone> = {
  Booked: 'success',
  'In Transit': 'info',
  Documentation: 'warn',
  Delivered: 'done',
  Arrived: 'success',
  Cancelled: 'danger',
  Draft: 'neutral',
  'BL Draft': 'danger',
  Pending: 'attention',
  Overdue: 'critical',
}

export function StatusChip({ status }: { status: ChipStatus }) {
  return <Badge tone={CHIP_TONES[status] ?? 'neutral'} label={status} />
}
