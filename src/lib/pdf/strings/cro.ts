/**
 * Container Release Order static wording, from
 * 03_Container_Release_Order_Blank_format.pdf.
 *
 * The CC block is the carrier's standing terms to shippers and brokers.
 * Transcribed verbatim, quirks included -- section 9 lists the proposed
 * corrections, which must NOT be applied until Siddharth approves. Keeping
 * them here as data rather than inline is what makes that a one-line change.
 */
export const CRO_STRINGS = {
  title: 'CONTAINER RELEASE ORDER',
  dearSir: 'Dear Sir',
  deliverOn: 'Kindly deliver on FIFO basis to M/s.',
  stuffingTail: 'unit for factory stuffing/ICD Yard Stuffing to for port',
  confirmLine:
    'Kindly confirm by return respective container numbers allotted as per this D/O along with the booking reference number so as to update our records.',
  cleanSeaWorthy: 'CLEAN/SEA WORTHY/COMMODITY :',
  surveyor: 'Surveyor :',
  yoursFaithfully: 'Yours Faithfully,',
  asAgent: 'As Agent',
  ccHeading: 'CC: FOR THE ATTENTION OF SHIPPERS/BROKERS/FORWARDING & CLEARING AGENTS:',
  detentionHeading: 'DETENTION TARIFF (USD PER DAY PER CONTAINER)',
  labels: {
    to: 'To,',
    bookingNumber: 'Booking Number',
    principal: 'Principal',
    date: 'Date',
    vessel: 'Vessel',
    terminal: 'Terminal',
    eta: 'ETA',
    etd: 'ETD',
    gateOpen: 'Gate Open',
    gateCutOff: 'Gate Cut Off',
    validTill: 'Valid Till',
    commodity: 'Commodity',
  },
} as const

/**
 * The CC points, printed in two columns as the blank does. Array order is
 * the printed order.
 */
export const CRO_CC_POINTS: string[] = [
  'Please ensure your representative is satisfied that container is "Cargo worthy" prior pick up.',
  'Shipper will be responsible for any container damage if caused due to improper /excess /overweight stuffing.',
  'Reefer unit released should report to the terminal with set temperature failing which any penalty from port will be on shippers a/c and subsequently no claim towards deterioration of cargo will be entertained.',
  'Container subject to available at yard.',
  'If any storage charges due to vessel delay all storage charges will be on your account.',
  'SHIPPERS / BROKERS / FORWARDING & CLEARING AGENTS : You will fully indemnify the line/booking agents from any claims for costs, charges, legal expenses, arising from death or injury caused to any person, any damage that may arise to container after receipt from the yard, up to drop off at pre-stack / back to pick up yard when not used. Cost will be to your account.',
  'CARGO LIABILITY: The Carrier / Agent will not be liable for any damage to the cargo while in transit.',
  'SHIPPING BILL / CLP / HAZARDOUS CARGO DECLARATION: Mandatory to be submitted to the line.',
  'Seal to be collected from the yard at the time of pick up of empty container.',
  'Container will be released only on receipt of fax D.O from the shipping line.',
  'Form 13 / Form 6 and shipping bill to be handed over to the person named in the instructions.',
  'Any detention / ground rent incurred will be on shipper account as per tariff.',
  'Containers must be returned to the nominated yard only.',
  'Weighment of the container is the responsibility of the shipper.',
  'VALIDITY: The DO will be valid only for 3 days from the date of issue.',
  'PORT PENALTY: Any penalty levied by the terminal due to incorrect information provided by you will be debited to your account.',
  'SPECIAL EQUIPMENTS: In case of OPEN TOP, FLAT RACK containers, please make sure before pick up that all removable parts such as Tarpaulin, Tier Cord, Roof Bows, etc are intact.',
  'SPACE : Loading is subject to space availability and acceptance by the carrier.',
  'BL PROFORMA : Please submit your Proforma B/L with full address, Tel/Fax number, National ID, Bayan No. of the consignee whichever applicable. Failing which, late documentation charges will be applicable as per tariff.',
  'MTY UNITS : Please ensure that the empty container received from yard is clean and in sound condition, costs of any subsequent rejection will be to the shipper / CHA account.',
  'OBL RELEASE : Original BL should be released within 5 days from vessel sailing date, thereafter, LATE BL RELEASE charges will be applicable.',
  'PROHIBITED / CONTRABAND CARGO : Exporting Prohibited and Contraband cargo is not allowed and the Carrier and the Booking Agent shall not be liable. The SHIPPERS and CLEARING AGENTS shall be solely responsible.',
  'VGM : Verified Gross Mass must be submitted before the stipulated cut off.',
  'CUT OFF : Gate cut off and documentation cut off must be strictly adhered to.',
  'REEFER PTI : Pre Trip Inspection report to be collected at the time of pick up.',
  'DAMAGE : Any damage noticed at the time of pick up must be reported before gate out.',
  'SURVEY : Container survey at the yard is final and binding.',
  'GENERAL : The Carrier reserves the right to amend these terms without prior notice.',
]

/**
 * Detention tariff, USD per day per container. Static and editable in one
 * place for now; per-shipping-line tariffs come later (brief section 8.4).
 */
export const CRO_DETENTION_TARIFF = {
  standard: {
    label: 'Standard Equipment',
    freeDays: 7,
    rows: [
      { period: '1st week', c20: 30, c40: 60 },
      { period: '2nd week', c20: 40, c40: 80 },
      { period: '3rd week', c20: 60, c40: 120 },
      { period: '4th week', c20: 75, c40: 150 },
      { period: 'Thereafter', c20: 90, c40: 180 },
    ],
  },
  special: {
    label: 'Special Equipment (Flat Racks, Open Top, Reefer)',
    freeDays: 5,
    rows: [
      { period: '1st week', c20: 75, c40: 150 },
      { period: '2nd week', c20: 100, c40: 200 },
      { period: '3rd week', c20: 125, c40: 250 },
      { period: '4th week', c20: 150, c40: 300 },
      { period: 'Thereafter', c20: 200, c40: 400 },
    ],
  },
} as const
