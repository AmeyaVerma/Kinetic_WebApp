/**
 * Static wording for the Onboard Confirmation, Cargo Arrival Notice,
 * Delivery Order and Off Loading Letter.
 *
 * Each document keeps its own exported object, so a correction stays scoped
 * to one document (section 9). They share a file only because four of them
 * are short; splitting is a copy-paste away if any grows.
 *
 * IMPORTANT: every string is transcribed VERBATIM from the blank formats,
 * including the spelling errors -- "ADVICE" for advise, "YOU CONSIGNEMNT",
 * "AUTION", "ALLL", "MARKES", "INCASE". Section 9 proposes corrections and
 * they must NOT be applied until Siddharth approves. They live here as data
 * precisely so approving them is a one-line change per string.
 */

export const ONBOARD_STRINGS = {
  title: 'ONBOARD CONFIRMATION',
  transhipmentNote:
    'IN CASE OF TRANSHIPMENT CARGO, WILL REVERT WITH TRANSHIPMENT VESSEL ONCE CONTAINER ARRIVAL AT POD.',
  labels: {
    date: 'Date',
    shipper: 'Shipper',
    vesselVoyage: 'Vessel/Voyage',
    numberOfPkgs: 'Number of Pkgs',
    hblNoDate: 'HBL No. / Date',
    mblNoDate: 'MBL No. / Date',
    bookingReference: 'Booking Reference',
    polSob: 'POL / SOB',
    podEta: 'POD / ETA',
    freeDays: 'No of Free Days',
    consignee: 'Consignee',
    printedBy: 'Printed By',
    containerGrWt: 'Container Number/s | GrWt',
    productDescription: 'Product Description',
    netWeight: 'Net Wt. (KGS)',
    cfs: 'CFS',
    shipmentTerms: 'Shipment Terms',
    sbNumber: 'SB Number',
    sbDate: 'SB Date',
  },
} as const

export const CAN_STRINGS = {
  title: 'CARGO ARRIVAL NOTICE',
  paragraphs: [
    'THE ABOVE NOTICE IS TO ADVICE YOU THE EXPECTED DATES OF ARRIVAL OF YOU CONSIGNEMNT AS PER THE DETAILS STATED ABOVE. YOU ARE REQUESTED TO THE APPROACH OUR OFFICES WITH THE NECESSARY ORIGINAL DOCUMENTS FOR COLLECTION OF DELIVERY ORDER AFTER PAYMENT OF ALL APPLICABLE CHARGES.',
    'ALL CHARGES SHALL BE PAYABLE BY DEMAND DRAFT OR CHEQUE IN FAVOUR OF KINETIC INTERNATIONAL LOGISTICS PVT. LTD.',
    'IN THE EVENT THE CARGO IS NOT CLEARED WITH IN THE STIPULATED ALLOWED TIME, THE SAME SHALL BE SUBJECT TO AUTION/SALE AS PER THE LAW OF LAND AT YOUR COSTS, RISK AND CONSEQUENCES.',
    'DETENTION SHALL BE COLLECTED, IF APPLICABLE, UNTIL THE ESTIMATED DATE OF RETURN OF THE EQUIPMENT, TERM AND RATE PRESCRIBED.',
    'YOU MAY KINDLY GET IN TOUCH WITH OUR IMPORTS DEPARTMENT AS PER CONTACT DETAILS STATED ABOVE FOR ANY FURTHER INFORMATION THAT MAY BE REQUIRED BY YOU.',
  ],
  computerGenerated: 'THIS IS COMPUTER GENERATED REPORT SO DOES NOT REQUIRE STAMP/SIGNATURE.',
  labels: {
    date: 'DATE',
    consignee: 'CONSIGNEE',
    shipper: 'SHIPPER',
    shipmentType: 'SHIPMENT TYPE',
    bookingReference: 'BOOKING REFERENCE',
    freeDays: 'NO OF FREE DAYS',
    netWeight: 'NET WT. (KGS)',
    cfs: 'CFS',
    igmNoDate: 'IGM NO / DATE',
    vesselVoyage: 'VESSEL/VOYAGE',
    shippingLine: 'SHIPPING LINE',
    polEtd: 'POL / ETD',
    podEta: 'POD / ETA',
    blNo: 'B/L NO.',
    containerGrWt: 'CONTAINER NUMBER/S | GRWT',
    productDescription: 'PRODUCT DESCRIPTION',
    numberOfContainers: 'NUMBER OF CONTAINERS',
    noOfPkgs: 'NO OF PKGS',
    shipmentTerms: 'SHIPMENT TERMS',
    itemNumber: 'ITEM NUMBER',
  },
} as const

export const DO_STRINGS = {
  title: 'DELIVERY ORDER',
  to: 'TO,',
  theManager: 'THE MANAGER',
  deliverSentence: (cha: string, consignee: string) =>
    'PLEASE DELIVER FOLLOWING CARGO TO CHA M/S ' +
    (cha || '____________') +
    ' ON BEHALF OF CONSIGNEE M/S ' +
    (consignee || '____________') +
    ' OR BEARER THE FOLLOWING PACKAGES. IT IS REQUIRED TO TAKE A PROPER RECEIPT FOR THE SAME.',
  issuedAgainst:
    'DELIVERY ORDER ISSUED AGAINST LETTER OF GUARANTEE/BILL OF LADING IN OUR POSSESSION AND IS SUBJECT TO ALLL CLAUSES/TERMS THEREOF.',
  eirLine:
    'KINDLY COLLECT COPY OF THE EIR FROM OUR SURVEYORS AT THE TIME OF PICKING UP LOADED CONTAINER, TO BE SUBMITTED OUR EMPTY CONTAINER YARD AT THE TIME OF OFF LOADING.',
  validUpto: 'PLEASE NOTE THIS DELIVERY ORDER IS VALID UPTO',
  termsHeading: 'TERMS AND CONDITIONS',
  returnEmptyPrefix:
    'IT IS RESPONSIBILITY OF CONSIGNEE/CHA/ICD/CFS TO RETURN THE EMPTY CONTAINER AT',
  returnEmptySuffix: 'IN SAFE AND SOUND CONDITION.',
  damageClause:
    'INCASE OF DAMAGE TO THE CONTAINER, FULL REPAIR COST WILL BE RECOVERED. THE ESTIMATE OF REPAIR GIVEN BY OUR SURVEYORS WILL BE FINAL.',
  totalLossClause: 'INCASE OF TOTAL LOSS OF CONTAINER, REPLACEMENT VALUE WILL BE RECOVERED.',
  labels: {
    date: 'DATE',
    consigneeBlock: 'CONSIGNEE NAME & ADDRESS',
    doNumber: 'DO NUMBER',
    igmNumberDate: 'IGM NUMBER DATE',
    portOfLoading: 'PORT OF LOADING',
    finalDestination: 'FINAL DESTINATION',
    arrivalDate: 'ARRIVAL DATE',
    vesselVoyage: 'VESSEL | VOYAGE',
    itemNumber: 'ITEM NUMBER',
    portOfDischarge: 'PORT OF DISCHARGE',
    destuffingType: 'DESTUFFING TYPE',
    dateOfArrival: 'DATE OF ARRIVAL',
    itemNo: 'ITEM NO',
    placeOfSurvey: 'PLACE OF SURVEY',
  },
  containerColumns: ['CONTAINER NUMBER', 'SHIPMENT TYPE', 'SIZE', 'SEAL NO.', 'NO. PKGS', 'STATUS'],
  cargoColumns: [
    'MARKES AND NUMBERS',
    'NUMBER OF PACKAGES',
    'DESCRIPTION',
    'B/L NUMBER',
    'B/L DATE',
    'GROSS WEIGHT',
  ],
} as const

export const OFFLOADING_STRINGS = {
  title: 'OFF LOADING LETTER',
  acceptParagraph:
    'Kindly accept the following empty containers on arrival into your yard. You are requested to accept the following containers upto the following dates. Please do not offload empty container at yard without re-valid letter.',
  damagedNote:
    'Note : Containers arrived at depot in damaged condition after 10 pm will be subsequently off loaded next morning after carrying out the Survey and settlement.',
  labels: {
    date: 'Date',
    jobNo: 'JOB NO',
    to: 'To',
    attn: 'Attn',
    principal: 'PRINCIPAL',
    mblNo: 'MBL NO',
    hblNo: 'HBL NO',
    product: 'PRODUCT',
    cha: 'CHA',
    consignee: 'Consignee.',
    doType: 'D/O type',
  },
  containerColumns: ['No.', 'Container No.', 'Size', 'Accept Upto'],
} as const
