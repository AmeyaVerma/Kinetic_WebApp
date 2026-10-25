import { Document, Text, View, StyleSheet } from '@react-pdf/renderer'
import { DocPage } from '../components/DocPage'
import { FONT_SIZE, palette } from '../theme'
import { BL_STRINGS as S, BL_TYPE_LABEL, numberOfOriginals } from '../strings/bl'
import type { BlSnapshot } from '../blSnapshot'

/**
 * The Kinetic Line Multi-Modal Transport Document front sheet, matching
 * 01_BL_Blank_format.pdf.
 *
 * The blank was supplied as US Letter; this renders A4, so the grid is
 * proportional rather than copied at absolute offsets -- dropping a Letter
 * layout onto A4 unchanged loses ~18mm at the foot, which is exactly where
 * the signature block sits.
 *
 * Reads only from the snapshot (see blSnapshot.ts). Nothing here reaches into
 * the booking or the store, which is what lets an issued BL reprint
 * identically a year later.
 */
export function BlFrontSheet({ snapshot }: { snapshot: BlSnapshot }) {
  const scan = snapshot.printMode === 'Scan'
  const c = palette(scan)
  const rule = '0.7pt solid ' + c.rule

  const s = StyleSheet.create({
    titleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 3 },
    title: { flex: 1, textAlign: 'center', fontSize: FONT_SIZE.heading, fontFamily: 'Helvetica-Bold' },
    typeLabel: {
      position: 'absolute',
      right: 0,
      color: c.label,
      fontSize: FONT_SIZE.heading,
      fontFamily: 'Courier-BoldOblique',
    },

    frame: { border: rule },
    row: { flexDirection: 'row' },
    cell: { padding: 3, borderRight: rule, borderBottom: rule },
    lastCell: { padding: 3, borderBottom: rule },
    label: { fontSize: FONT_SIZE.tiny, color: c.muted },
    value: { fontSize: FONT_SIZE.small, marginTop: 1 },

    company: { alignItems: 'center', paddingVertical: 4 },
    brand: { fontSize: 16, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
    tagline: { fontSize: FONT_SIZE.small, color: c.label, marginBottom: 2 },
    companyLine: { fontSize: FONT_SIZE.tiny, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
    clause: { fontSize: 4.6, textAlign: 'justify', padding: 2, lineHeight: 1.15 },

    // Vertical budget: A4 (841.89) - 36 padding - 34 footer = ~772pt.
    // Header 256 + routing 52 + ports 26 + cargo header 20 + body 250 +
    // note 12 + freight 26 + foot 74 + title 15 = ~731, leaving headroom for
    // a wrapped address line. Raising any of these overflows to a second
    // sheet, which Phase 3's continuation logic should own -- not an
    // accidental spill from a single-container booking.
    cargoBody: { minHeight: 250, flexDirection: 'row' },
    centreNote: { textAlign: 'center', fontSize: FONT_SIZE.tiny, paddingVertical: 2, borderBottom: rule },
    footNote: { fontSize: FONT_SIZE.tiny, marginTop: 'auto' },
    agent: { fontSize: FONT_SIZE.small, fontFamily: 'Helvetica-Bold' },
  })

  // Column widths as fractions of the frame. The cargo body must line up with
  // the header row above it, so both read from here.
  const COL = { marks: '22%', desc: '53%', gross: '12.5%', meas: '12.5%' }

  const Field = ({
    label,
    value,
    width,
    last = false,
    minHeight = 26,
  }: {
    label: string
    value?: string
    width: string
    last?: boolean
    minHeight?: number
  }) => (
    <View style={[last ? s.lastCell : s.cell, { width, minHeight }]}>
      <Text style={s.label}>{label}</Text>
      {value ? <Text style={s.value}>{value}</Text> : null}
    </View>
  )

  return (
    <>
      <View style={s.titleRow}>
        <Text style={s.title}>{S.title}</Text>
        <Text style={s.typeLabel}>{BL_TYPE_LABEL[snapshot.blType]}</Text>
      </View>

      <View style={s.frame}>
        {/* Header block: parties on the left, company and clauses on the right */}
        <View style={s.row}>
          <View style={{ width: '50%' }}>
            <Field label={S.labels.consignor} value={snapshot.consignor} width="100%" minHeight={88} />
            <Field label={S.labels.consignee} value={snapshot.consignee} width="100%" minHeight={84} />
            <Field label={S.labels.notify} value={snapshot.notifyAddress} width="100%" minHeight={84} />
          </View>

          <View style={{ width: '50%' }}>
            <View style={[s.row, { borderBottom: rule }]}>
              <Text style={{ width: '45%', padding: 3, textAlign: 'right', fontSize: FONT_SIZE.small }}>
                {S.labels.mtdNumber}
              </Text>
              <Text style={{ width: '55%', padding: 3, border: rule, fontSize: FONT_SIZE.small }}>
                {snapshot.blNumber}
              </Text>
            </View>
            <View style={[s.row, { borderBottom: rule }]}>
              <Text style={{ width: '45%', padding: 3, textAlign: 'right', fontSize: FONT_SIZE.small }}>
                {S.labels.shipmentRef}
              </Text>
              <Text style={{ width: '55%', padding: 3, border: rule, fontSize: FONT_SIZE.small }}>
                {snapshot.shipmentReference}
              </Text>
            </View>

            {/* Logo artwork has not been supplied, so the brand renders
                typographically at the same footprint. Swapping in the PNG
                later is a one-element change. */}
            <View style={[s.company, { borderBottom: rule }]}>
              <Text style={s.brand}>KINETIC LINE</Text>
              <Text style={s.tagline}>{snapshot.company.tagline}</Text>
              <Text style={s.companyLine}>{snapshot.company.legalName}</Text>
              {snapshot.company.addressLines.map((l, i) => (
                <Text key={i} style={s.companyLine}>
                  {l}
                </Text>
              ))}
              <Text style={s.companyLine}>{snapshot.company.telEmailLine}</Text>
              <Text style={s.companyLine}>{snapshot.company.webLine}</Text>
              <Text style={s.companyLine}>{snapshot.company.mtoRegistration}</Text>
            </View>

            <Text style={[s.clause, { borderBottom: rule }]}>{S.clauseTakenInCharge}</Text>
            <Text style={s.clause}>{S.clauseSurrender}</Text>
          </View>
        </View>

        {/* Routing. Delivery Agent spans the two rows on the right. */}
        <View style={s.row}>
          <View style={{ width: '50%' }}>
            <View style={s.row}>
              <Field label={S.labels.preCarriage} value={snapshot.preCarriageBy} width="50%" />
              <Field label={S.labels.portOfReceipt} value={snapshot.portOfReceipt} width="50%" />
            </View>
            <View style={s.row}>
              <View style={[s.cell, { width: '50%', minHeight: 26 }]}>
                <View style={s.row}>
                  <Text style={[s.label, { flex: 1 }]}>{S.labels.oceanVessel}</Text>
                  <Text style={s.label}>{S.labels.voyNo}</Text>
                </View>
                <Text style={s.value}>
                  {[snapshot.oceanVessel, snapshot.voyageNo].filter(Boolean).join('  /  ')}
                </Text>
              </View>
              <Field label={S.labels.portOfLoading} value={snapshot.portOfLoading} width="50%" />
            </View>
          </View>
          <Field
            label={S.labels.deliveryAgent}
            value={snapshot.deliveryAgent}
            width="50%"
            last
            minHeight={52}
          />
        </View>

        <View style={s.row}>
          <Field label={S.labels.portOfDischarge} value={snapshot.portOfDischarge} width="25%" />
          <Field label={S.labels.finalPort} value={snapshot.finalPortOfDelivery} width="25%" />
          <Field label={S.labels.modeOfTransport} value={snapshot.modeOfTransport} width="25%" />
          <Field label={S.labels.route} value={snapshot.routeOrTransshipment} width="25%" last />
        </View>

        {/* Cargo block header */}
        <View style={s.row}>
          <View style={[s.cell, { width: COL.marks }]}>
            <Text style={s.label}>{S.labels.marksCol}</Text>
          </View>
          <View style={[s.cell, { width: COL.desc }]}>
            <Text style={s.label}>{S.labels.descriptionCol}</Text>
          </View>
          <View style={[s.cell, { width: COL.gross }]}>
            <Text style={s.label}>{S.labels.grossWeight}</Text>
          </View>
          <View style={[s.lastCell, { width: COL.meas }]}>
            <Text style={s.label}>{S.labels.measurement}</Text>
          </View>
        </View>

        {/* Cargo body. Overflow onto continuation sheets is Phase 3. */}
        <View style={s.cargoBody}>
          <View style={[s.cell, { width: COL.marks }]}>
            <Text style={s.value}>
              {snapshot.useContainerSheet ? S.asPerAttachedSheet : snapshot.marksAndNumbers}
            </Text>
          </View>
          <View style={[s.cell, { width: COL.desc }]}>
            <Text style={s.value}>{snapshot.packagesAndDescription}</Text>
          </View>
          <View style={[s.cell, { width: COL.gross }]}>
            <Text style={s.value}>{snapshot.grossWeightKgs}</Text>
          </View>
          <View style={[s.lastCell, { width: COL.meas }]}>
            <Text style={s.value}>{snapshot.measurementM3}</Text>
          </View>
        </View>

        <Text style={s.centreNote}>{S.particularsFurnished}</Text>

        <View style={s.row}>
          {/* The blank format has "PREPAID" pre-printed. Reproducing that
              would misstate a Collect shipment, so the booking value wins. */}
          <Field label={S.labels.freightTerms} value={snapshot.freightTerms} width="25%" />
          <Field label={S.labels.freightPayableAt} value={snapshot.freightPayableAt} width="25%" />
          <Field
            label={S.labels.numberOfOriginals}
            value={numberOfOriginals(snapshot.blType, snapshot.printMode)}
            width="25%"
          />
          <Field label={S.labels.placeAndDate} value={snapshot.placeAndDateOfIssue} width="25%" last />
        </View>

        <View style={s.row}>
          <View style={[s.cell, { width: '50%', minHeight: 74, borderBottom: 'none' }]}>
            <Text style={s.label}>{S.labels.otherParticulars}</Text>
            <Text style={s.value}>{snapshot.otherParticulars}</Text>
            <Text style={s.footNote}>{S.weightNotIncluded}</Text>
            <Text style={s.footNote}>{S.termsContinued}</Text>
          </View>
          <View style={{ width: '50%', padding: 3, minHeight: 74 }}>
            <Text style={[s.agent, { color: c.bandBg }]}>{S.asAgent}</Text>
            <Text style={[s.agent, { color: c.bandBg }]}>{snapshot.company.legalName}</Text>
            <Text style={[s.value, { marginTop: 'auto', textAlign: 'right' }]}>
              {S.labels.authorisedSignatory}
            </Text>
          </View>
        </View>
      </View>
    </>
  )
}

/** A complete BL PDF. Backside and continuation sheets arrive in Phase 3. */
export function BlDocument({ snapshot }: { snapshot: BlSnapshot }) {
  const scan = snapshot.printMode === 'Scan'
  return (
    <Document title={(snapshot.blNumber || 'BL') + ' ' + snapshot.blType}>
      <DocPage scan={scan} padding={18}>
        <BlFrontSheet snapshot={snapshot} />
      </DocPage>
    </Document>
  )
}
