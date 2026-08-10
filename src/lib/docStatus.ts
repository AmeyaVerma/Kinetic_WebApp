import type { BlLifecycle, BlState } from './types'

export type DocStatus = 'Draft' | 'Sent' | 'Approved' | 'Released'

const LIFECYCLE_TO_DOC_STATUS: Record<BlLifecycle, DocStatus> = {
  Draft: 'Draft',
  Edited: 'Draft',
  'Awaiting approval': 'Sent',
  Approved: 'Approved',
  Released: 'Released',
}

/** BL documentation status for a booking, derived from its BlState.
    No BlState row yet means no draft has been created — 'Draft'. */
export function docStatusOf(bl: BlState | undefined): DocStatus {
  if (!bl) return 'Draft'
  return LIFECYCLE_TO_DOC_STATUS[bl.lifecycle]
}
