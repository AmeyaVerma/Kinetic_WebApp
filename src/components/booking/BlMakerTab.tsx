import { useCallback, useEffect, useMemo, useState } from 'react'
import { Document, PDFViewer, PDFDownloadLink } from '@react-pdf/renderer'
import { AlertTriangle, FileCheck2, Lock } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Select } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import type { Booking } from '../../lib/types'
import { BlDocument, BlBackside } from '../../lib/pdf/templates/BlFrontSheet'
import { ContainerAttachSheet } from '../../lib/pdf/templates/ContainerAttachSheet'
import { buildBlSnapshot, type CompanySettingsLite } from '../../lib/pdf/buildBlSnapshot'
import { missingBlFields, formatBlNumber, fyCodeFor, type BlSnapshot } from '../../lib/pdf/blSnapshot'
import { BL_TYPE_LABEL, printsBackside, type BlType } from '../../lib/pdf/strings/bl'

const BL_TYPES: BlType[] = ['Draft', 'Original', 'Surrender', 'Seaway', 'RFS']

type BlRow = {
  booking_id: string
  bl_number: string | null
  bl_type: BlType
  print_mode: 'Original' | 'Scan'
  status: 'Draft' | 'Issued'
  issued_at: string | null
  mbl_number: string | null
  use_container_sheet: boolean
}

/**
 * BL Maker (CR-01), Phase 2: numbering, type, print mode, live preview,
 * validation and Issue.
 *
 * While the BL is a Draft the preview is rebuilt from the booking on every
 * render, so it tracks edits live. On Issue the snapshot is frozen into
 * document_versions and the preview switches to reading that row -- later
 * booking edits cannot reach it.
 *
 * Not yet here (Phase 3/4): continuation sheets, the backside, the container
 * attach sheet PDF, and the PIN-gated Signed / Surrender stamp toggles.
 */
export function BlMakerTab({ booking }: { booking: Booking }) {
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const role = viewAsRole ?? user?.role
  const canEdit = role === 'admin' || role === 'ops'

  const [row, setRow] = useState<BlRow | null>(null)
  const [company, setCompany] = useState<CompanySettingsLite | null>(null)
  const [issuedSnapshot, setIssuedSnapshot] = useState<BlSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dbId = booking.dbId

  const load = useCallback(async () => {
    if (!dbId) {
      setLoading(false)
      return
    }
    const [{ data: bl }, { data: cs }] = await Promise.all([
      supabase.from('bl_state').select('*').eq('booking_id', dbId).maybeSingle(),
      supabase.from('company_settings').select('*').limit(1).maybeSingle(),
    ])
    setRow((bl as BlRow | null) ?? null)
    setCompany((cs as CompanySettingsLite | null) ?? null)

    if (bl && (bl as BlRow).status === 'Issued') {
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
    setLoading(false)
  }, [dbId])

  useEffect(() => {
    load()
  }, [load])

  /** Draft snapshots rebuild from the booking; issued ones never do. */
  const snapshot = useMemo(() => {
    if (!company) return null
    if (issuedSnapshot) return issuedSnapshot
    return buildBlSnapshot({
      booking,
      company,
      blNumber: row?.bl_number ?? '',
      blType: row?.bl_type ?? 'Draft',
      printMode: row?.print_mode ?? 'Original',
      useContainerSheet: row?.use_container_sheet ?? false,
      issuedAt: row?.issued_at ?? null,
    })
  }, [booking, company, row, issuedSnapshot])

  const missing = snapshot ? missingBlFields(snapshot) : []

  const handleGenerate = async () => {
    if (!dbId) return
    setBusy(true)
    setError(null)
    // The sequence is allocated in Postgres so two concurrent bookings
    // cannot take the same number.
    const { data: seq, error: seqErr } = await supabase.rpc('next_document_number', {
      p_series: 'nvocc_bl',
    })
    if (seqErr) {
      setError(seqErr.message)
      setBusy(false)
      return
    }
    const blNumber = formatBlNumber(fyCodeFor(), seq as number)

    // A bl_state row may already exist from the established BL edit flow,
    // carrying current_fields and a lifecycle. An upsert would replace the
    // whole row and silently destroy those edits, so numbering only ever
    // touches the BL-document columns: update when the row is there, insert
    // when it is not.
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
    // Keep bookings.hbl_no in step -- the Kinetic form is the HBL -- but only
    // when it is empty. O1 (whether the HBL carries its own series) is still
    // open, and existing bookings already hold numbers in a different series
    // (KLHBL250027). Overwriting those would destroy real data to satisfy a
    // rule nobody has confirmed yet.
    else if (!booking.hblNo) {
      await supabase.from('bookings').update({ hbl_no: blNumber }).eq('id', dbId)
    }
    setBusy(false)
    load()
  }

  const patch = async (changes: Partial<BlRow>) => {
    if (!dbId || !row) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.from('bl_state').update(changes).eq('booking_id', dbId)
    if (err) setError(err.message)
    setBusy(false)
    load()
  }

  const handleIssue = async () => {
    if (!dbId || !snapshot || !row) return
    setBusy(true)
    setError(null)
    const issuedAt = new Date().toISOString()
    // Freeze every printed value, including the issue place and date.
    const frozen = { ...snapshot, placeAndDateOfIssue: snapshot.placeAndDateOfIssue || '' }
    const { data: last } = await supabase
      .from('document_versions')
      .select('version')
      .eq('booking_id', dbId)
      .eq('doc_type', 'bl')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextVersion = ((last?.version as number | undefined) ?? 0) + 1

    const { error: verErr } = await supabase.from('document_versions').insert({
      booking_id: dbId,
      doc_type: 'bl',
      version: nextVersion,
      snapshot: { ...frozen, placeAndDateOfIssue: frozen.placeAndDateOfIssue },
      options: { scan: row.print_mode === 'Scan' },
      file_name: snapshot.blNumber + '_' + row.bl_type.toUpperCase() + '.pdf',
    })
    if (verErr) {
      setError(verErr.message)
      setBusy(false)
      return
    }
    await patch({ status: 'Issued', issued_at: issuedAt })
    setBusy(false)
  }

  if (!dbId) {
    return (
      <Card className="p-4 text-sm text-muted">
        This booking has not been saved to the database yet, so a BL cannot be
        numbered. Save the booking first.
      </Card>
    )
  }
  if (loading) return <Card className="p-4 text-sm text-muted">Loading BL…</Card>

  if (!row?.bl_number) {
    return (
      <Card className="space-y-3 p-4">
        <h2 className="font-display text-lg">Bill of Lading</h2>
        <p className="text-sm text-muted">
          No BL has been created for this booking yet. Generating one allocates
          a permanent MTD number; it never changes, including across type
          changes and amendments.
        </p>
        <Button onClick={handleGenerate} disabled={!canEdit || busy}>
          {busy ? 'Generating…' : 'Generate BL'}
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </Card>
    )
  }

  const issued = row.status === 'Issued'
  const fileName =
    row.bl_number +
    (row.bl_type === 'Original' && row.print_mode === 'Scan' ? '_SCAN' : '') +
    '_' + row.bl_type.toUpperCase() + '.pdf'

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted">MTD Number</p>
            <p className="font-mono text-base">{row.bl_number}</p>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted">BL Type</p>
            <Select
              value={row.bl_type}
              disabled={!canEdit || issued || busy}
              onChange={(e) => patch({ bl_type: e.target.value as BlType })}
            >
              {BL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {BL_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </div>

          {/* Print mode exists only for Original. */}
          {row.bl_type === 'Original' && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Print mode</p>
              <Select
                value={row.print_mode}
                disabled={!canEdit || busy}
                onChange={(e) => patch({ print_mode: e.target.value as 'Original' | 'Scan' })}
              >
                <option value="Original">Original (colour, 3 originals)</option>
                <option value="Scan">Scan Copy (black and white, blank)</option>
              </Select>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={row.use_container_sheet}
              disabled={!canEdit || issued || busy}
              onChange={(e) => patch({ use_container_sheet: e.target.checked })}
            />
            Use container attach sheet
          </label>

          <span
            className={
              'ml-auto rounded-full px-3 py-1 text-xs ' +
              (issued ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')
            }
          >
            {issued ? 'Issued' : 'Draft'}
          </span>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Validation checklist. A Draft may be generated with gaps; any other
            type is blocked until the list is empty. */}
        {missing.length > 0 && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-amber-900">
              <AlertTriangle size={15} /> Missing before this BL can be issued
            </p>
            <ul className="mt-1 list-inside list-disc text-amber-900">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {/* O5: the backside artwork has not been supplied, so a non-Draft BL
            cannot print a complete document yet. Draft is unaffected. */}
        {printsBackside(row.bl_type) && (
          <p className="flex items-center gap-2 rounded border border-line bg-surface-2 p-3 text-sm text-muted">
            <Lock size={15} />
            The BL backside (terms) artwork has not been supplied yet, so this
            type cannot print a complete document. The front sheet below is
            correct; the backside becomes the last page once the artwork is
            uploaded.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {snapshot && (
            <PDFDownloadLink
              document={<BlDocument snapshot={snapshot} />}
              fileName={fileName}
              className="inline-flex items-center gap-2 rounded-btn border px-4 py-2 text-sm"
            >
              {({ loading: l }) => (l ? 'Preparing…' : 'Print BL')}
            </PDFDownloadLink>
          )}

          {/* The backside is also available on its own, print-ready. It is
              the same artwork Print BL appends, so the two cannot diverge. */}
          {snapshot && printsBackside(row.bl_type) && (
            <PDFDownloadLink
              document={
                <Document title={row.bl_number + ' backside'}>
                  <BlBackside scan={row.print_mode === 'Scan'} />
                </Document>
              }
              fileName={row.bl_number + '_BACKSIDE.pdf'}
              className="inline-flex items-center gap-2 rounded-btn border px-4 py-2 text-sm"
            >
              {({ loading: l }) => (l ? 'Preparing…' : 'Backside')}
            </PDFDownloadLink>
          )}

          {/* Deliberately NOT bundled into Print BL -- it is a separate
              document that travels with the BL, per the brief's action table. */}
          {snapshot && snapshot.containers.length > 0 && (
            <PDFDownloadLink
              document={<ContainerAttachSheet snapshot={snapshot} />}
              fileName={row.bl_number + '_CONTAINER_SHEET.pdf'}
              className="inline-flex items-center gap-2 rounded-btn border px-4 py-2 text-sm"
            >
              {({ loading: l }) => (l ? 'Preparing…' : 'Container attach sheet')}
            </PDFDownloadLink>
          )}
          {!issued && (
            <Button
              onClick={handleIssue}
              disabled={!canEdit || busy || missing.length > 0 || row.bl_type === 'Draft'}
              title={
                row.bl_type === 'Draft'
                  ? 'Choose a BL type other than Draft to issue'
                  : undefined
              }
            >
              <FileCheck2 size={15} /> Issue BL
            </Button>
          )}
        </div>

        {issued && (
          <p className="text-xs text-muted">
            Issued {row.issued_at ? new Date(row.issued_at).toLocaleString() : ''}. This
            preview reads the frozen version, so later booking edits do not change
            it — those need a new version.
          </p>
        )}
      </Card>

      {snapshot && (
        <PDFViewer className="min-h-[80vh] w-full rounded border" showToolbar>
          <BlDocument snapshot={snapshot} />
        </PDFViewer>
      )}
    </div>
  )
}
