import type { BlSnapshot } from './blSnapshot'

/**
 * Splits a BL's cargo block across however many front sheets it needs.
 *
 * Why this is computed rather than left to the renderer: the BL is a
 * fixed-frame form. Continuation sheets repeat the whole header block
 * (consignor, consignee, notify, ports, vessel, voyage) and carry on in the
 * description area, which react-pdf's automatic flow cannot do -- it would
 * break mid-frame and leave the second sheet without a form.
 *
 * Computing it also gives a correct Y before rendering. The renderer's own
 * totalPages counts every page in the PDF, which would include the backside
 * and report "Page 1 of 3" on a two-sheet BL. Page X of Y counts FRONT
 * SHEETS ONLY (brief A4), so the count has to come from here.
 */

/**
 * Lines that fit in the cargo body of one sheet.
 *
 * The body is 250pt tall (see BlFrontSheet's vertical budget) and a 7pt line
 * occupies ~8.6pt with leading, giving ~29. Held at 26 so a wrapped
 * description line or a tall container entry cannot silently overflow the
 * frame -- an overflowing form is far worse than an extra sheet.
 */
export const CARGO_LINES_PER_SHEET = 26

export interface BlCargoPage {
  marks: string
  description: string
  /** 1-based, counting front sheets only. */
  pageNumber: number
  isLast: boolean
}

export interface BlPagination {
  pages: BlCargoPage[]
  /** The Y in "Page X of Y". Front sheets only; excludes the backside. */
  totalFrontSheets: number
}

export function paginateBlCargo(snapshot: BlSnapshot): BlPagination {
  // With the attach sheet on, the container column prints one fixed line and
  // the containers are listed on the sheet instead, so only the cargo
  // description can drive overflow.
  const markLines = snapshot.useContainerSheet
    ? []
    : splitLines(snapshot.marksAndNumbers)
  const descLines = splitLines(snapshot.packagesAndDescription)

  const sheets = Math.max(
    1,
    Math.ceil(markLines.length / CARGO_LINES_PER_SHEET),
    Math.ceil(descLines.length / CARGO_LINES_PER_SHEET),
  )

  const pages: BlCargoPage[] = []
  for (let i = 0; i < sheets; i++) {
    const from = i * CARGO_LINES_PER_SHEET
    const to = from + CARGO_LINES_PER_SHEET
    pages.push({
      marks: markLines.slice(from, to).join('\n'),
      description: descLines.slice(from, to).join('\n'),
      pageNumber: i + 1,
      isLast: i === sheets - 1,
    })
  }

  return { pages, totalFrontSheets: sheets }
}

function splitLines(value: string): string[] {
  if (!value) return []
  return value.split('\n')
}
