/**
 * Page geometry and the colour rules every document template shares.
 *
 * Everything renders on A4 (595.28 x 841.89 pt). The blank formats were
 * supplied as US Letter, so layouts are matched proportionally rather than
 * copied at absolute offsets -- a Letter-sized layout dropped onto A4
 * unchanged loses ~18mm at the foot, which is where the signature block sits.
 */

export const A4 = { width: 595.28, height: 841.89 } as const

/** Fixed asset placement is expressed in points from the page corner. */
export type Placement = { x: number; y: number; width: number; height: number }

export type AssetPlacement = {
  signature: Placement
  stamp: Placement
  surrender: Placement
}

/**
 * Scan Copy mode renders the ENTIRE document black and white -- logo,
 * stamps, signature and backside included. Rather than scattering
 * `scan ? '#000' : brandBlue` through every template, each one takes a
 * palette from here and the mode is decided once.
 *
 * Acceptance check 5 renders the output to PNG and asserts R=G=B on every
 * pixel, so any colour that bypasses this helper will fail the check.
 */
export type Palette = {
  text: string
  muted: string
  rule: string
  /** The blue title bar on the container attach sheet (#1D5295). */
  bandBg: string
  bandText: string
  /** The red typewriter label at the top right of the BL. */
  label: string
}

const COLOUR: Palette = {
  text: '#000000',
  muted: '#444444',
  rule: '#000000',
  bandBg: '#1D5295',
  bandText: '#FFFFFF',
  label: '#CC0000',
}

const GREY: Palette = {
  text: '#000000',
  muted: '#444444',
  rule: '#000000',
  bandBg: '#555555',
  bandText: '#FFFFFF',
  label: '#000000',
}

export function palette(scan: boolean): Palette {
  return scan ? GREY : COLOUR
}

/**
 * Which asset variant to composite. Greyscale PNGs are pre-made and stored
 * alongside the colour ones rather than being desaturated at render time:
 * desaturating a signature at runtime produces a muddy grey that reproduces
 * badly on a fax or scan, which is exactly what Scan Copy mode is for.
 */
export function assetVariant(scan: boolean): 'grey' | 'colour' {
  return scan ? 'grey' : 'colour'
}

export const FONT_SIZE = {
  tiny: 5.5,
  clause: 6,
  small: 7,
  body: 8,
  label: 7.5,
  heading: 11,
  title: 13,
} as const
