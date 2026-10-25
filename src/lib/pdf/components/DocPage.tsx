import { Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import { A4, FONT_SIZE, palette } from '../theme'

/**
 * The A4 page every document sheet is built on.
 *
 * Page X of Y: react-pdf resolves `totalPages` after layout, so the footer
 * reports a correct Y without the template having to pre-compute how many
 * sheets the content will take. `fixed` repeats the footer on every page the
 * content flows onto.
 *
 * `numbered` is false for the BL backside, which is always the last page of
 * the PDF and is deliberately excluded from the count -- Page X of Y counts
 * front sheets only.
 */
export function DocPage({
  children,
  scan = false,
  numbered = true,
  continuedNote = false,
  padding = 24,
}: {
  children: ReactNode
  scan?: boolean
  numbered?: boolean
  /**
   * Prints "Continued on next page" at the foot of every sheet except the
   * last. Used by the BL description area when cargo overflows.
   */
  continuedNote?: boolean
  padding?: number
}) {
  const c = palette(scan)
  const styles = StyleSheet.create({
    page: {
      width: A4.width,
      height: A4.height,
      paddingTop: padding,
      paddingBottom: 34, // room for the footer, which is absolutely placed
      paddingHorizontal: padding,
      fontSize: FONT_SIZE.body,
      fontFamily: 'Helvetica',
      color: c.text,
      backgroundColor: '#FFFFFF',
    },
    footer: {
      position: 'absolute',
      bottom: 16,
      left: padding,
      right: padding,
      flexDirection: 'row',
      justifyContent: 'space-between',
      fontSize: FONT_SIZE.small,
      color: c.muted,
    },
  })

  return (
    <Page size="A4" style={styles.page} wrap>
      {/* Children render directly into the page flow. An intermediate
          wrapper (even one that only sets flexGrow) stops `break` on a child
          from splitting the page, which silently collapses multi-sheet
          documents to one sheet and makes Page X of Y report "1 of 1". */}
      {children}

      {(numbered || continuedNote) && (
        <View style={styles.footer} fixed>
          <Text
            render={({ pageNumber, totalPages }) =>
              continuedNote && pageNumber < totalPages ? 'Continued on next page' : ''
            }
          />
          <Text
            render={({ pageNumber, totalPages }) =>
              numbered ? `Page ${pageNumber} of ${totalPages}` : ''
            }
          />
        </View>
      )}
    </Page>
  )
}
