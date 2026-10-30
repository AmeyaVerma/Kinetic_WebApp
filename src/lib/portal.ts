import { supabase } from './supabaseClient'

/**
 * What a portal login is allowed to be.
 *
 * Until now the portal decided whose shipments to show by comparing the
 * booking party's *name* to a `scopeName` field on the signed-in user — a
 * field nothing ever populated. The portal therefore matched nothing real
 * and fell back to showing seeded demo rows held in the browser.
 *
 * The identity now comes from `portal_accounts`, and more importantly the
 * *scoping* no longer happens here at all: row-level security decides what
 * the queries below return. This module only needs to know who you are so
 * the page can say so; if it got that wrong, the database would still not
 * hand over anybody else's rows.
 */

export interface PortalIdentity {
  kind: 'customer' | 'agent'
  partyId: string
  partyName: string
}

export async function loadPortalIdentity(): Promise<PortalIdentity | null> {
  const { data, error } = await supabase
    .from('portal_accounts')
    .select('kind, party_id, parties(legal_name, display_name)')
    .maybeSingle()
  if (error || !data) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const party = (data as any).parties
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kind: (data as any).kind,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    partyId: (data as any).party_id,
    partyName: party?.display_name || party?.legal_name || 'your account',
  }
}

export interface PortalBooking {
  id: string
  bookingRef: string
  direction: 'Export' | 'Import'
  pol: string | null
  pod: string | null
  vesselName: string | null
  voyageNo: string | null
  etd: string | null
  eta: string | null
  containerQty: number | null
  commodity: string | null
  cancelled: boolean
}

export interface PortalMilestone {
  bookingId: string
  key: string
  completedAt: string | null
}

export interface PortalDocument {
  id: string
  bookingId: string
  docType: string
  status: string
  storagePath: string | null
  uploadedAt: string | null
}

export interface PortalInvoice {
  invoiceNo: string
  invoiceDate: string | null
  dueDate: string | null
  totalInr: number
  status: string
  docKind: string | null
}

/**
 * Everything the portal shows, in one pass.
 *
 * No `.eq()` on a party anywhere: the policies added in migrations 0074 and
 * 0075 already restrict every one of these to the signed-in portal account's
 * own rows. Filtering again in the client would look like security while
 * being nothing of the kind — and would hide a policy mistake rather than
 * expose it.
 */
export async function loadPortalData() {
  const [bookingsRes, milestonesRes, documentsRes, invoicesRes] = await Promise.all([
    supabase
      .from('bookings')
      .select(
        'id, booking_ref, direction, pol, pod, vessel_name, voyage_no, etd, eta, container_qty, commodity, cancelled',
      )
      .order('created_at', { ascending: false }),
    supabase.from('booking_milestones').select('booking_id, key, completed_at'),
    supabase
      .from('booking_documents')
      .select('id, booking_id, doc_type, status, storage_path, uploaded_at')
      .order('uploaded_at', { ascending: false }),
    supabase
      .from('invoices')
      .select('invoice_no, invoice_date, due_date, total_inr, status, doc_kind')
      .order('invoice_date', { ascending: false }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookings: PortalBooking[] = ((bookingsRes.data as any[]) ?? []).map((r) => ({
    id: r.id,
    bookingRef: r.booking_ref,
    direction: r.direction,
    pol: r.pol,
    pod: r.pod,
    vesselName: r.vessel_name,
    voyageNo: r.voyage_no,
    etd: r.etd,
    eta: r.eta,
    containerQty: r.container_qty,
    commodity: r.commodity,
    cancelled: !!r.cancelled,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const milestones: PortalMilestone[] = ((milestonesRes.data as any[]) ?? []).map((r) => ({
    bookingId: r.booking_id,
    key: r.key,
    completedAt: r.completed_at,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const documents: PortalDocument[] = ((documentsRes.data as any[]) ?? []).map((r) => ({
    id: r.id,
    bookingId: r.booking_id,
    docType: r.doc_type,
    status: r.status,
    storagePath: r.storage_path,
    uploadedAt: r.uploaded_at,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoices: PortalInvoice[] = ((invoicesRes.data as any[]) ?? []).map((r) => ({
    invoiceNo: r.invoice_no,
    invoiceDate: r.invoice_date,
    dueDate: r.due_date,
    totalInr: Number(r.total_inr ?? 0),
    status: r.status,
    docKind: r.doc_kind,
  }))

  return { bookings, milestones, documents, invoices }
}
