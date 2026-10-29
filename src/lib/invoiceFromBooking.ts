import { supabase } from './supabaseClient'
import {
  amountInWords,
  computeLine,
  totalsFor,
  treatmentFor,
  KNOWN_SAC,
  type ComputedLine,
  type LineInput,
  type TaxTreatment,
} from './invoiceTax'

/**
 * Raising a real invoice from a booking.
 *
 * The old Generate invoice built an object in browser memory with a number
 * made from the length of an array, no tax fields and no persistence — it was
 * gone on refresh. This writes a real row, with a number allocated by the
 * database so two people cannot be given the same one.
 *
 * The shape follows the company's own invoices (see the two in Kinetic_Docs),
 * so a generated one is recognisable beside a real one.
 *
 * Deliberately NOT done here, because Siddharth has said the accounts rules
 * are still changing: TDS on vendor bills, e-invoicing, credit notes, and
 * posting to a ledger. The invoice records what was billed; what the business
 * then does with it is for when those rules are settled.
 */

export interface CompanyInvoiceIdentity {
  legalName: string
  corporateAddress: string | null
  gstAddress: string | null
  tel: string | null
  email: string | null
  website: string | null
  gstin: string | null
  pan: string | null
  cin: string | null
  lutNumber: string | null
  stateCode: string | null
  bankName: string | null
  bankAccount: string | null
  bankIfsc: string | null
  invoiceSeries: string | null
}

export interface InvoiceDraftLine {
  particulars: string
  /** Charge code, used to look up a SAC where one is known. */
  code?: string | null
  qty: number
  uom?: string | null
  rate: number
  currency: string
  exRate: number
  gstRate?: number
  chargeLineId?: string | null
}

export interface RaiseInvoiceInput {
  bookingId?: string | null
  ffShipmentId?: string | null
  type: 'AR' | 'AP'
  docKind?: 'Proforma' | 'Tax Invoice' | 'Credit Note' | 'Vendor Bill'
  company: CompanyInvoiceIdentity
  party: {
    id?: string | null
    name: string
    address?: string | null
    gstin?: string | null
    state?: string | null
  }
  /** An export of services: zero-rated when the company holds an LUT. */
  isExport: boolean
  lines: InvoiceDraftLine[]
  createdBy: string
}

/**
 * The first two digits of a GSTIN are the state code — which is what decides
 * IGST against CGST + SGST. Their NITCO invoice prints exactly this: GSTIN
 * 26AAACN1674N1Z6, "STATE CODE: 26", and IGST because the company is 27.
 */
export function stateCodeFromGstin(gstin: string | null | undefined): string | null {
  if (!gstin) return null
  const trimmed = gstin.trim()
  return /^\d{2}/.test(trimmed) ? trimmed.slice(0, 2) : null
}

export interface RaisedInvoice {
  id: string
  invoiceNo: string
  totalInr: number
  treatment: TaxTreatment
  lines: ComputedLine[]
}

export async function raiseInvoice(input: RaiseInvoiceInput): Promise<
  { ok: true; invoice: RaisedInvoice } | { ok: false; error: string }
> {
  const { company, party, lines, type } = input

  if (lines.length === 0) return { ok: false, error: 'An invoice needs at least one line.' }
  const series = company.invoiceSeries?.trim()
  if (!series) {
    return { ok: false, error: 'This company has no invoice series set in Company settings.' }
  }

  const customerStateCode = stateCodeFromGstin(party.gstin)
  const treatment = treatmentFor({
    customerStateCode,
    isExport: input.isExport,
    lutNumber: company.lutNumber,
  })

  const computed = lines.map((l, i) =>
    computeLine(
      {
        particulars: l.particulars,
        sacCode: l.code ? (KNOWN_SAC[l.code]?.sac ?? null) : null,
        qty: l.qty,
        uom: l.uom ?? null,
        rate: l.rate,
        currency: l.currency,
        exRate: l.exRate,
        gstRate: l.gstRate ?? (l.code ? (KNOWN_SAC[l.code]?.gstRate ?? 0) : 0),
      } as LineInput,
      treatment,
      i,
    ),
  )
  const totals = totalsFor(computed)

  // The number comes from the server, never from here: it is allocated inside
  // a transaction against document_sequences, so two people drafting at the
  // same moment cannot be handed the same one.
  const { data: allocated, error: numberError } = await supabase.rpc('allocate_invoice_number', {
    p_series: series,
  })
  if (numberError) return { ok: false, error: numberError.message }
  const allocation = (Array.isArray(allocated) ? allocated[0] : allocated) as
    | { seq: number; invoice_no: string }
    | undefined
  if (!allocation) return { ok: false, error: 'Could not allocate an invoice number.' }

  const { data: header, error: headerError } = await supabase
    .from('invoices')
    .insert({
      invoice_no: allocation.invoice_no,
      series,
      seq: allocation.seq,
      type,
      doc_kind: input.docKind ?? 'Proforma',
      status: 'Draft',
      booking_id: input.bookingId ?? null,
      ff_shipment_id: input.ffShipmentId ?? null,
      party_id: party.id ?? null,
      party_name: party.name,
      party_address: party.address ?? null,
      party_gstin: party.gstin ?? null,
      party_state: party.state ?? null,
      party_state_code: customerStateCode,
      currency: lines[0]?.currency ?? 'INR',
      fx_rate: lines[0]?.exRate ?? 1,
      place_of_supply: party.state ?? null,
      place_of_supply_code: customerStateCode,
      tax_treatment: treatment,
      lut_number: treatment === 'ZERO_RATED_LUT' ? company.lutNumber : null,
      subtotal: totals.subtotal,
      tax_total: totals.taxTotal,
      round_off: totals.roundOff,
      total_inr: totals.totalInr,
      amount_in_words: amountInWords(totals.totalInr),
      created_by: input.createdBy,
    })
    .select('id, invoice_no')
    .single()

  if (headerError || !header) {
    // The number is spent either way. The spec's numbering rule expects a
    // visible gap rather than reuse, so it is not handed back.
    return { ok: false, error: headerError?.message ?? 'Could not save the invoice.' }
  }

  const { error: lineError } = await supabase.from('invoice_lines').insert(
    computed.map((l, i) => ({
      invoice_id: header.id as string,
      line_no: l.lineNo,
      particulars: l.particulars,
      sac_code: l.sacCode ?? null,
      qty: l.qty,
      uom: l.uom ?? null,
      rate: l.rate,
      currency: l.currency,
      ex_rate: l.exRate,
      non_taxable_amount: l.nonTaxableAmount,
      taxable_amount: l.taxableAmount,
      igst_rate: l.igstRate,
      igst_amount: l.igstAmount,
      cgst_rate: l.cgstRate,
      cgst_amount: l.cgstAmount,
      sgst_rate: l.sgstRate,
      sgst_amount: l.sgstAmount,
      charge_line_id: lines[i]?.chargeLineId ?? null,
    })),
  )
  if (lineError) return { ok: false, error: lineError.message }

  return {
    ok: true,
    invoice: {
      id: header.id as string,
      invoiceNo: header.invoice_no as string,
      totalInr: totals.totalInr,
      treatment,
      lines: computed,
    },
  }
}
