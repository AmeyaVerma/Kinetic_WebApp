/**
 * Every static string printed on the BL front sheet, transcribed from
 * 01_BL_Blank_format.pdf.
 *
 * Kept in one file (brief section 9) so a wording correction is a one-line
 * change rather than a hunt through layout code. Nothing here may be
 * "tidied" without Siddharth's approval -- this is a transport document and
 * the clause wording is the legal text, including its existing quirks.
 */

export const BL_STRINGS = {
  title: 'MULTI-MODAL TRANSPORT DOCUMENT',

  labels: {
    consignor: 'Consignor (SHIPPER/EXPORTER)',
    consignee: 'Consignee (or order)',
    notify: 'Notify Address',
    mtdNumber: 'MTD Number',
    shipmentRef: 'Shipment Reference No.',
    preCarriage: 'Pre-Carriage by',
    portOfReceipt: 'Port of Receipt',
    deliveryAgent: 'Delivery Agent',
    oceanVessel: 'Ocean Vessel',
    voyNo: 'Voy No.',
    portOfLoading: 'Port of Loading',
    portOfDischarge: 'Port of Discharge',
    finalPort: 'Final Port of Delivery',
    modeOfTransport: 'Mode / Means of Transport',
    route: 'Route / Place of Transshipment',
    marksCol: 'Marks and Numbers,\nContainers, Pkgs',
    descriptionCol:
      'Marks and Numbers, Number of Packages, Kinds of Packages,\nGeneral Description of goods (said to contain)',
    grossWeight: 'Gross Weight\nKgs.',
    measurement: 'Measurement\nM3',
    freightTerms: 'Freight Terms',
    freightPayableAt: 'Freight Payable at',
    numberOfOriginals: 'Number of Original MTD(s)',
    placeAndDate: 'Place and Date of issue',
    otherParticulars: 'Other Particulars (if any)',
    authorisedSignatory: 'Authorised Signatory',
  },

  /** The two clause paragraphs in the right-hand block, under the MTO line. */
  clauseTakenInCharge:
    'Taken in charge in apparently good condition herein at the place of receipt for transport and delivery as mentioned above, unless otherwise stated. The MTD in accordance with the provisions contained in the MTD undertakes to perform or to procure the performance of the multimodal transport from the place at which the goods are taken in charge, to the place designated for delivery and assumes responsibility for such transport.',

  clauseSurrender:
    'One of the MTD(s) must be surrendered, duly endorsed in exchange for the goods. In witness where of the original MTD all of this tenure and date have been signed in the number indicated below one of which being accomplished the other(s) to be void.',

  particularsFurnished: 'Particulars above furnished by shipper/consignor',
  weightNotIncluded: 'Weight and measurement of container not to be included',
  termsContinued: '(TERMS CONTINUED ON BACK HEREOF)',
  asAgent: 'As Agent,',

  /** Printed in the container column when the attach sheet is used. */
  asPerAttachedSheet: 'AS PER ATTACHED CONTAINER SHEET',

  /** Foot of the description area on every sheet except the last. */
  continuedOnNextPage: 'Continued on next page',

  /** Consignee line when the BL is made out to order. */
  toOrder: 'TO ORDER',
} as const

/**
 * The red typewriter-style label at the top right. One per BL type -- the
 * styling is identical for all five, only the words change.
 */
export const BL_TYPE_LABEL = {
  Draft: 'DRAFT BL',
  Original: 'ORIGINAL BL',
  Surrender: 'SURRENDER BL',
  Seaway: 'SEAWAY BL',
  RFS: 'RFS BL',
} as const

export type BlType = keyof typeof BL_TYPE_LABEL

/**
 * Number of Original MTD(s). Prints 3 only for a colour Original; every
 * other combination -- including Original in Scan Copy mode -- leaves the
 * box blank. Scan Copy is a photocopy of an original, so stating a count on
 * it would misrepresent how many originals exist.
 */
export function numberOfOriginals(
  blType: BlType,
  printMode: 'Original' | 'Scan',
): string {
  return blType === 'Original' && printMode === 'Original' ? '3' : ''
}

/** The backside terms page is appended to every type except Draft. */
export function printsBackside(blType: BlType): boolean {
  return blType !== 'Draft'
}
