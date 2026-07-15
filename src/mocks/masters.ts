/* ── MOCK master data ───────────────────────────────────────────
   ⚠ Throwaway demo data. Access only via lib/api or the store. */

import type {
  AgentMaster,
  ChargeCodeMaster,
  Customer,
  DepotMaster,
  VendorMaster,
  VesselMaster,
} from '../lib/types'

export const mockCustomers: Customer[] = [
  { id: 'c1', name: 'ABC Exports Pvt. Ltd.', kind: 'Local' },
  { id: 'c2', name: 'Global Traders', kind: 'Local' },
  { id: 'c3', name: 'Oceanic Imports', kind: 'Local' },
  { id: 'c4', name: 'Bright Logistics', kind: 'Overseas' },
  { id: 'c5', name: 'Swift Elite', kind: 'Local' },
  { id: 'c6', name: 'Transworld Pvt. Ltd.', kind: 'Local' },
  { id: 'c7', name: 'Prime Commodities', kind: 'Overseas' },
]

export const mockAgents: AgentMaster[] = [
  { id: 'a1', name: 'Gulf Star Shipping LLC', country: 'UAE', role: 'destination' },
  { id: 'a2', name: 'Mombasa Freight Kenya', country: 'Kenya', role: 'destination' },
  { id: 'a3', name: 'Persia Marine Services', country: 'Iran', role: 'destination' },
  { id: 'a4', name: 'Chabahar Port Agency', country: 'Iran', role: 'destination' },
  { id: 'a5', name: 'Lion City Logistics', country: 'Singapore', role: 'both' },
  { id: 'a6', name: 'Nhava Sheva Origin Services', country: 'India', role: 'origin' },
]

export const mockVessels: VesselMaster[] = [
  { id: 'v1', name: 'CMA CGM TAIGE', voyageNo: '0FL1E', carrier: 'CMA CGM', pol: 'INNSA', pod: 'JEBEL ALI', etd: '2025-05-12', eta: '2025-05-19' },
  { id: 'v2', name: 'MAERSK NALAF', voyageNo: 'S12E', carrier: 'Maersk', pol: 'INNSA', pod: 'MOMBASA', etd: '2025-05-13', eta: '2025-05-27' },
  { id: 'v3', name: 'MSC ORCHID', voyageNo: 'IV514E', carrier: 'MSC', pol: 'JEBEL ALI', pod: 'INNSA', etd: '2025-05-18', eta: '2025-05-25' },
  { id: 'v4', name: 'ONE HENRY HUDSON', voyageNo: '074E', carrier: 'ONE', pol: 'MOMBASA', pod: 'INNSA', etd: '2025-05-20', eta: '2025-06-03' },
  { id: 'v5', name: 'RMS DENIA', voyageNo: '2305E', carrier: 'RMS', pol: 'INNSA', pod: 'CHABAHAR', etd: '2025-05-21', eta: '2025-05-26' },
  { id: 'v6', name: 'EVER GOLDEN', voyageNo: '120IE', carrier: 'Evergreen', pol: 'SINGAPORE', pod: 'INNSA', etd: '2025-05-22', eta: '2025-05-29' },
]

export const mockVendors: VendorMaster[] = [
  { id: 'vn1', name: 'CMA CGM Agencies India', kind: 'Shipping line' },
  { id: 'vn2', name: 'Bureau Veritas Marine', kind: 'Surveyor' },
  { id: 'vn3', name: 'JNPT Container Freight Station', kind: 'CFS' },
  { id: 'vn4', name: 'Coastal Container Repairs', kind: 'Repair' },
  { id: 'vn5', name: 'Mumbai Port Truckers', kind: 'Trucker' },
  { id: 'vn6', name: 'ClearFast Customs Brokers', kind: 'Broker' },
]

export const mockDepots: DepotMaster[] = [
  { id: 'd1', name: 'Nhava Sheva Empty Yard 1', location: 'Nhava Sheva' },
  { id: 'd2', name: 'Mundra Depot A', location: 'Mundra' },
  { id: 'd3', name: 'Panvel Container Yard', location: 'Panvel' },
  { id: 'd4', name: 'Sai Marine Container Services (NSA Dry)', location: 'Nhava Sheva' },
  { id: 'd5', name: 'Sai Marine Container Services (NSA Reefer)', location: 'Nhava Sheva' },
  { id: 'd6', name: 'Bhavani Empty Depot', location: 'Nhava Sheva' },
  { id: 'd7', name: 'Sai Marine Container Services', location: 'Nhava Sheva' },
  { id: 'd8', name: 'Speedy Multilodes Ltd', location: 'Nhava Sheva' },
  { id: 'd9', name: 'CCIS Keavy Victory Yard', location: 'Nhava Sheva' },
  { id: 'd10', name: 'Iran Depot — BND', location: 'Bandar Abbas' },
  { id: 'd11', name: 'CCIS Bhavani Depot', location: 'Nhava Sheva' },
  { id: 'd12', name: 'KMP Overseas Pvt Ltd', location: 'Mundra' },
  { id: 'd13', name: 'Transworld Empty Park Mundra', location: 'Mundra' },
]

export const mockChargeCodes: ChargeCodeMaster[] = [
  { id: 'cc1', code: 'OFR', name: 'Ocean freight' },
  { id: 'cc2', code: 'THC-O', name: 'Origin local charges' },
  { id: 'cc3', code: 'THC-D', name: 'Destination local charges' },
  { id: 'cc4', code: 'BLF', name: 'BL fee' },
  { id: 'cc5', code: 'DOF', name: 'DO fee' },
  { id: 'cc6', code: 'DET', name: 'Detention' },
  { id: 'cc7', code: 'SUR', name: 'Survey' },
  { id: 'cc8', code: 'MISC', name: 'Miscellaneous' },
]

export const CONTAINER_TYPES = ['20GP', '40GP', '40HC', '20RF', '40RF'] as const
export const PACKAGE_TYPES = ['Pallets', 'Cartons', 'Bags', 'Drums', 'Crates'] as const
