import { useCallback, useEffect, useMemo, useState } from 'react'
import { PDFViewer, pdf } from '@react-pdf/renderer'
import { AlertTriangle, FileText, History } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import type { Booking } from '../../lib/types'
import { CroDocument } from '../../lib/pdf/templates/CroDocument'
import {
  OnboardDocument,
  CanDocument,
  DeliveryOrderDocument,
  OffLoadingDocument,
} from '../../lib/pdf/templates/OperationalDocs'
import {
  buildOpDocSnapshot,
  equipmentGroups,
  missingDocFields,
  type DocCompany,
  type OpDocSnapshot,
  type OpDocType,
} from '../../lib/pdf/opDocSnapshot'

/**
 * The Documents tab (CR-02): the BL plus the five operational documents in
 * one place, each with preview, editable fields, versioned PDF and history.
 *
 * This sits ALONGSIDE the existing Documents tab rather than replacing it.
 * That tab tracks thirteen uploaded files (VGM, CLP, Shipping Bill, COO,
 * MSDS and the rest) and is shared with Freight Forwarding; folding it into
 * six generator cards would silently drop seven documents nobody asked to
 * lose and would ripple into a module CR-02 never mentions.
 *
 * Edits here stay on the document and never write back to the booking
 * (brief A6) -- the snapshot carries them, the booking is untouched.
 */

type CardKey = OpDocType | 'bl'

const CARDS: {
  key: CardKey
  label: string
  direction: 'Export' | 'Import' | 'Either'
  goesTo: string
}[] = [
  { key: 'bl', label: 'Bill of Lading (HBL)', direction: 'Either', goesTo: 'Shipper / consignee' },
  { key: 'cro', label: 'Container Release Order', direction: 'Export', goesTo: 'Empty depot / CY' },
  { key: 'onboard', label: 'Onboard Confirmation', direction: 'Either', goesTo: 'Shipper or consignee' },
  { key: 'can', label: 'Cargo Arrival Notice', direction: 'Import', goesTo: 'Consignee' },
  { key: 'do', label: 'Delivery Order', direction: 'Import', goesTo: 'Terminal / CFS / CHA' },
  { key: 'offloading', label: 'Off Loading Letter', direction: 'Import', goesTo: 'Empty depot' },
]

/** Fields offered for editing per document, beyond what the booking fills. */
const EDITABLE: Record<OpDocType, { key: keyof OpDocSnapshot; label: string }[]> = {
  cro: [
    { key: 'depotName', label: 'Depot name' },
    { key: 'depotAddress', label: 'Depot address' },
    { key: 'depotAttn', label: 'Depot attn' },
    { key: 'depotPhone', label: 'Depot phone' },
    { key: 'surveyorName', label: 'Surveyor name' },
    { key: 'surveyorAddress', label: 'Surveyor address' },
    { key: 'surveyorPhone', label: 'Surveyor phone' },
    { key: 'validTill', label: 'Valid till' },
  ],
  onboard: [
    { key: 'sob', label: 'Shipped on board date' },
    { key: 'customerReference', label: "Customer's booking reference" },
    { key: 'netWeightKgs', label: 'Net weight (kgs)' },
    { key: 'cfs', label: 'CFS' },
    { key: 'shipmentTerms', label: 'Shipment terms' },
    { key: 'sbNumber', label: 'SB number' },
    { key: 'sbDate', label: 'SB date' },
    { key: 'hblDate', label: 'HBL date' },
  ],
  can: [
    { key: 'shippingLine', label: 'Shipping line' },
    { key: 'customerReference', label: "Customer's booking reference" },
    { key: 'netWeightKgs', label: 'Net weight (kgs)' },
    { key: 'cfs', label: 'CFS' },
    { key: 'igmNo', label: 'IGM number' },
    { key: 'igmDate', label: 'IGM date' },
    { key: 'itemNumber', label: 'Item number' },
    { key: 'shipmentTerms', label: 'Shipment terms' },
  ],
  do: [
    { key: 'doNumber', label: 'DO number' },
    { key: 'doTo', label: 'To' },
    { key: 'chaName', label: 'CHA' },
    { key: 'validUpto', label: 'Valid upto' },
    { key: 'arrivalDate', label: 'Arrival date' },
    { key: 'destuffingType', label: 'Destuffing type' },
    { key: 'placeOfSurvey', label: 'Place of survey' },
    { key: 'returnDepot', label: 'Return empty at (depot)' },
    { key: 'igmNo', label: 'IGM number' },
    { key: 'itemNumber', label: 'Item number' },
  ],
  offloading: [
    { key: 'depotName', label: 'Depot name' },
    { key: 'depotAddress', label: 'Depot address' },
    { key: 'depotAttn', label: 'Depot attn' },
    { key: 'chaName', label: 'CHA' },
    { key: 'doType', label: 'D/O type' },
  ],
}

type VersionRow = {
  id: string
  doc_type: string
  equipment_group: string
  version: number
  file_name: string | null
  storage_path: string | null
  generated_at: string
}

export function DocumentMakerTab({
  booking,
  onOpenBl,
}: {
  booking: Booking
  onOpenBl: () => void
}) {
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const role = viewAsRole ?? user?.role
  const canWrite = role === 'admin' || role === 'ops'
  const dbId = booking.dbId

  const [company, setCompany] = useState<DocCompany | null>(null)
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [blSummary, setBlSummary] = useState<{ bl_number: string; bl_type: string; status: string } | null>(null)
  const [open, setOpen] = useState<{ type: OpDocType; group: string } | null>(null)
  const [edits, setEdits] = useState<Partial<OpDocSnapshot>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!dbId) return
    const [{ data: cs }, { data: vers }, { data: bl }] = await Promise.all([
      supabase.from('company_settings').select('*').limit(1).maybeSingle(),
      supabase
        .from('document_versions')
        .select('id, doc_type, equipment_group, version, file_name, storage_path, generated_at')
        .eq('booking_id', dbId)
        .order('version', { ascending: false }),
      supabase.from('bl_state').select('bl_number, bl_type, status').eq('booking_id', dbId).maybeSingle(),
    ])
    if (cs) {
      const r = cs as Record<string, string>
      setCompany({
        legalName: r.legal_name,
        principalName: r.principal_name,
        corporateAddress: r.corporate_address,
        gstAddress: r.gst_address,
        tel: r.tel,
        email: r.email,
        website: r.website,
      })
    }
    setVersions((vers as VersionRow[]) ?? [])
    setBlSummary((bl as { bl_number: string; bl_type: string; status: string } | null) ?? null)
  }, [dbId])

  useEffect(() => {
    load()
  }, [load])

  const groups = useMemo(() => equipmentGroups(booking), [booking])

  const snapshot = useMemo(() => {
    if (!open || !company) return null
    return buildOpDocSnapshot({
      docType: open.type,
      booking,
      company,
      equipmentGroup: open.group,
      printedBy: user?.name ?? '',
      overrides: edits,
    })
  }, [open, company, booking, edits, user])

  const latestFor = (type: CardKey, group = '') =>
    versions.find((v) => v.doc_type === type && (v.equipment_group ?? '') === group)

  const renderDoc = (snap: OpDocSnapshot) => {
    switch (snap.docType) {
      case 'cro':
        return <CroDocument snapshot={snap} />
      case 'onboard':
        return <OnboardDocument snapshot={snap} />
      case 'can':
        return <CanDocument snapshot={snap} />
      case 'do':
        return <DeliveryOrderDocument snapshot={snap} />
      case 'offloading':
        return <OffLoadingDocument snapshot={snap} />
    }
  }

  const fileNameFor = (snap: OpDocSnapshot) => {
    const code =
      snap.docType === 'cro'
        ? 'CRO_' + snap.equipmentGroup
        : snap.docType === 'do'
          ? 'DO'
          : snap.docType === 'can'
            ? 'CAN'
            : snap.docType === 'onboard'
              ? 'ONBOARD'
              : 'OFFLOADING'
    return booking.bookingRef + '_' + code + '.pdf'
  }

  const handleGenerate = async () => {
    if (!snapshot || !dbId) return
    setBusy(true)
    setError(null)
    try {
      const group = open?.group ?? ''
      const last = versions.find(
        (v) => v.doc_type === snapshot.docType && (v.equipment_group ?? '') === group,
      )
      const version = (last?.version ?? 0) + 1
      const fileName = fileNameFor(snapshot)

      // Store the rendered PDF so a reprint is byte-identical to what was
      // sent, rather than re-rendered from a template that may have changed.
      const blob = await pdf(renderDoc(snapshot)!).toBlob()
      const path = dbId + '/' + snapshot.docType + '/' + version + '_' + fileName
      const { error: upErr } = await supabase.storage
        .from('generated-documents')
        .upload(path, blob, { contentType: 'application/pdf', upsert: false })
      if (upErr) throw new Error(upErr.message)

      // Who generated it is part of the record, not an optional extra: the
      // audit requirement is who/when/which version, and a null actor makes
      // the row unattributable after the fact.
      const { data: auth } = await supabase.auth.getUser()

      const { error: insErr } = await supabase.from('document_versions').insert({
        booking_id: dbId,
        doc_type: snapshot.docType,
        equipment_group: group,
        version,
        snapshot: snapshot as unknown as Record<string, unknown>,
        file_name: fileName,
        storage_path: path,
        generated_by: auth?.user?.id ?? null,
      })
      if (insErr) throw new Error(insErr.message)

      // Hand the user the file they just generated.
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)

      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate')
    }
    setBusy(false)
  }

  if (!dbId) {
    return (
      <Card className="p-4 text-sm text-muted">
        This booking is not saved to the database yet, so documents cannot be
        generated or versioned.
      </Card>
    )
  }

  const missing = snapshot ? missingDocFields(snapshot) : []

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg">Document Maker</h2>
        <p className="text-sm text-muted">
          Generated from this booking and the masters. Every field stays
          editable on the document; edits never change the booking.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => {
          // A direction mismatch warns, never blocks (brief 8.1).
          const mismatch =
            card.direction !== 'Either' && card.direction !== booking.direction

          if (card.key === 'bl') {
            return (
              <Card key="bl" className="space-y-2 p-3">
                <div className="flex items-start gap-2">
                  <FileText size={16} className="mt-0.5 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{card.label}</p>
                    <p className="text-xs text-muted">{card.goesTo}</p>
                  </div>
                </div>
                {blSummary?.bl_number ? (
                  <p className="font-mono text-xs">
                    {blSummary.bl_number} · {blSummary.bl_type} · {blSummary.status}
                  </p>
                ) : (
                  <p className="text-xs text-muted">No BL created yet.</p>
                )}
                {/* The BL is the same record as the BL section, not a copy. */}
                <Button size="sm" variant="ghost" onClick={onOpenBl}>
                  Open BL section
                </Button>
              </Card>
            )
          }

          const type = card.key as OpDocType
          const cardGroups = type === 'cro' && groups.length > 0 ? groups.map((g) => g.code) : ['']

          return cardGroups.map((group) => {
            const latest = latestFor(type, group)
            return (
              <Card key={type + group} className="space-y-2 p-3">
                <div className="flex items-start gap-2">
                  <FileText size={16} className="mt-0.5 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {card.label}
                      {group ? ' · ' + group : ''}
                    </p>
                    <p className="text-xs text-muted">{card.goesTo}</p>
                  </div>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] uppercase text-muted">
                    {card.direction}
                  </span>
                </div>

                {mismatch && (
                  <p className="flex items-start gap-1 text-xs text-amber-700">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    Usually an {card.direction.toLowerCase()} document; this booking is{' '}
                    {booking.direction.toLowerCase()}.
                  </p>
                )}

                <p className="text-xs text-muted">
                  {latest
                    ? 'v' + latest.version + ' · ' + new Date(latest.generated_at).toLocaleDateString()
                    : 'Not generated yet'}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setOpen({ type, group })
                      setEdits({})
                      setError(null)
                    }}
                  >
                    Open
                  </Button>
                  {latest && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <History size={12} /> {versions.filter((v) => v.doc_type === type && (v.equipment_group ?? '') === group).length}
                    </span>
                  )}
                </div>
              </Card>
            )
          })
        })}
      </div>

      {open && snapshot && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <h3 className="font-display">
              {CARDS.find((c) => c.key === open.type)?.label}
              {open.group ? ' · ' + open.group : ''}
            </h3>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setOpen(null)}>
              Close
            </Button>
          </div>

          {missing.length > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-amber-900">
                <AlertTriangle size={15} /> Missing fields — you can still generate
              </p>
              <ul className="mt-1 list-inside list-disc text-amber-900">
                {missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {EDITABLE[open.type].map((f) => (
              <label key={String(f.key)} className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-wide text-muted">
                  {f.label}
                </span>
                <TextInput
                  value={String(edits[f.key] ?? snapshot[f.key] ?? '')}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setEdits((d) => ({ ...d, [f.key]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerate} disabled={!canWrite || busy}>
              {busy ? 'Generating…' : 'Generate & download'}
            </Button>
          </div>

          <VersionHistory
            rows={versions.filter(
              (v) => v.doc_type === open.type && (v.equipment_group ?? '') === open.group,
            )}
          />

          <PDFViewer className="min-h-[70vh] w-full rounded border" showToolbar>
            {renderDoc(snapshot)!}
          </PDFViewer>
        </Card>
      )}
    </div>
  )
}

function VersionHistory({ rows }: { rows: VersionRow[] }) {
  if (rows.length === 0) return null
  return (
    <div className="rounded border border-line">
      <p className="border-b border-line p-2 font-mono text-[10px] uppercase tracking-wide text-muted">
        Version history
      </p>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2 p-2 text-sm">
            <span className="font-mono">v{r.version}</span>
            <span className="truncate text-muted">{r.file_name}</span>
            <span className="ml-auto text-xs text-muted">
              {new Date(r.generated_at).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
