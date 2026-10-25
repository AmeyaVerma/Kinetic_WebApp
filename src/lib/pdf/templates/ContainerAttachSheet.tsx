import { Document, Text, View, StyleSheet } from '@react-pdf/renderer'
import { DocPage } from '../components/DocPage'
import { FONT_SIZE, palette } from '../theme'
import { fmtWeightTotal } from '../format'
import type { BlSnapshot } from '../blSnapshot'

/**
 * BL container attach sheet, rebuilt from 02_BL_Container_Attach_Sheet_SAMPLE.
 *
 * The sample was saved out of another vendor's application and its markup is
 * not reusable (broken CSS comments, table hacks), so this is a native
 * rebuild of the layout rather than a port.
 *
 * Totals are summed from the rows, never typed -- the sample's own figures
 * (5 containers, 126,100.000 gross, 114,960.000 net, 100 packages) add up,
 * and a typed total that silently disagreed with its rows would be worse
 * than no sheet at all.
 */

/** Rows that fit under the header on one sheet. */
const ROWS_PER_SHEET = 28

export function ContainerAttachSheet({ snapshot }: { snapshot: BlSnapshot }) {
  const scan = snapshot.printMode === 'Scan'
  const c = palette(scan)
  const rule = '0.5pt solid ' + c.rule
  const isDraft = snapshot.blType === 'Draft'

  const s = StyleSheet.create({
    band: {
      backgroundColor: c.bandBg,
      color: c.bandText,
      textAlign: 'center',
      paddingVertical: 5,
      fontSize: FONT_SIZE.heading,
      fontFamily: 'Helvetica-Bold',
    },
    blNo: { marginTop: 6, fontSize: FONT_SIZE.body, fontFamily: 'Helvetica-Bold' },
    strip: {
      marginTop: 4,
      marginBottom: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      borderTop: rule,
      borderBottom: rule,
      paddingVertical: 4,
    },
    stripItem: { width: '33%', fontSize: FONT_SIZE.small, paddingVertical: 1 },
    stripLabel: { fontFamily: 'Helvetica-Bold' },

    table: { borderLeft: rule, borderTop: rule },
    row: { flexDirection: 'row' },
    th: {
      backgroundColor: c.bandBg,
      color: c.bandText,
      fontFamily: 'Helvetica-Bold',
      fontSize: FONT_SIZE.tiny,
      padding: 3,
      borderRight: rule,
      borderBottom: rule,
      textAlign: 'center',
    },
    td: {
      fontSize: FONT_SIZE.small,
      padding: 3,
      borderRight: rule,
      borderBottom: rule,
    },
    totalCell: {
      fontSize: FONT_SIZE.small,
      fontFamily: 'Helvetica-Bold',
      padding: 3,
      borderRight: rule,
      borderBottom: rule,
      backgroundColor: c.bandBg,
      color: c.bandText,
    },
    draft: {
      position: 'absolute',
      top: 2,
      right: 0,
      fontSize: FONT_SIZE.heading,
      fontFamily: 'Courier-BoldOblique',
      color: c.label,
    },
  })

  // Shared so header, body and totals line up.
  const W = {
    container: '18%',
    size: '9%',
    type: '9%',
    soc: '7%',
    seal: '15%',
    gross: '15%',
    net: '15%',
    pkgs: '12%',
  }

  const rows = snapshot.containers
  const sheets = Math.max(1, Math.ceil(rows.length / ROWS_PER_SHEET))
  const totals = rows.reduce(
    (a, r) => ({
      gross: a.gross + r.grossRaw,
      net: a.net + r.netRaw,
      pkgs: a.pkgs + r.packagesRaw,
    }),
    { gross: 0, net: 0, pkgs: 0 },
  )

  const Header = () => (
    <View style={s.row}>
      <Text style={[s.th, { width: W.container }]}>CONTAINER</Text>
      <Text style={[s.th, { width: W.size }]}>SIZE</Text>
      <Text style={[s.th, { width: W.type }]}>TYPE</Text>
      <Text style={[s.th, { width: W.soc }]}>SOC</Text>
      <Text style={[s.th, { width: W.seal }]}>SEAL NO</Text>
      <Text style={[s.th, { width: W.gross }]}>GROSS WEIGHT</Text>
      <Text style={[s.th, { width: W.net }]}>NET WEIGHT</Text>
      <Text style={[s.th, { width: W.pkgs }]}>PACKAGES</Text>
    </View>
  )

  return (
    <Document title={(snapshot.blNumber || 'BL') + ' container sheet'}>
      {Array.from({ length: sheets }, (_, i) => {
        const slice = rows.slice(i * ROWS_PER_SHEET, (i + 1) * ROWS_PER_SHEET)
        const isLast = i === sheets - 1
        return (
          <DocPage
            key={i}
            scan={scan}
            padding={22}
            footerLeft={snapshot.blNumber}
            footerRight={'Page ' + (i + 1) + ' of ' + sheets}
          >
            {isDraft && <Text style={s.draft}>DRAFT</Text>}
            <Text style={s.band}>ATTACH CONTAINER SHEET</Text>
            <Text style={s.blNo}>BL NO.: {snapshot.blNumber}</Text>

            <View style={s.strip}>
              <Text style={s.stripItem}>
                <Text style={s.stripLabel}>VESSEL: </Text>
                {snapshot.oceanVessel.toUpperCase()}
              </Text>
              <Text style={s.stripItem}>
                <Text style={s.stripLabel}>VOYAGE: </Text>
                {snapshot.voyageNo.toUpperCase()}
              </Text>
              <Text style={s.stripItem}>
                <Text style={s.stripLabel}>POR: </Text>
                {snapshot.portOfReceipt.toUpperCase()}
              </Text>
              <Text style={s.stripItem}>
                <Text style={s.stripLabel}>POL: </Text>
                {snapshot.portOfLoading.toUpperCase()}
              </Text>
              <Text style={s.stripItem}>
                <Text style={s.stripLabel}>POD: </Text>
                {snapshot.portOfDischarge.toUpperCase()}
              </Text>
              <Text style={s.stripItem}>
                <Text style={s.stripLabel}>FINAL DESTINATION: </Text>
                {snapshot.finalPortOfDelivery.toUpperCase()}
              </Text>
            </View>

            <View style={s.table}>
              {/* Header repeats on every sheet. */}
              <Header />

              {slice.map((r) => (
                <View style={s.row} key={r.containerNo}>
                  <Text style={[s.td, { width: W.container }]}>{r.containerNo}</Text>
                  <Text style={[s.td, { width: W.size }]}>{r.size}</Text>
                  <Text style={[s.td, { width: W.type }]}>{r.type}</Text>
                  <Text style={[s.td, { width: W.soc, textAlign: 'center' }]}>{r.soc}</Text>
                  <Text style={[s.td, { width: W.seal }]}>{r.sealNo}</Text>
                  <Text style={[s.td, { width: W.gross, textAlign: 'right' }]}>{r.grossWeight}</Text>
                  <Text style={[s.td, { width: W.net, textAlign: 'right' }]}>{r.netWeight}</Text>
                  <Text style={[s.td, { width: W.pkgs, textAlign: 'right' }]}>{r.packages}</Text>
                </View>
              ))}

              {/* Totals print once, on the final sheet, and cover every row
                  in the shipment -- not just the rows on this page. */}
              {isLast && (
                <View style={s.row}>
                  <Text style={[s.totalCell, { width: W.container }]}>TOTAL NO OF CONTAINERS</Text>
                  <Text
                    style={[
                      s.totalCell,
                      { width: W.size, textAlign: 'center' },
                    ]}
                  >
                    {rows.length}
                  </Text>
                  <Text
                    style={[
                      s.totalCell,
                      { width: (parseFloat(W.type) + parseFloat(W.soc) + parseFloat(W.seal)).toFixed(0) + '%' },
                    ]}
                  >
                    GRAND TOTAL
                  </Text>
                  <Text style={[s.totalCell, { width: W.gross, textAlign: 'right' }]}>
                    {fmtWeightTotal(totals.gross)}
                  </Text>
                  <Text style={[s.totalCell, { width: W.net, textAlign: 'right' }]}>
                    {fmtWeightTotal(totals.net)}
                  </Text>
                  <Text style={[s.totalCell, { width: W.pkgs, textAlign: 'right' }]}>
                    {totals.pkgs || ''}
                  </Text>
                </View>
              )}
            </View>
          </DocPage>
        )
      })}
    </Document>
  )
}
