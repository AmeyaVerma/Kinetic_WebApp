import type { BlSnapshot, ContainerSheetRow } from '../blSnapshot'
import { fmtWeight } from '../format'
import type { BlType } from '../strings/bl'

/**
 * A synthetic 14-container BL used by the engine test harness.
 *
 * Exists so multi-sheet behaviour (Page X of Y, the continued note, the
 * attach sheet's repeating header and totals) can be exercised without
 * inventing containers in the production database -- the acceptance checks
 * call for a 12+ container booking and there isn't one.
 *
 * Test data only. Nothing in the app reads this outside the harness page.
 */
export function blTestSnapshot({
  blType = 'Original',
  printMode = 'Original',
  useContainerSheet = false,
  containerCount = 14,
}: {
  blType?: BlType
  printMode?: 'Original' | 'Scan'
  useContainerSheet?: boolean
  containerCount?: number
} = {}): BlSnapshot {
  const containers: ContainerSheetRow[] = Array.from({ length: containerCount }, (_, i) => {
    const gross = 24990 + i * 37.5
    const net = gross - 2100
    return {
      containerNo: 'KLNU' + String(1000000 + i * 7919).slice(0, 7),
      size: i % 3 === 0 ? '40 FT' : '20 FT',
      type: i % 3 === 0 ? 'HC' : 'HD',
      soc: 'N' as const,
      sealNo: 'SL' + String(400000 + i * 13),
      grossWeight: fmtWeight(gross),
      netWeight: fmtWeight(net),
      packages: String(20 + i),
      grossRaw: gross,
      netRaw: net,
      packagesRaw: 20 + i,
    }
  })

  return {
    blNumber: 'KLNVO2627000531',
    blType,
    printMode,
    shipmentReference: 'KLNVO2627000531',

    consignor: 'SAMPLE EXPORTS PVT. LTD.\nPLOT 14, MIDC INDUSTRIAL AREA\nNAVI MUMBAI 400705, INDIA\nGSTIN 27AAACS1234F1Z5',
    consignee: 'GULF STAR TRADING LLC\nP.O. BOX 55512, JEBEL ALI FREE ZONE\nDUBAI, UNITED ARAB EMIRATES\nTRN 100123456700003',
    notifyAddress: 'SAME AS CONSIGNEE',
    deliveryAgent: 'GULF STAR SHIPPING LLC\nOFFICE 1204, AL MOOSA TOWER 2\nSHEIKH ZAYED ROAD, DUBAI',

    preCarriageBy: 'ROAD',
    portOfReceipt: 'NHAVA SHEVA',
    oceanVessel: 'CMA CGM TAIGE',
    voyageNo: '0FL1E',
    portOfLoading: 'NHAVA SHEVA',
    portOfDischarge: 'JEBEL ALI',
    finalPortOfDelivery: 'JEBEL ALI',
    modeOfTransport: 'Sea',
    routeOrTransshipment: '',

    // One line per container, which is what pushes the sheet past one page.
    marksAndNumbers: containers
      .map((c) => [c.containerNo, c.sealNo, c.size + ' ' + c.type].join(' / '))
      .join('\n'),
    useContainerSheet,
    containers,
    packagesAndDescription: [
      String(containers.reduce((a, c) => a + c.packagesRaw, 0)) + ' PACKAGES',
      'COTTON MADE-UPS AND TEXTILE FURNISHINGS',
      'HS CODE 6304.92',
      'FREIGHT PREPAID',
      ...containers.map(
        (c) => 'CONTAINER ' + c.containerNo + ' - ' + c.packages + ' PKGS',
      ),
    ].join('\n'),
    grossWeightKgs: fmtWeight(containers.reduce((a, c) => a + c.grossRaw, 0)),
    measurementM3: '128.400',

    freightTerms: 'Prepaid',
    freightPayableAt: 'MUMBAI',
    placeAndDateOfIssue: 'Mumbai, 25-10-2026',
    otherParticulars: '',

    company: {
      legalName: 'KINETIC INTERNATIONAL LOGISTICS PVT. LTD.',
      tagline: 'Your Cargo, Our Responsibility',
      addressLines: [
        'CRESCENT BUSINESS SQUARE, OFFICE 1009, 10TH FLOOR',
        'OPP GUNDECHA ONCLAVE, KHERANI ROAD, SAKI NAKA',
        'ANDHERI EAST, MUMBAI 400072, MAHARASHTRA, INDIA',
      ],
      telEmailLine: 'TEL: +91 86559 44515  EMAIL: DOC@KINTLOG.COM',
      webLine: 'WEB : WWW.KINTLOG.COM',
      mtoRegistration: 'MTO/DGS/3605/JUL/2027',
    },
  }
}
