import { useEffect } from 'react'
import { useDataStore } from '../../store/useDataStore'
import { useCurrentUser } from '../../store/useAuthStore'
import { DocumentRow } from './DocumentsTab'
import type { DocType, FfShipment } from '../../lib/types'

/**
 * Documents on an RKS freight-forwarding shipment.
 *
 * This tab used to carry a copy of the NVOCC BL panel, including a "Create BL
 * draft" button that allocated a real BL number. RKS is a forwarder, not a
 * carrier of record: it never issues a Bill of Lading, so that panel promised
 * a document the business does not produce -- and the draft it made could not
 * be saved anyway, since bl_state is keyed to bookings rather than shipments.
 *
 * What a forwarder has instead is the carrier's paperwork, received and filed.
 * So the BL panel is gone, along with the BL, SOB and CRO rows that came with
 * it, and the carrier's own master document takes their place.
 */

/** Mode decides which carrier document the shipment should carry. */
const CARRIER_DOC: Record<string, DocType> = {
  Air: 'AWB',
  Road: 'LR',
}

function sequenceFor(mode: string | null | undefined): { type: DocType; trigger: string }[] {
  const carrier = CARRIER_DOC[mode ?? ''] ?? 'Master BL'
  const carrierTrigger =
    carrier === 'AWB'
      ? 'Air waybill from the airline, once the booking is confirmed'
      : carrier === 'LR'
        ? 'Lorry receipt from the trucker at pickup'
        : "Carrier's master Bill of Lading, received after the vessel sails"

  const containerised = mode !== 'Air' && mode !== 'Road'
  return [
    { type: carrier, trigger: carrierTrigger },
    // The VGM and the container load plan only exist where there is a
    // container, so an air or road shipment never asks for them.
    ...(containerised
      ? ([
          { type: 'VGM', trigger: 'Filed before cut-off' },
          { type: 'CLP', trigger: 'Submitted at gate-in / stuffing confirmation' },
        ] as { type: DocType; trigger: string }[])
      : []),
    { type: 'Shipping Bill', trigger: 'Filed with customs before departure' },
    { type: 'DO', trigger: 'Import only — issued after arrival and payment' },
    { type: 'CAN', trigger: 'Import only — sent to consignee on arrival' },
    { type: 'Commercial Invoice + Packing List', trigger: 'Customer uploads for customs compliance' },
    { type: 'Certificate of Origin', trigger: 'Customer uploads where required' },
    { type: 'MSDS', trigger: 'Required for hazardous cargo' },
    { type: 'Non-Haz Declaration', trigger: 'Required to declare cargo as non-hazardous' },
  ]
}

export function FfDocumentsTab({ shipment }: { shipment: FfShipment }) {
  const { documents, fetchFfDocuments, uploadFfDocumentFile, getFfDocumentUrl } = useDataStore()
  const currentUser = useCurrentUser()

  useEffect(() => {
    fetchFfDocuments(shipment.id)
  }, [fetchFfDocuments, shipment.id])

  const docs = documents.filter((d) => d.bookingId === shipment.id)
  const sequence = sequenceFor(shipment.mode)

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        Documents — sequence and trigger
      </p>
      {!shipment.dbId && (
        <p className="mb-3 rounded-btn border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
          This is demo data, not a saved shipment — real file upload is unavailable here.
          Create a new FF shipment to try it.
        </p>
      )}
      <div className="space-y-2">
        {sequence.map((d, i) => {
          const uploaded = docs.find((x) => x.docType === d.type)
          return (
            <DocumentRow
              key={d.type}
              index={i}
              docType={d.type}
              trigger={d.trigger}
              uploaded={uploaded}
              canUpload={!!shipment.dbId}
              onUpload={(file) => uploadFfDocumentFile(shipment.id, d.type, currentUser?.name ?? 'Ops', file)}
              onView={uploaded?.storagePath ? () => getFfDocumentUrl(uploaded.storagePath!) : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}
