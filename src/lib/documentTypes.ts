/**
 * The documents a customer can ask for, keyed as the Document fees master keys
 * them. One list, so the portal form, the portal tracker and the staff queue
 * all name a document the same way.
 */
export const DOC_TYPES: { key: string; label: string }[] = [
  { key: 'obl_original', label: 'OBL original copy' },
  { key: 'obl_scan', label: 'OBL scan copy' },
  { key: 'surrender', label: 'Surrender BL' },
  { key: 'onboard', label: 'Onboard Confirmation' },
  { key: 'cro', label: 'Container Release Order' },
  { key: 'do', label: 'Delivery Order' },
  { key: 'can', label: 'Cargo Arrival Notice' },
  { key: 'offloading', label: 'Off Loading Letter' },
  { key: 'other', label: 'Other document' },
]

export const DOC_LABEL: Record<string, string> = Object.fromEntries(DOC_TYPES.map((d) => [d.key, d.label]))
