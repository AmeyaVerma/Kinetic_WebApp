import { Document, Text, View, StyleSheet } from '@react-pdf/renderer'
import { DocPage } from '../components/DocPage'
import { Letterhead, LabeledField, SignOff } from '../components/Letterhead'
import { FONT_SIZE, palette } from '../theme'
import {
  ONBOARD_STRINGS,
  CAN_STRINGS,
  DO_STRINGS,
  OFFLOADING_STRINGS,
} from '../strings/operationalDocs'
import type { OpDocSnapshot } from '../opDocSnapshot'

/**
 * Onboard Confirmation, Cargo Arrival Notice, Delivery Order and Off Loading
 * Letter.
 *
 * All four print a letterhead, a labelled field grid, a container table and
 * a sign-off, so they share `Letterhead`, `LabeledField` and `SignOff` and
 * the table helper below. The differences that matter -- the CAN's border,
 * the DO's two container tables, the Off Loading accept-upto column -- are
 * explicit in each component rather than hidden behind configuration.
 *
 * Container tables flow onto extra sheets with their header repeated: these
 * documents list every container, and an import of 20 boxes is ordinary.
 */

const c = palette(false)
const rule = '0.5pt solid ' + c.rule

const base = StyleSheet.create({
  title: {
    textAlign: 'center',
    fontSize: FONT_SIZE.heading,
    fontFamily: 'Helvetica-Bold',
    marginVertical: 8,
    textDecoration: 'underline',
  },
  row: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  table: { borderLeft: rule, borderTop: rule, marginTop: 6 },
  th: {
    fontSize: FONT_SIZE.tiny,
    fontFamily: 'Helvetica-Bold',
    padding: 3,
    borderRight: rule,
    borderBottom: rule,
  },
  td: { fontSize: FONT_SIZE.small, padding: 3, borderRight: rule, borderBottom: rule },
  para: { fontSize: FONT_SIZE.small, marginTop: 6, textAlign: 'justify', lineHeight: 1.35 },
  small: { fontSize: FONT_SIZE.small },
  bold: { fontFamily: 'Helvetica-Bold' },
})

/** A simple bordered table whose header repeats on every sheet it spans. */
function Table({
  columns,
  widths,
  rows,
}: {
  columns: readonly string[]
  widths: string[]
  rows: string[][]
}) {
  return (
    <View style={base.table}>
      <View style={base.row} fixed>
        {columns.map((col, i) => (
          <Text style={[base.th, { width: widths[i] }]} key={col}>
            {col}
          </Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View style={base.row} key={ri} wrap={false}>
          {r.map((cell, ci) => (
            <Text style={[base.td, { width: widths[ci] }]} key={ci}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

/* ── Onboard Confirmation ─────────────────────────────────────────────── */

export function OnboardDocument({ snapshot }: { snapshot: OpDocSnapshot }) {
  const S = ONBOARD_STRINGS
  return (
    <Document title={snapshot.bookingRef + ' Onboard Confirmation'}>
      <DocPage padding={26}>
        <View style={base.row}>
          <View style={{ width: '38%' }}>
            <LabeledField label={S.labels.date} value={snapshot.date} width="100%" labelWidth="30%" />
            <Text style={[base.small, { marginTop: 10 }]}>{S.labels.shipper}</Text>
            <Text style={[base.small, base.bold]}>{snapshot.shipper.name}</Text>
            <Text style={base.small}>{snapshot.shipper.address}</Text>
            {snapshot.shipper.trn ? <Text style={base.small}>TRN {snapshot.shipper.trn}</Text> : null}
            {snapshot.shipper.email ? <Text style={base.small}>{snapshot.shipper.email}</Text> : null}
          </View>
          <View style={{ width: '62%' }}>
            <Letterhead company={snapshot.company} />
          </View>
        </View>

        <Text style={base.title}>{S.title}</Text>

        <View style={base.grid}>
          <LabeledField label={S.labels.vesselVoyage} value={[snapshot.vessel, snapshot.voyage].filter(Boolean).join(' / ')} />
          <LabeledField label={S.labels.numberOfPkgs} value={[snapshot.packages, snapshot.packageType].filter(Boolean).join(' | ')} />
          <LabeledField label={S.labels.hblNoDate} value={[snapshot.hblNo, snapshot.hblDate].filter(Boolean).join(' / ')} />
          <LabeledField label={S.labels.mblNoDate} value={[snapshot.mblNo, snapshot.mblDate].filter(Boolean).join(' / ')} />
          <LabeledField label={S.labels.bookingReference} value={snapshot.customerReference} />
          <LabeledField label={S.labels.polSob} value={[snapshot.pol, snapshot.sob].filter(Boolean).join(' / ')} />
          <LabeledField label={S.labels.podEta} value={[snapshot.pod, snapshot.eta].filter(Boolean).join(' / ')} />
          <LabeledField label={S.labels.freeDays} value={snapshot.freeDays} />
          <LabeledField label={S.labels.consignee} value={snapshot.consignee.name} />
          <LabeledField label={S.labels.printedBy} value={snapshot.printedBy} />
          <LabeledField label={S.labels.productDescription} value={snapshot.commodity} />
          <LabeledField label={S.labels.netWeight} value={snapshot.netWeightKgs} />
          <LabeledField label={S.labels.cfs} value={snapshot.cfs} />
          <LabeledField label={S.labels.shipmentTerms} value={snapshot.shipmentTerms} />
          <LabeledField label={S.labels.sbNumber} value={snapshot.sbNumber} />
          <LabeledField label={S.labels.sbDate} value={snapshot.sbDate} />
        </View>

        <Text style={[base.small, base.bold, { marginTop: 8 }]}>{S.labels.containerGrWt}</Text>
        <Table
          columns={['CONTAINER NUMBER', 'GROSS WEIGHT (KGS)']}
          widths={['50%', '50%']}
          rows={snapshot.containers.map((r) => [r.containerNo, r.grossWeight])}
        />

        <Text style={[base.para, base.bold]}>{S.transhipmentNote}</Text>
        <SignOff legalName={snapshot.company.legalName} />
      </DocPage>
    </Document>
  )
}

/* ── Cargo Arrival Notice ─────────────────────────────────────────────── */

export function CanDocument({ snapshot }: { snapshot: OpDocSnapshot }) {
  const S = CAN_STRINGS
  return (
    <Document title={snapshot.bookingRef + ' Cargo Arrival Notice'}>
      <DocPage padding={22}>
        {/* The CAN's header block sits inside the border, unlike the others. */}
        <View style={{ border: rule, padding: 8 }}>
          <Letterhead company={snapshot.company} align="center" upper />
          <Text style={base.title}>{S.title}</Text>
          <LabeledField label={S.labels.date} value={snapshot.date} width="40%" labelWidth="26%" />

          <View style={[base.grid, { marginTop: 4 }]}>
            <View style={{ width: '50%' }}>
              <Text style={[base.small, base.bold]}>{S.labels.consignee}</Text>
              <Text style={base.small}>{snapshot.consignee.name}</Text>
              <Text style={base.small}>{snapshot.consignee.address}</Text>
              {snapshot.consignee.gstin ? <Text style={base.small}>GSTIN {snapshot.consignee.gstin}</Text> : null}
              {snapshot.consignee.iec ? <Text style={base.small}>IEC {snapshot.consignee.iec}</Text> : null}
              {snapshot.consignee.contactName ? <Text style={base.small}>{snapshot.consignee.contactName}</Text> : null}
              {snapshot.consignee.email ? <Text style={base.small}>{snapshot.consignee.email}</Text> : null}
              {snapshot.consignee.phone ? <Text style={base.small}>{snapshot.consignee.phone}</Text> : null}
            </View>
            <View style={{ width: '50%' }}>
              <LabeledField label={S.labels.vesselVoyage} value={[snapshot.vessel, snapshot.voyage].filter(Boolean).join(' / ')} width="100%" />
              <LabeledField label={S.labels.shippingLine} value={snapshot.shippingLine} width="100%" />
              <LabeledField label={S.labels.polEtd} value={[snapshot.pol, snapshot.etd].filter(Boolean).join(' / ')} width="100%" />
              <LabeledField label={S.labels.podEta} value={[snapshot.pod, snapshot.eta].filter(Boolean).join(' / ')} width="100%" />
              <LabeledField label={S.labels.blNo} value={snapshot.hblNo} width="100%" />
            </View>
          </View>

          <View style={base.grid}>
            <LabeledField label={S.labels.shipmentType} value={snapshot.shipmentType} />
            <LabeledField label={S.labels.shipper} value={snapshot.shipper.name} />
            <LabeledField label={S.labels.bookingReference} value={snapshot.customerReference} />
            <LabeledField label={S.labels.productDescription} value={snapshot.commodity} />
            <LabeledField label={S.labels.freeDays} value={snapshot.freeDays} />
            <LabeledField label={S.labels.numberOfContainers} value={String(snapshot.containers.length || '')} />
            <LabeledField label={S.labels.noOfPkgs} value={snapshot.packages} />
            <LabeledField label={S.labels.netWeight} value={snapshot.netWeightKgs} />
            <LabeledField label={S.labels.cfs} value={snapshot.cfs} />
            <LabeledField label={S.labels.shipmentTerms} value={snapshot.shipmentTerms} />
            <LabeledField label={S.labels.igmNoDate} value={[snapshot.igmNo, snapshot.igmDate].filter(Boolean).join(' / ')} />
            <LabeledField label={S.labels.itemNumber} value={snapshot.itemNumber} />
          </View>

          <Text style={[base.small, base.bold, { marginTop: 6 }]}>{S.labels.containerGrWt}</Text>
          <Table
            columns={['CONTAINER NUMBER', 'SIZE/TYPE', 'GROSS WEIGHT (KGS)']}
            widths={['40%', '25%', '35%']}
            rows={snapshot.containers.map((r) => [
              r.containerNo,
              [r.size, r.type].filter(Boolean).join(' '),
              r.grossWeight,
            ])}
          />

          {S.paragraphs.map((p, i) => (
            <Text style={base.para} key={i}>
              {p}
            </Text>
          ))}

          <Text style={[base.para, base.bold]}>{S.computerGenerated}</Text>
          {/* The blank carries both the "no signature required" line AND an
              Authorised Signatory block. Open item O4 -- reproduced as-is
              until Siddharth says which one to drop. */}
          <SignOff legalName={snapshot.company.legalName} thanking="THANKING YOU" upper />
        </View>
      </DocPage>
    </Document>
  )
}

/* ── Delivery Order ───────────────────────────────────────────────────── */

export function DeliveryOrderDocument({ snapshot }: { snapshot: OpDocSnapshot }) {
  const S = DO_STRINGS
  return (
    <Document title={snapshot.bookingRef + ' Delivery Order'}>
      <DocPage padding={24}>
        <Letterhead company={snapshot.company} align="center" upper />
        <Text style={base.title}>{S.title}</Text>

        <LabeledField label={S.labels.date} value={snapshot.date} width="35%" labelWidth="26%" />
        <Text style={[base.small, { marginTop: 6 }]}>{S.to}</Text>
        <Text style={[base.small, base.bold]}>{snapshot.doTo}</Text>

        <Text style={base.para}>
          {S.deliverSentence(snapshot.chaName, snapshot.consignee.name)}
        </Text>

        <View style={[base.grid, { marginTop: 8 }]}>
          <View style={{ width: '55%' }}>
            <Text style={[base.small, base.bold]}>{S.labels.consigneeBlock}</Text>
            <Text style={base.small}>{snapshot.consignee.name}</Text>
            <Text style={base.small}>{snapshot.consignee.address}</Text>
            {snapshot.consignee.gstin ? <Text style={base.small}>GSTIN {snapshot.consignee.gstin}</Text> : null}
            {snapshot.consignee.iec ? <Text style={base.small}>IEC {snapshot.consignee.iec}</Text> : null}
          </View>
          <View style={{ width: '45%' }}>
            <LabeledField label={S.labels.doNumber} value={snapshot.doNumber} width="100%" />
            <LabeledField label={S.labels.igmNumberDate} value={[snapshot.igmNo, snapshot.igmDate].filter(Boolean).join(' / ')} width="100%" />
            <LabeledField label={S.labels.portOfLoading} value={snapshot.pol} width="100%" />
            <LabeledField label={S.labels.finalDestination} value={snapshot.finalDestination} width="100%" />
            <LabeledField label={S.labels.arrivalDate} value={snapshot.arrivalDate} width="100%" />
            <LabeledField label={S.labels.vesselVoyage} value={[snapshot.vessel, snapshot.voyage].filter(Boolean).join(' | ')} width="100%" />
            <LabeledField label={S.labels.itemNumber} value={snapshot.itemNumber} width="100%" />
            <LabeledField label={S.labels.portOfDischarge} value={snapshot.pod} width="100%" />
            <LabeledField label={S.labels.destuffingType} value={snapshot.destuffingType} width="100%" />
          </View>
        </View>

        <Table
          columns={S.containerColumns}
          widths={['24%', '16%', '12%', '18%', '14%', '16%']}
          rows={snapshot.containers.map((r) => [
            r.containerNo,
            snapshot.shipmentType,
            r.size,
            r.sealNo,
            r.packages,
            r.status,
          ])}
        />

        <Table
          columns={S.cargoColumns}
          widths={['22%', '16%', '24%', '14%', '12%', '12%']}
          rows={[
            [
              snapshot.containers.map((r) => r.containerNo).join(', '),
              (snapshot.containers.length || '') + ' CONTAINERS',
              snapshot.commodity,
              snapshot.hblNo,
              snapshot.hblDate,
              snapshot.grossWeightKgs,
            ],
          ]}
        />

        <View style={[base.grid, { marginTop: 8 }]}>
          <LabeledField label={S.labels.vesselVoyage} value={[snapshot.vessel, snapshot.voyage].filter(Boolean).join(' / ')} />
          <LabeledField label={S.labels.dateOfArrival} value={snapshot.arrivalDate} />
          <LabeledField label={S.labels.igmNumberDate} value={[snapshot.igmNo, snapshot.igmDate].filter(Boolean).join(' / ')} />
          <LabeledField label={S.labels.itemNo} value={snapshot.itemNumber} />
          <LabeledField label={S.labels.placeOfSurvey} value={snapshot.placeOfSurvey} />
        </View>

        <Text style={base.para}>{S.issuedAgainst}</Text>
        <Text style={base.para}>{S.eirLine}</Text>
        <Text style={[base.para, base.bold]}>
          {S.validUpto} {snapshot.validUpto}
        </Text>

        <Text style={[base.small, base.bold, { marginTop: 8 }]}>{S.termsHeading}</Text>
        <Text style={base.para}>
          {S.returnEmptyPrefix} <Text style={[base.bold, { fontSize: FONT_SIZE.body }]}>{snapshot.returnDepot}</Text>{' '}
          {S.returnEmptySuffix}
        </Text>
        <Text style={base.para}>{S.damageClause}</Text>
        <Text style={base.para}>{S.totalLossClause}</Text>

        <SignOff legalName={snapshot.company.legalName} thanking="THANKING YOU" upper />
      </DocPage>
    </Document>
  )
}

/* ── Off Loading Letter ───────────────────────────────────────────────── */

export function OffLoadingDocument({ snapshot }: { snapshot: OpDocSnapshot }) {
  const S = OFFLOADING_STRINGS
  return (
    <Document title={snapshot.bookingRef + ' Off Loading Letter'}>
      <DocPage padding={26}>
        <View style={base.row}>
          <View style={{ width: '38%' }}>
            <LabeledField label={S.labels.date} value={snapshot.date} width="100%" labelWidth="30%" />
            <LabeledField label={S.labels.jobNo} value={snapshot.bookingRef} width="100%" labelWidth="30%" />
            <Text style={[base.small, { marginTop: 8 }]}>{S.labels.to}</Text>
            <Text style={[base.small, base.bold]}>{snapshot.depotName}</Text>
            <Text style={base.small}>{snapshot.depotAddress}</Text>
          </View>
          <View style={{ width: '62%' }}>
            <Letterhead company={snapshot.company} />
          </View>
        </View>

        <Text style={base.title}>{S.title}</Text>

        <View style={base.grid}>
          <LabeledField label={S.labels.attn} value={snapshot.depotAttn} width="100%" labelWidth="18%" />
          <LabeledField label={S.labels.principal} value={snapshot.principal} width="100%" labelWidth="18%" />
          <LabeledField label={S.labels.mblNo} value={snapshot.mblNo} width="100%" labelWidth="18%" />
          <LabeledField label={S.labels.hblNo} value={snapshot.hblNo} width="100%" labelWidth="18%" />
          <LabeledField label={S.labels.product} value={snapshot.commodity} width="100%" labelWidth="18%" />
        </View>

        <Text style={base.para}>{S.acceptParagraph}</Text>

        <View style={[base.grid, { marginTop: 6 }]}>
          <LabeledField label={S.labels.cha} value={snapshot.chaName} width="100%" labelWidth="18%" />
          <LabeledField label={S.labels.consignee} value={snapshot.consignee.name} width="100%" labelWidth="18%" />
        </View>

        <Table
          columns={S.containerColumns}
          widths={['10%', '40%', '20%', '30%']}
          rows={snapshot.containers.map((r, i) => [
            String(i + 1),
            r.containerNo,
            r.size,
            r.acceptUpto,
          ])}
        />

        <Text style={[base.small, { marginTop: 8 }]}>
          {S.labels.doType} - {snapshot.doType}
        </Text>
        <Text style={base.para}>{S.damagedNote}</Text>

        <SignOff legalName={snapshot.company.legalName} />
      </DocPage>
    </Document>
  )
}
