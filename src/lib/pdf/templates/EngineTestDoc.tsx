import { Document, Text, View, StyleSheet } from '@react-pdf/renderer'
import { DocPage } from '../components/DocPage'
import { FONT_SIZE, palette } from '../theme'
import { fmtDate, fmtWeight, fmtWeightTotal, fmtMoney } from '../format'

/**
 * Phase 1 engine check. Not a business document -- it exercises the pieces
 * every real template depends on, so a regression shows up here rather than
 * inside the BL:
 *
 *   - A4 geometry and margins
 *   - Page X of Y across a forced page break, with Y correct on page 1
 *   - "Continued on next page" on non-final sheets only
 *   - the Scan Copy palette (nothing coloured must survive it)
 *   - the formatting rules (dates, row vs total weights, currency decimals)
 */
export function EngineTestDoc({ scan = false }: { scan?: boolean }) {
  const c = palette(scan)
  const s = StyleSheet.create({
    band: {
      backgroundColor: c.bandBg,
      color: c.bandText,
      padding: 5,
      fontSize: FONT_SIZE.heading,
      textAlign: 'center',
    },
    label: { color: c.label, fontSize: FONT_SIZE.title },
    row: { flexDirection: 'row', borderBottom: `0.5pt solid ${c.rule}`, paddingVertical: 2 },
    cell: { flex: 1 },
    h: { marginTop: 10, marginBottom: 4, fontSize: FONT_SIZE.label },
  })

  // Values chosen to prove the 3dp / thousands-separator split and the
  // non-2dp currencies, which are the easy things to get wrong.
  const rows = [
    { box: 'KLNU1234567', gross: 24990, net: 22992 },
    { box: 'KLNU7654321', gross: 25130.5, net: 23010.25 },
  ]
  const totalGross = rows.reduce((a, r) => a + r.gross, 0)
  const totalNet = rows.reduce((a, r) => a + r.net, 0)

  return (
    <Document title="Kinetic Line document engine test">
      <DocPage scan={scan} continuedNote>
        <Text style={s.band}>DOCUMENT ENGINE TEST</Text>
        <Text style={s.label}>SAMPLE LABEL</Text>

        <Text style={s.h}>Dates (dd-mm-yyyy; blank stays blank)</Text>
        <Text>issued: {fmtDate('2026-10-25')}</Text>
        <Text>missing: [{fmtDate(null)}]</Text>

        <Text style={s.h}>Weights — rows plain, totals separated</Text>
        {rows.map((r) => (
          <View style={s.row} key={r.box}>
            <Text style={s.cell}>{r.box}</Text>
            <Text style={s.cell}>{fmtWeight(r.gross)}</Text>
            <Text style={s.cell}>{fmtWeight(r.net)}</Text>
          </View>
        ))}
        <View style={s.row}>
          <Text style={s.cell}>GRAND TOTAL</Text>
          <Text style={s.cell}>{fmtWeightTotal(totalGross)}</Text>
          <Text style={s.cell}>{fmtWeightTotal(totalNet)}</Text>
        </View>

        <Text style={s.h}>Currency decimals from the master</Text>
        <Text>USD 2dp: {fmtMoney(1234.5, 2)}</Text>
        <Text>OMR 3dp: {fmtMoney(1234.5, 3)}</Text>
        <Text>JPY 0dp: {fmtMoney(1234.5, 0)}</Text>

        {/* Forces a second sheet so Page X of Y and the continued note are
            actually exercised rather than assumed. */}
        <View break>
          <Text style={s.h}>Second sheet</Text>
          <Text>
            This sheet exists so the footer has to report "Page 2 of 2" and
            page 1 has to print the continued note.
          </Text>
        </View>
      </DocPage>
    </Document>
  )
}
