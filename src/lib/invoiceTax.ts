/**
 * How an invoice line is taxed.
 *
 * Nothing here is invented: it is read off the company's own two invoices in
 * Kinetic_Docs, which answered several of the questions the specification's
 * accountant section was still waiting on.
 *
 *   NITCO 4X20 OCEAN FREIGHT (RKS)  -- SAC 996521, IGST at 5%, because the
 *     customer is in Dadra & Nagar Haveli (state code 26) and RKS is in
 *     Maharashtra (27). Different states, so IGST.
 *   MUNDRA OIL 12X20 (Kinetic)      -- SAC 996711, the whole amount in the
 *     NON-TAXABLE column, taxable column empty, under LUT AD271025013720M.
 *
 * What is NOT settled, and is therefore not guessed at here: TDS on vendor
 * bills, e-invoicing thresholds, and credit-note rules. Those still need the
 * accountant.
 */

export type TaxTreatment = 'IGST' | 'CGST_SGST' | 'ZERO_RATED_LUT' | 'EXEMPT' | 'NON_GST'

/** GST state code of the company raising the invoice. Both are Maharashtra. */
export const HOME_STATE_CODE = '27'

/** SAC codes seen on the real invoices. Not a complete list — the full charge
    code master with a SAC per code is still owed by Siddharth. */
export const KNOWN_SAC: Record<string, { sac: string; label: string; gstRate: number }> = {
  OFR: { sac: '996521', label: 'Ocean freight', gstRate: 5 },
  WASH: { sac: '996711', label: 'Container cleaning / steam wash', gstRate: 18 },
}

/**
 * Which tax applies, from the place of supply.
 *
 * An export of services under a Letter of Undertaking is zero-rated: the
 * amount is still shown, but in the non-taxable column, which is how Kinetic's
 * own invoice does it. Without an LUT the same supply would carry IGST, so the
 * LUT number is what makes the difference and is recorded on the invoice.
 */
export function treatmentFor(opts: {
  customerStateCode: string | null | undefined
  isExport: boolean
  lutNumber: string | null | undefined
}): TaxTreatment {
  const { customerStateCode, isExport, lutNumber } = opts
  if (isExport) {
    return lutNumber && lutNumber.trim() ? 'ZERO_RATED_LUT' : 'IGST'
  }
  if (!customerStateCode) return 'IGST'
  return customerStateCode.trim() === HOME_STATE_CODE ? 'CGST_SGST' : 'IGST'
}

export interface LineInput {
  particulars: string
  sacCode?: string | null
  qty: number
  uom?: string | null
  rate: number
  currency: string
  /** The EX RT column: what one unit of `currency` is worth in rupees. */
  exRate: number
  /** Combined GST rate for the line, e.g. 5 or 18. */
  gstRate: number
}

export interface ComputedLine extends LineInput {
  lineNo: number
  nonTaxableAmount: number
  taxableAmount: number
  igstRate: number
  igstAmount: number
  cgstRate: number
  cgstAmount: number
  sgstRate: number
  sgstAmount: number
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * One line, in rupees.
 *
 * Their invoices quote a rate in the deal's currency and carry the exchange
 * rate on the face of the document, so the INR figure can always be checked
 * against what was agreed. That is why the rate is multiplied here rather
 * than looked up: an invoice issued last month must not silently re-price
 * when today's rate moves.
 */
export function computeLine(line: LineInput, treatment: TaxTreatment, index: number): ComputedLine {
  const gross = round2(line.qty * line.rate * line.exRate)

  const zero = {
    igstRate: 0, igstAmount: 0, cgstRate: 0, cgstAmount: 0, sgstRate: 0, sgstAmount: 0,
  }

  if (treatment === 'ZERO_RATED_LUT' || treatment === 'EXEMPT' || treatment === 'NON_GST') {
    // Shown, but in the non-taxable column — this is what zero-rated means.
    return { ...line, lineNo: index + 1, nonTaxableAmount: gross, taxableAmount: 0, ...zero }
  }

  if (treatment === 'CGST_SGST') {
    const half = round2((gross * line.gstRate) / 200)
    return {
      ...line, lineNo: index + 1, nonTaxableAmount: 0, taxableAmount: gross,
      igstRate: 0, igstAmount: 0,
      cgstRate: line.gstRate / 2, cgstAmount: half,
      sgstRate: line.gstRate / 2, sgstAmount: half,
    }
  }

  return {
    ...line, lineNo: index + 1, nonTaxableAmount: 0, taxableAmount: gross,
    igstRate: line.gstRate, igstAmount: round2((gross * line.gstRate) / 100),
    cgstRate: 0, cgstAmount: 0, sgstRate: 0, sgstAmount: 0,
  }
}

export interface InvoiceTotals {
  subtotal: number
  taxTotal: number
  roundOff: number
  totalInr: number
}

/** Totals, with the explicit R/off line their invoices carry. */
export function totalsFor(lines: ComputedLine[]): InvoiceTotals {
  const subtotal = round2(lines.reduce((a, l) => a + l.nonTaxableAmount + l.taxableAmount, 0))
  const taxTotal = round2(
    lines.reduce((a, l) => a + l.igstAmount + l.cgstAmount + l.sgstAmount, 0),
  )
  const raw = round2(subtotal + taxTotal)
  const totalInr = Math.round(raw)
  return { subtotal, taxTotal, roundOff: round2(totalInr - raw), totalInr }
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function underThousand(n: number): string {
  if (n === 0) return ''
  if (n < 20) return ONES[n]
  if (n < 100) return (TENS[Math.floor(n / 10)] + ' ' + ONES[n % 10]).trim()
  return (ONES[Math.floor(n / 100)] + ' Hundred ' + underThousand(n % 100)).trim()
}

/**
 * "INR FOUR LAKH FIFTY-FOUR THOUSAND FOUR HUNDRED THIRTY-FIVE ONLY".
 *
 * Indian grouping — lakh and crore, not million — because that is what their
 * invoices print and what the reader expects.
 */
export function amountInWords(total: number): string {
  const n = Math.round(total)
  if (n === 0) return 'INR ZERO ONLY'

  const crore = Math.floor(n / 10000000)
  const lakh = Math.floor((n % 10000000) / 100000)
  const thousand = Math.floor((n % 100000) / 1000)
  const rest = n % 1000

  const parts = [
    crore ? `${underThousand(crore)} Crore` : '',
    lakh ? `${underThousand(lakh)} Lakh` : '',
    thousand ? `${underThousand(thousand)} Thousand` : '',
    underThousand(rest),
  ].filter(Boolean)

  return `INR ${parts.join(' ').replace(/\s+/g, ' ').trim()} ONLY`.toUpperCase()
}
