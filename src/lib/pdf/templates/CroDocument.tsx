import { Document, Text, View, StyleSheet } from '@react-pdf/renderer'
import { DocPage } from '../components/DocPage'
import { Letterhead, LabeledField } from '../components/Letterhead'
import { FONT_SIZE, palette } from '../theme'
import { CRO_STRINGS as S, CRO_CC_POINTS, CRO_DETENTION_TARIFF } from '../strings/cro'
import type { OpDocSnapshot } from '../opDocSnapshot'

/**
 * Container Release Order, from 03_Container_Release_Order_Blank_format.pdf.
 *
 * Issued once per equipment group: a booking with 2x20 and 1x40 produces two
 * CROs, each with its own version chain and file name (..._CRO_2X20.pdf).
 * That is why `equipmentGroup` is part of the snapshot rather than derived
 * at render time.
 *
 * The CC block and the detention tariff are the bulk of the page and are
 * standing terms, so they flow onto a second sheet rather than being
 * compressed to fit -- an unreadable tariff is worse than an extra page.
 */
export function CroDocument({ snapshot }: { snapshot: OpDocSnapshot }) {
  const c = palette(false)
  const rule = '0.5pt solid ' + c.rule

  const s = StyleSheet.create({
    head: { flexDirection: 'row', marginBottom: 6 },
    title: {
      textAlign: 'center',
      fontSize: FONT_SIZE.heading,
      fontFamily: 'Helvetica-Bold',
      marginVertical: 8,
      textDecoration: 'underline',
    },
    cols: { flexDirection: 'row', gap: 16 },
    col: { flex: 1 },
    body: { marginTop: 8, fontSize: FONT_SIZE.small, lineHeight: 1.5 },
    bold: { fontFamily: 'Helvetica-Bold' },
    big: { fontSize: FONT_SIZE.body, fontFamily: 'Helvetica-Bold' },
    bullets: { marginTop: 8 },
    bullet: { fontSize: FONT_SIZE.small, marginBottom: 2 },
    ccHeading: {
      marginTop: 14,
      fontSize: FONT_SIZE.small,
      fontFamily: 'Helvetica-Bold',
    },
    ccWrap: { flexDirection: 'row', gap: 12, marginTop: 4 },
    ccCol: { flex: 1 },
    ccItem: { fontSize: 5.4, marginBottom: 2, lineHeight: 1.25 },
    tariffHead: { marginTop: 12, fontSize: FONT_SIZE.small, fontFamily: 'Helvetica-Bold' },
    row: { flexDirection: 'row' },
    th: {
      fontSize: FONT_SIZE.tiny,
      fontFamily: 'Helvetica-Bold',
      padding: 2,
      borderRight: rule,
      borderBottom: rule,
    },
    td: { fontSize: FONT_SIZE.tiny, padding: 2, borderRight: rule, borderBottom: rule },
    table: { borderLeft: rule, borderTop: rule, marginTop: 3 },
  })

  // Split the CC points down the middle, as the blank prints them.
  const half = Math.ceil(CRO_CC_POINTS.length / 2)
  const ccLeft = CRO_CC_POINTS.slice(0, half)
  const ccRight = CRO_CC_POINTS.slice(half)

  // Structurally typed rather than `typeof CRO_DETENTION_TARIFF.standard`:
  // the two groups are `as const` with different literal values, so the
  // standard group's type does not accept the special one.
  type TariffGroup = {
    readonly label: string
    readonly freeDays: number
    readonly rows: readonly { readonly period: string; readonly c20: number; readonly c40: number }[]
  }

  const Tariff = ({ group }: { group: TariffGroup }) => (
    <View style={{ marginTop: 6 }}>
      <Text style={{ fontSize: FONT_SIZE.tiny, fontFamily: 'Helvetica-Bold' }}>
        {group.label} — {group.freeDays} days free
      </Text>
      <View style={s.table}>
        <View style={s.row}>
          <Text style={[s.th, { width: '34%' }]}>PERIOD</Text>
          <Text style={[s.th, { width: '33%' }]}>20FT</Text>
          <Text style={[s.th, { width: '33%' }]}>40FT</Text>
        </View>
        {group.rows.map((r) => (
          <View style={s.row} key={r.period}>
            <Text style={[s.td, { width: '34%' }]}>{r.period}</Text>
            <Text style={[s.td, { width: '33%' }]}>{r.c20}</Text>
            <Text style={[s.td, { width: '33%' }]}>{r.c40}</Text>
          </View>
        ))}
      </View>
    </View>
  )

  return (
    <Document title={snapshot.bookingRef + ' CRO ' + snapshot.equipmentGroup}>
      <DocPage padding={24} continuedNote>
        <View style={s.head}>
          <View style={{ width: '38%' }} />
          <View style={{ width: '62%' }}>
            <Letterhead company={snapshot.company} />
          </View>
        </View>

        <Text style={s.title}>{S.title}</Text>

        <View style={s.cols}>
          <View style={s.col}>
            <Text style={{ fontSize: FONT_SIZE.small }}>{S.labels.to}</Text>
            <Text style={[{ fontSize: FONT_SIZE.small }, s.bold]}>{snapshot.depotName}</Text>
            <Text style={{ fontSize: FONT_SIZE.small }}>{snapshot.depotAddress}</Text>
            {snapshot.depotAttn ? (
              <Text style={{ fontSize: FONT_SIZE.small }}>Attn: {snapshot.depotAttn}</Text>
            ) : null}
            {snapshot.depotPhone ? (
              <Text style={{ fontSize: FONT_SIZE.small }}>{snapshot.depotPhone}</Text>
            ) : null}
          </View>
          <View style={s.col}>
            <LabeledField label={S.labels.bookingNumber} value={snapshot.bookingRef} width="100%" />
            <LabeledField label={S.labels.principal} value={snapshot.principal} width="100%" />
            <LabeledField label={S.labels.date} value={snapshot.date} width="100%" />
            <LabeledField label={S.labels.terminal} value={snapshot.terminal} width="100%" />
            <LabeledField label={S.labels.validTill} value={snapshot.validTill} width="100%" />
          </View>
        </View>

        <View style={[s.cols, { marginTop: 6 }]}>
          <View style={s.col}>
            <LabeledField
              label={S.labels.vessel}
              value={[snapshot.vessel, snapshot.voyage].filter(Boolean).join(' / ')}
              width="100%"
            />
            <LabeledField label={S.labels.eta} value={snapshot.eta} width="100%" />
            <LabeledField label={S.labels.gateOpen} value={snapshot.gateOpen} width="100%" />
          </View>
          <View style={s.col}>
            <LabeledField label={S.labels.etd} value={snapshot.etd} width="100%" />
            <LabeledField label={S.labels.gateCutOff} value={snapshot.gateCutOff} width="100%" />
          </View>
        </View>

        <View style={s.body}>
          <Text>{S.dearSir}</Text>
          <Text>
            {S.deliverOn} <Text style={s.bold}>{snapshot.shipper.name}</Text>
          </Text>
          <Text style={s.big}>{snapshot.equipmentGroup}</Text>
          <Text>
            {S.stuffingTail} <Text style={s.bold}>{snapshot.pod}</Text>, Commodity :{' '}
            <Text style={s.bold}>{snapshot.commodity}</Text>
          </Text>
          <Text style={{ marginTop: 6 }}>{S.confirmLine}</Text>
          <Text style={{ marginTop: 6 }}>
            {S.cleanSeaWorthy} {snapshot.commodity} POR : {snapshot.portOfReceipt}, POL :{' '}
            {snapshot.pol}, POD : {snapshot.pod} FPOD : {snapshot.finalDestination}
          </Text>
        </View>

        {snapshot.instructions.length > 0 && (
          <View style={s.bullets}>
            {snapshot.instructions.map((line, i) => (
              <Text style={s.bullet} key={i}>
                • {line}
              </Text>
            ))}
          </View>
        )}

        <View style={{ marginTop: 10 }}>
          <Text style={{ fontSize: FONT_SIZE.small }}>{S.surveyor}</Text>
          {/* The blank runs name, address and phone together into "Yours
              Faithfully". Separate lines, per the brief. */}
          <Text style={{ fontSize: FONT_SIZE.small }}>{snapshot.surveyorName}</Text>
          <Text style={{ fontSize: FONT_SIZE.small }}>{snapshot.surveyorAddress}</Text>
          <Text style={{ fontSize: FONT_SIZE.small }}>{snapshot.surveyorPhone}</Text>
        </View>

        <View style={{ marginTop: 10 }}>
          <Text style={{ fontSize: FONT_SIZE.small }}>{S.yoursFaithfully}</Text>
          <Text style={[{ fontSize: FONT_SIZE.small }, s.bold]}>{snapshot.company.legalName}</Text>
          <Text style={{ fontSize: FONT_SIZE.small }}>{S.asAgent}</Text>
        </View>

        <Text style={s.ccHeading}>{S.ccHeading}</Text>
        <View style={s.ccWrap}>
          <View style={s.ccCol}>
            {ccLeft.map((p, i) => (
              <Text style={s.ccItem} key={i}>
                {i + 1}. {p}
              </Text>
            ))}
          </View>
          <View style={s.ccCol}>
            {ccRight.map((p, i) => (
              <Text style={s.ccItem} key={i}>
                {half + i + 1}. {p}
              </Text>
            ))}
          </View>
        </View>

        <Text style={s.tariffHead}>{S.detentionHeading}</Text>
        <Tariff group={CRO_DETENTION_TARIFF.standard} />
        <Tariff group={CRO_DETENTION_TARIFF.special} />
      </DocPage>
    </Document>
  )
}
