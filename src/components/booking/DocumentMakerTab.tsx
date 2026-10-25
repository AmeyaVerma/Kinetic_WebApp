import { useCallback, useEffect, useMemo, useState } from 'react'
import { PDFViewer, pdf } from '@react-pdf/renderer'
import { AlertTriangle, FileText, History } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Select } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import type { Booking } from '../../lib/types'
import { BlDocument, BlBackside } from '../../lib/pdf/templates/BlFrontSheet'
import { ContainerAttachSheet } from '../../lib/pdf/templates/ContainerAttachSheet'
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
  type ResolvedMasters,
} from '../../lib/pdf/opDocSnapshot'
import { buildBlSnapshot, type CompanySettingsLite } from '../../lib/pdf/buildBlSnapshot'
import { missingBlFields, formatBlNumber, fyCodeFor, type BlSnapshot } from '../../lib/pdf/blSnapshot'
import { BL_TYPE_LABEL, printsBackside, type BlType } from '../../lib/pdf/strings/bl'
import { SigningPanel } from './SigningPanel'

/**
 * The Documents tab: every document this booking can produce, in one place.
 *
 * Siddharth's two rules shape this file.
 *
 * First, there is no separate BL section. The BL is created here, with
 * Generate BL Draft, and lives alongside the five operational documents
 * rather than in a tab of its own.
 *
 * Second, nothing is typed onto a document. Every value comes from the
 * booking or from a master the booking points at, so a blank on a document
 * is a blank on the booking — and the fix is made there, once, where every
 * other document picks it up too. That is why this file has no editable
 * fields and instead sends you to the booking section that owns the gap.
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

/** Which booking tab a missing value is filled in on. */
const FIX_IN: Record<string, string> = {
  'Depot (To)': 'Parties',
  Surveyor: 'Parties',
  CHA: 'Parties',
  Shipper: 'Parties',
  Consignee: 'Parties',
  'Equipment group': 'Container info',
  'Port of discharge': 'Shipment details',
  Vessel: 'Shipment details',
  'Shipped on board date': 'Shipment details',
  'B/L number': 'Documents — generate the BL first',
  'Valid upto date': 'Shipment details',
  'DO number': 'Shipment details',
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

type BlRow = {
  bl_number: string | null
  bl_type: BlType
  print_mode: 'Original' | 'Scan'
  status: 'Draft' | 'Issued'
  issued_at: string | null
  mbl_number: string | null
  use_container_sheet: boolean
}

const BL_TYPES: BlType[] = ['Draft', 'Original', 'Surrender', 'Seaway', 'RFS']

export function DocumentMakerTab({ booking }: { booking: Booking }) {
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const role = viewAsRole ?? user?.role
  const canWrite = role === 'admin' || role === 'ops'
  const dbId = booking.dbId

  const [company, setCompany] = useState<CompanySettingsLite | null>(null)
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [bl, setBl] = useState<BlRow | null>(null)
  const [masters, setMasters] = useState<ResolvedMasters>({})
  const [issuedSnapshot, setIssuedSnapshot] = useState<BlSnapshot | null>(null)
  // Signed URL for the BL backside artwork. The bucket is private; a narrow
  // policy lets this one file be read so the preview shows the same page
  // print appends.
  const [backsideSrc, setBacksideSrc] = useState<string | undefined>(undefined)
  const [open, setOpen] = useState<{ type: CardKey; group: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!dbId) return
    const [{ data: cs }, { data: vers }, { data: blRow }] = await Promise.all([
      supabase.from('company_settings').select('*').limit(1).maybeSingle(),
      supabase
        .from('document_versions')
        .select('id, doc_type, equipment_group, version, file_name, storage_path, generated_at')
        .eq('booking_id', dbId)
        .order('version', { ascending: false }),
      supabase.from('bl_state').select('*').eq('booking_id', dbId).maybeSingle(),
    ])
    setCompany((cs as CompanySettingsLite | null) ?? null)

    const backsidePath = (cs as unknown as { bl_backside_path?: string } | null)?.bl_backside_path
    if (backsidePath) {
      const { data: signed } = await supabase.storage
        .from('company-assets')
        .createSignedUrl(backsidePath, 3600)
      setBacksideSrc(signed?.signedUrl)
    } else {
      setBacksideSrc(undefined)
    }
    setVersions((vers as VersionRow[]) ?? [])
    setBl((blRow as BlRow | null) ?? null)

    if (blRow && (blRow as BlRow).status === 'Issued') {
      const { data: ver } = await supabase
        .from('document_versions')
        .select('snapshot')
        .eq('booking_id', dbId)
        .eq('doc_type', 'bl')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      setIssuedSnapshot((ver?.snapshot as BlSnapshot) ?? null)
    } else {
      setIssuedSnapshot(null)
    }

    // Resolve the masters the booking points at, so the documents can print
    // their full address blocks.
    const [depot, returnDepot, surveyor, cha] = await Promise.all([
      booking.depotId
        ? supabase.from('empty_depots').select('*').eq('id', booking.depotId).maybeSingle()
        : Promise.resolve({ data: null }),
      booking.returnDepotId
        ? supabase.from('empty_depots').select('*').eq('id', booking.returnDepotId).maybeSingle()
        : Promise.resolve({ data: null }),
      booking.surveyorRefId
        ? supabase.from('surveyors').select('*').eq('id', booking.surveyorRefId).maybeSingle()
        : Promise.resolve({ data: null }),
      booking.chaId
        ? supabase.from('chas').select('*').eq('id', booking.chaId).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    setMasters({
      depot: depot.data as ResolvedMasters['depot'],
      returnDepot: returnDepot.data as ResolvedMasters['returnDepot'],
      surveyor: surveyor.data as ResolvedMasters['surveyor'],
      cha: cha.data as ResolvedMasters['cha'],
    })
  }, [dbId, booking.depotId, booking.returnDepotId, booking.surveyorRefId, booking.chaId])

  useEffect(() => {
    load()
  }, [load])

  const groups = useMemo(() => equipmentGroups(booking), [booking])

  // Memoised: a fresh object each render would make the snapshot below
  // rebuild on every render, which re-renders the PDF preview continuously.
  const docCompany: DocCompany | null = useMemo(
    () =>
      company
        ? {
            legalName: company.legal_name,
            principalName: (company as unknown as { principal_name: string }).principal_name,
            corporateAddress: company.corporate_address,
            gstAddress: (company as unknown as { gst_address: string }).gst_address,
            tel: company.tel,
            email: company.email,
            website: company.website,
          }
        : null,
    [company],
  )

  const blSnapshot = useMemo(() => {
    if (!company) return null
    if (issuedSnapshot) return issuedSnapshot
    return buildBlSnapshot({
      booking,
      company,
      blNumber: bl?.bl_number ?? '',
      blType: bl?.bl_type ?? 'Draft',
      printMode: bl?.print_mode ?? 'Original',
      useContainerSheet: bl?.use_container_sheet ?? false,
      issuedAt: bl?.issued_at ?? null,
    })
  }, [booking, company, bl, issuedSnapshot])

  const opSnapshot = useMemo(() => {
    if (!open || open.type === 'bl' || !docCompany) return null
    return buildOpDocSnapshot({
      docType: open.type,
      booking,
      company: docCompany,
      equipmentGroup: open.group,
      printedBy: user?.name ?? '',
      masters,
    })
  }, [open, docCompany, booking, masters, user])

  const latestFor = (type: CardKey, group = '') =>
    versions.find((v) => v.doc_type === type && (v.equipment_group ?? '') === group)

  const renderOp = (snap: OpDocSnapshot) => {
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

  const codeFor = (snap: OpDocSnapshot) =>
    snap.docType === 'cro'
      ? 'CRO_' + snap.equipmentGroup
      : snap.docType === 'do'
        ? 'DO'
        : snap.docType === 'can'
          ? 'CAN'
          : snap.docType === 'onboard'
            ? 'ONBOARD'
            : 'OFFLOADING'

  /** Allocates the permanent BL number and creates the Draft. */
  const handleGenerateBl = async () => {
    if (!dbId) return
    setBusy(true)
    setError(null)
    const { data: seq, error: seqErr } = await supabase.rpc('next_document_number', {
      p_series: 'nvocc_bl',
    })
    if (seqErr) {
      setError(seqErr.message)
      setBusy(false)
      return
    }
    const blNumber = formatBlNumber(fyCodeFor(), seq as number)
    const blColumns = { bl_number: blNumber, bl_type: 'Draft' as const, status: 'Draft' as const }
    const { data: existing } = await supabase
      .from('bl_state')
      .select('booking_id')
      .eq('booking_id', dbId)
      .maybeSingle()

    const { error: upErr } = existing
      ? await supabase.from('bl_state').update(blColumns).eq('booking_id', dbId)
      : await supabase
          .from('bl_state')
          .insert({ booking_id: dbId, lifecycle: 'Draft', current_fields: {}, ...blColumns })

    if (upErr) setError(upErr.message)
    else if (!booking.hblNo) {
      await supabase.from('bookings').update({ hbl_no: blNumber }).eq('id', dbId)
    }
    setBusy(false)
    await load()
    setOpen({ type: 'bl', group: '' })
  }

  const patchBl = async (changes: Partial<BlRow>) => {
    if (!dbId) return
    setBusy(true)
    const { error: err } = await supabase.from('bl_state').update(changes).eq('booking_id', dbId)
    if (err) setError(err.message)
    setBusy(false)
    load()
  }

  const storeVersion = async (
    docType: string,
    group: string,
    snapshot: unknown,
    fileName: string,
    blob: Blob,
  ) => {
    const last = versions.find((v) => v.doc_type === docType && (v.equipment_group ?? '') === group)
    const version = (last?.version ?? 0) + 1
    const path = dbId + '/' + docType + '/' + version + '_' + fileName
    const { error: upErr } = await supabase.storage
      .from('generated-documents')
      .upload(path, blob, { contentType: 'application/pdf', upsert: false })
    if (upErr) throw new Error(upErr.message)

    const { data: auth } = await supabase.auth.getUser()
    const { error: insErr } = await supabase.from('document_versions').insert({
      booking_id: dbId,
      doc_type: docType,
      equipment_group: group,
      version,
      snapshot: snapshot as Record<string, unknown>,
      file_name: fileName,
      storage_path: path,
      generated_by: auth?.user?.id ?? null,
    })
    if (insErr) throw new Error(insErr.message)
    return version
  }

  const download = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleGenerateOp = async () => {
    if (!opSnapshot || !dbId || !open) return
    setBusy(true)
    setError(null)
    try {
      const fileName = booking.bookingRef + '_' + codeFor(opSnapshot) + '.pdf'
      const blob = await pdf(renderOp(opSnapshot)!).toBlob()
      await storeVersion(opSnapshot.docType, open.group, opSnapshot, fileName, blob)
      download(blob, fileName)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate')
    }
    setBusy(false)
  }

  const handleIssueBl = async () => {
    if (!blSnapshot || !dbId || !bl) return
    setBusy(true)
    setError(null)
    try {
      const fileName = blSnapshot.blNumber + '_' + bl.bl_type.toUpperCase() + '.pdf'
      const blob = await pdf(<BlDocument snapshot={blSnapshot} backsideSrc={backsideSrc} />).toBlob()
      await storeVersion('bl', '', blSnapshot, fileName, blob)
      await supabase
        .from('bl_state')
        .update({ status: 'Issued', issued_at: new Date().toISOString() })
        .eq('booking_id', dbId)
      download(blob, fileName)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not issue')
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

  const blMissing = blSnapshot ? missingBlFields(blSnapshot) : []
  const opMissing = opSnapshot ? missingDocFields(opSnapshot) : []
  const blIssued = bl?.status === 'Issued'

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg">Documents</h2>
        <p className="text-sm text-muted">
          Generated from this booking. Every value comes from the booking or
          its masters — to change what prints, change it on the booking.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => {
          const mismatch = card.direction !== 'Either' && card.direction !== booking.direction

          if (card.key === 'bl') {
            return (
              <Card key="bl" className="space-y-2 p-3">
                <CardHead card={card} mismatch={false} />
                {bl?.bl_number ? (
                  <>
                    <p className="font-mono text-xs">{bl.bl_number}</p>
                    <p className="text-xs text-muted">
                      {BL_TYPE_LABEL[bl.bl_type]} · {bl.status}
                    </p>
                    <Button size="sm" variant="ghost" onClick={() => setOpen({ type: 'bl', group: '' })}>
                      Open
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted">
                      Not created. Generating allocates a permanent MTD number.
                    </p>
                    <Button size="sm" onClick={handleGenerateBl} disabled={!canWrite || busy}>
                      {busy ? 'Generating…' : 'Generate BL Draft'}
                    </Button>
                  </>
                )}
              </Card>
            )
          }

          const type = card.key as OpDocType
          const cardGroups = type === 'cro' && groups.length > 0 ? groups.map((g) => g.code) : ['']

          return cardGroups.map((group) => {
            const latest = latestFor(type, group)
            return (
              <Card key={type + group} className="space-y-2 p-3">
                <CardHead card={card} mismatch={mismatch} group={group} direction={booking.direction} />
                <p className="text-xs text-muted">
                  {latest
                    ? 'v' + latest.version + ' · ' + new Date(latest.generated_at).toLocaleDateString()
                    : 'Not generated yet'}
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setOpen({ type, group })}>
                    Open
                  </Button>
                  {latest && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <History size={12} />
                      {versions.filter((v) => v.doc_type === type && (v.equipment_group ?? '') === group).length}
                    </span>
                  )}
                </div>
              </Card>
            )
          })
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {open?.type === 'bl' && bl?.bl_number && blSnapshot && (
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted">MTD Number</p>
              <p className="font-mono text-base">{bl.bl_number}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted">BL Type</p>
              <Select
                value={bl.bl_type}
                disabled={!canWrite || blIssued || busy}
                onChange={(e) => patchBl({ bl_type: e.target.value as BlType })}
              >
                {BL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {BL_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </div>
            {bl.bl_type === 'Original' && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Print mode</p>
                <Select
                  value={bl.print_mode}
                  disabled={!canWrite || busy}
                  onChange={(e) => patchBl({ print_mode: e.target.value as 'Original' | 'Scan' })}
                >
                  <option value="Original">Original (colour, 3 originals)</option>
                  <option value="Scan">Scan Copy (black and white)</option>
                </Select>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bl.use_container_sheet}
                disabled={!canWrite || blIssued || busy}
                onChange={(e) => patchBl({ use_container_sheet: e.target.checked })}
              />
              Use container attach sheet
            </label>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setOpen(null)}>
              Close
            </Button>
          </div>

          <MissingList items={blMissing} blocking />

          {printsBackside(bl.bl_type) && !backsideSrc && (
            <p className="rounded border border-line bg-surface-2 p-3 text-sm text-muted">
              No BL backside artwork uploaded, so this type cannot print a
              complete document. Add it under Master Data → Company settings.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={async () => {
                const blob = await pdf(<BlDocument snapshot={blSnapshot} backsideSrc={backsideSrc} />).toBlob()
                download(blob, bl.bl_number + '_' + bl.bl_type.toUpperCase() + '.pdf')
              }}
            >
              Print BL
            </Button>
            {printsBackside(bl.bl_type) && (
              <Button
                variant="ghost"
                onClick={async () => {
                  const { Document } = await import('@react-pdf/renderer')
                  const blob = await pdf(
                    <Document title={bl.bl_number + ' backside'}>
                      <BlBackside scan={bl.print_mode === 'Scan'} src={backsideSrc} />
                    </Document>,
                  ).toBlob()
                  download(blob, bl.bl_number + '_BACKSIDE.pdf')
                }}
              >
                Backside
              </Button>
            )}
            {blSnapshot.containers.length > 0 && (
              <Button
                variant="ghost"
                onClick={async () => {
                  const blob = await pdf(<ContainerAttachSheet snapshot={blSnapshot} />).toBlob()
                  download(blob, bl.bl_number + '_CONTAINER_SHEET.pdf')
                }}
              >
                Container attach sheet
              </Button>
            )}
            {!blIssued && (
              <Button
                onClick={handleIssueBl}
                disabled={!canWrite || busy || blMissing.length > 0 || bl.bl_type === 'Draft'}
                title={bl.bl_type === 'Draft' ? 'Choose a type other than Draft to issue' : undefined}
              >
                Issue BL
              </Button>
            )}
          </div>

          <SigningPanel
            snapshot={blSnapshot}
            blNumber={bl.bl_number}
            blType={bl.bl_type}
            bookingId={dbId}
            isAdmin={role === 'admin'}
          />

          <VersionHistory rows={versions.filter((v) => v.doc_type === 'bl')} />

          <PDFViewer className="min-h-[70vh] w-full rounded border" showToolbar>
            <BlDocument snapshot={blSnapshot} backsideSrc={backsideSrc} />
          </PDFViewer>
        </Card>
      )}

      {open && open.type !== 'bl' && opSnapshot && (
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

          <MissingList items={opMissing} />

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerateOp} disabled={!canWrite || busy}>
              {busy ? 'Generating…' : 'Generate & download'}
            </Button>
          </div>

          <VersionHistory
            rows={versions.filter(
              (v) => v.doc_type === open.type && (v.equipment_group ?? '') === open.group,
            )}
          />

          <PDFViewer className="min-h-[70vh] w-full rounded border" showToolbar>
            {renderOp(opSnapshot)!}
          </PDFViewer>
        </Card>
      )}
    </div>
  )
}

function CardHead({
  card,
  mismatch,
  group,
  direction,
}: {
  card: { label: string; direction: string; goesTo: string }
  mismatch: boolean
  group?: string
  direction?: string
}) {
  return (
    <>
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
          {String(direction).toLowerCase()}.
        </p>
      )}
    </>
  )
}

/**
 * Missing values point at the booking section that owns them, because that
 * is where they are fixed — there is nowhere on the document to type them.
 */
function MissingList({ items, blocking = false }: { items: string[]; blocking?: boolean }) {
  if (items.length === 0) return null
  return (
    <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium text-amber-900">
        <AlertTriangle size={15} />
        {blocking
          ? 'Missing before this BL can be issued'
          : 'Missing — these will print blank'}
      </p>
      <ul className="mt-1 list-inside list-disc text-amber-900">
        {items.map((m) => (
          <li key={m}>
            {m}
            {FIX_IN[m] ? <span className="text-amber-800"> — fill in on {FIX_IN[m]}</span> : null}
          </li>
        ))}
      </ul>
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
