import type { Booking } from './types'

/**
 * The booking fields that exist solely so the six generated documents have
 * somewhere to read from.
 *
 * Siddharth's rule: a document never holds its own copy of a value. If a
 * document needs something the booking cannot supply, the field is added to
 * the booking — in the section it belongs to — and the user fills it in
 * there. This file is the single list of those fields: their column names,
 * their labels, where they appear on the booking screen, and which documents
 * depend on each one.
 *
 * Keeping `section` here rather than hard-coding fields into each tab means
 * adding a field for a future document is a one-line change in one place.
 */

export type BookingDocumentField =
  | 'preCarriageBy'
  | 'freightPayableAt'
  | 'measurementM3'
  | 'otherParticulars'
  | 'cargoDescription'
  | 'customerReference'
  | 'shippingLine'
  | 'shipmentType'
  | 'shipmentTerms'
  | 'cfs'
  | 'netWeightKg'
  | 'shippedOnBoard'
  | 'hblDate'
  | 'mblDate'
  | 'igmNo'
  | 'igmDate'
  | 'itemNumber'
  | 'arrivalDate'
  | 'chaId'
  | 'destuffingType'
  | 'placeOfSurvey'
  | 'doNumber'
  | 'doTo'
  | 'doValidUpto'
  | 'doType'
  | 'returnDepotId'
  | 'croValidTill'
  | 'sbNumber'
  | 'sbDate'
  | 'depotId'
  | 'surveyorRefId'

export const BOOKING_DOCUMENT_COLUMNS: Record<BookingDocumentField, string> = {
  preCarriageBy: 'pre_carriage_by',
  freightPayableAt: 'freight_payable_at',
  measurementM3: 'measurement_m3',
  otherParticulars: 'other_particulars',
  cargoDescription: 'cargo_description',
  customerReference: 'customer_reference',
  shippingLine: 'shipping_line',
  shipmentType: 'shipment_type',
  shipmentTerms: 'shipment_terms',
  cfs: 'cfs',
  netWeightKg: 'net_weight_kg',
  shippedOnBoard: 'shipped_on_board',
  hblDate: 'hbl_date',
  mblDate: 'mbl_date',
  igmNo: 'igm_no',
  igmDate: 'igm_date',
  itemNumber: 'item_number',
  arrivalDate: 'arrival_date',
  chaId: 'cha_id',
  destuffingType: 'destuffing_type',
  placeOfSurvey: 'place_of_survey',
  doNumber: 'do_number',
  doTo: 'do_to',
  doValidUpto: 'do_valid_upto',
  doType: 'do_type',
  returnDepotId: 'return_depot_id',
  croValidTill: 'cro_valid_till',
  sbNumber: 'sb_number',
  sbDate: 'sb_date',
  depotId: 'depot_id',
  surveyorRefId: 'surveyor_ref_id',
}

/** Which booking tab each field belongs to. */
export type BookingSection = 'shipment' | 'product' | 'agents' | 'container'

export type FieldWidget = 'text' | 'date' | 'number' | 'textarea' | 'select' | 'depot' | 'surveyor' | 'cha'

export interface BookingDocumentFieldSpec {
  key: BookingDocumentField
  label: string
  section: BookingSection
  widget: FieldWidget
  /** Which documents stop being complete without it. Shown as a hint. */
  usedBy: string
  /** Only shown for this direction, where the field is direction-specific. */
  only?: 'Export' | 'Import'
  options?: string[]
}

export const BOOKING_DOCUMENT_FIELDS: BookingDocumentFieldSpec[] = [
  // Shipment details ------------------------------------------------------
  { key: 'customerReference', label: "Customer's booking reference", section: 'shipment', widget: 'text', usedBy: 'Onboard, CAN' },
  { key: 'shippingLine', label: 'Shipping line', section: 'shipment', widget: 'text', usedBy: 'CAN' },
  { key: 'shipmentType', label: 'Shipment type', section: 'shipment', widget: 'select', options: ['FCL', 'LCL'], usedBy: 'CAN, Delivery Order' },
  { key: 'shipmentTerms', label: 'Shipment terms', section: 'shipment', widget: 'text', usedBy: 'Onboard, CAN' },
  { key: 'cfs', label: 'CFS', section: 'shipment', widget: 'text', usedBy: 'Onboard, CAN' },
  { key: 'preCarriageBy', label: 'Pre-carriage by', section: 'shipment', widget: 'text', usedBy: 'BL' },
  { key: 'freightPayableAt', label: 'Freight payable at', section: 'shipment', widget: 'text', usedBy: 'BL' },
  { key: 'shippedOnBoard', label: 'Shipped on board (SOB)', section: 'shipment', widget: 'date', usedBy: 'Onboard', only: 'Export' },
  { key: 'sbNumber', label: 'Shipping bill number', section: 'shipment', widget: 'text', usedBy: 'Onboard', only: 'Export' },
  { key: 'sbDate', label: 'Shipping bill date', section: 'shipment', widget: 'date', usedBy: 'Onboard', only: 'Export' },
  { key: 'hblDate', label: 'HBL date', section: 'shipment', widget: 'date', usedBy: 'Onboard' },
  { key: 'mblDate', label: 'MBL date', section: 'shipment', widget: 'date', usedBy: 'Onboard' },
  { key: 'igmNo', label: 'IGM number', section: 'shipment', widget: 'text', usedBy: 'CAN, Delivery Order', only: 'Import' },
  { key: 'igmDate', label: 'IGM date', section: 'shipment', widget: 'date', usedBy: 'CAN, Delivery Order', only: 'Import' },
  { key: 'itemNumber', label: 'Item number', section: 'shipment', widget: 'text', usedBy: 'CAN, Delivery Order', only: 'Import' },
  { key: 'arrivalDate', label: 'Arrival date', section: 'shipment', widget: 'date', usedBy: 'Delivery Order', only: 'Import' },
  { key: 'placeOfSurvey', label: 'Place of survey', section: 'shipment', widget: 'text', usedBy: 'Delivery Order', only: 'Import' },
  { key: 'destuffingType', label: 'Destuffing type', section: 'shipment', widget: 'select', options: ['Destuff', 'Direct'], usedBy: 'Delivery Order', only: 'Import' },
  { key: 'doNumber', label: 'DO number', section: 'shipment', widget: 'text', usedBy: 'Delivery Order', only: 'Import' },
  { key: 'doTo', label: 'DO addressed to', section: 'shipment', widget: 'text', usedBy: 'Delivery Order', only: 'Import' },
  { key: 'doValidUpto', label: 'DO valid upto', section: 'shipment', widget: 'date', usedBy: 'Delivery Order', only: 'Import' },
  { key: 'doType', label: 'D/O type', section: 'shipment', widget: 'text', usedBy: 'Off Loading Letter', only: 'Import' },
  { key: 'croValidTill', label: 'CRO valid till', section: 'shipment', widget: 'date', usedBy: 'CRO', only: 'Export' },

  // Parties ---------------------------------------------------------------
  { key: 'depotId', label: 'Empty depot / CY', section: 'agents', widget: 'depot', usedBy: 'CRO, Off Loading Letter' },
  { key: 'returnDepotId', label: 'Return empty depot', section: 'agents', widget: 'depot', usedBy: 'Delivery Order', only: 'Import' },
  { key: 'surveyorRefId', label: 'Surveyor', section: 'agents', widget: 'surveyor', usedBy: 'CRO' },
  { key: 'chaId', label: 'CHA', section: 'agents', widget: 'cha', usedBy: 'Delivery Order, Off Loading Letter', only: 'Import' },

  // Product info ----------------------------------------------------------
  { key: 'cargoDescription', label: 'Cargo description (printed on the BL)', section: 'product', widget: 'textarea', usedBy: 'BL' },
  { key: 'netWeightKg', label: 'Net weight (kgs)', section: 'product', widget: 'number', usedBy: 'Onboard, CAN' },
  { key: 'measurementM3', label: 'Measurement (M3)', section: 'product', widget: 'number', usedBy: 'BL' },
  { key: 'otherParticulars', label: 'Other particulars', section: 'product', widget: 'textarea', usedBy: 'BL' },
]

export const BOOKING_DOCUMENT_LABELS = Object.fromEntries(
  BOOKING_DOCUMENT_FIELDS.map((f) => [f.key, f.label]),
) as Record<BookingDocumentField, string>

/**
 * Fields for one section, filtered by direction so an export booking is not
 * asked for an IGM number and an import is not asked for a shipping bill.
 */
export function fieldsForSection(
  section: BookingSection,
  direction: Booking['direction'],
): BookingDocumentFieldSpec[] {
  return BOOKING_DOCUMENT_FIELDS.filter(
    (f) => f.section === section && (!f.only || f.only === direction),
  )
}
