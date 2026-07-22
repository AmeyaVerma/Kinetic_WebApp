import { useState } from 'react'
import { Upload, FileText, Lock, CheckCircle2, ShieldAlert } from 'lucide-react'
import { Button } from '../ui/Button'
import { StatusChip } from '../ui/StatusChip'
import { Field, Select, TextInput, Textarea } from '../ui/Field'
import { useDataStore } from '../../store/useDataStore'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import { BL_FIELD_LABELS, DOC_SEQUENCE } from './DocumentsTab'
import type { BlFields, FfShipment } from '../../lib/types'

/** Same BL panel + document sequence as NVOCC's DocumentsTab, adapted to an
    FfShipment record (no vessel-booking-specific fields like hblNo/pol/pod). */
export function FfDocumentsTab({ shipment }: { shipment: FfShipment }) {
  const { documents, blStates, blVersions, uploadDocument, saveBl, submitCustomerBlEdit, approveBl, releaseBl } =
    useDataStore()
  const currentUser = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const effectiveRole = viewAsRole ?? currentUser?.role
  const isAdmin = effectiveRole === 'admin'

  const docs = documents.filter((d) => d.bookingId === shipment.id)
  const bl = blStates.find((b) => b.bookingId === shipment.id)
  const versions = blVersions.filter((v) => v.bookingId === shipment.id)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<BlFields | null>(null)

  const startEdit = () => {
    setDraft(
      bl?.currentFields ?? {
        shipper: shipment.shipper ?? '',
        consignee: shipment.consignee ?? '',
        notifyParty: shipment.notifyParty ?? '',
        overseasAgent: '',
        vessel: shipment.vesselName ?? '',
        voyage: shipment.voyageNo ?? '',
        placeOfReceipt: shipment.origin,
        portOfLoading: shipment.origin,
        placeOfDischarge: shipment.destination,
        finalPlaceOfDelivery: shipment.destination,
        blDate: '',
        shippedOnBoard: '',
        placeOfIssue: '',
        numberOfOriginals: '',
        blNumber: '',
        blNumberManual: '',
        movementType: '',
        blType: '',
        shipmentReference: shipment.ref,
        containers: '',
        packagesAndDescription: shipment.commodity ?? '',
        weight: shipment.grossWeightKg ? `GROSS WEIGHT\n${shipment.grossWeightKg} KGS` : '',
        measurement: '',
        otherParticulars: '',
        freight: shipment.freightTerms ?? '',
        freightPayableAt: '',
        collectCharges: '',
        releaseType: '',
        annexure: '',
        signingAgent: '',
        lockBlForClient: '0',
        destinationAgentAccess: '',
        transhipmentAgentAccess: '',
      },
    )
    setEditing(true)
  }

  const locked = bl?.lifecycle === 'Approved' || bl?.lifecycle === 'Released'

  return (
    <div className="space-y-6">
      {/* ── BL panel ── */}
      <div className="rounded-card border border-line bg-surface-2/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText size={17} className="text-primary" />
            <h3 className="text-[15px] font-semibold">BL panel</h3>
            {bl && (
              <span className="rounded-badge bg-surface-2 px-2.5 py-1 text-xs font-medium text-heading">
                {bl.lifecycle}
                {bl.releaseType ? ` — ${bl.releaseType}` : ''}
              </span>
            )}
            {locked && <Lock size={13} className="text-muted" />}
          </div>
          <div className="flex flex-wrap gap-2">
            {!editing && !locked && (
              <Button size="sm" variant="secondary" onClick={startEdit}>
                {bl ? 'Edit BL draft' : 'Create BL draft'}
              </Button>
            )}
            {bl && !locked && bl.lifecycle !== 'Awaiting approval' && (
              isAdmin ? (
                <Button size="sm" onClick={() => approveBl(shipment.id, currentUser?.name ?? 'Admin')}>
                  Approve & lock
                </Button>
              ) : (
                <span className="flex items-center gap-1.5 rounded-badge bg-[#FEF3C7] px-2.5 py-1 text-xs font-medium text-[#B45309]">
                  <ShieldAlert size={13} /> Awaiting Admin approval
                </span>
              )
            )}
            {bl?.lifecycle === 'Approved' && (
              <>
                {(['Original', 'Telex', 'Seaway'] as const).map((t) => (
                  <Button key={t} size="sm" variant="secondary" onClick={() => releaseBl(shipment.id, t)}>
                    Release {t}
                  </Button>
                ))}
              </>
            )}
            {locked && !editing && (
              <Button size="sm" variant="ghost" onClick={startEdit}>
                Amendment (revision cycle)
              </Button>
            )}
          </div>
        </div>

        <p className="mt-1.5 text-xs text-muted">
          Lifecycle: Draft → Agent/customer edited → Awaiting ops approval → Approved (locked) → Released
          (Original / Telex / Seaway).
        </p>

        {editing && draft ? (
          <div className="mt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {BL_FIELD_LABELS.map(({ key, label, widget, options }) => (
                <Field key={key} label={label}>
                  {widget === 'textarea' ? (
                    <Textarea
                      value={draft[key]}
                      onChange={(e) => setDraft((d) => (d ? { ...d, [key]: e.target.value } : d))}
                    />
                  ) : widget === 'select' ? (
                    <Select
                      value={draft[key]}
                      onChange={(e) => setDraft((d) => (d ? { ...d, [key]: e.target.value } : d))}
                    >
                      {options!.map((o) => (
                        <option key={o} value={o}>{o || '—'}</option>
                      ))}
                    </Select>
                  ) : (
                    <TextInput
                      value={draft[key]}
                      onChange={(e) => setDraft((d) => (d ? { ...d, [key]: e.target.value } : d))}
                    />
                  )}
                </Field>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  saveBl(shipment.id, draft, 'S. Singh', 'ops')
                  setEditing(false)
                }}
              >
                Save — Ops (direct, versioned)
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  saveBl(shipment.id, draft, 'Destination agent', 'agent')
                  setEditing(false)
                }}
              >
                Save — Agent (live, versioned)
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const changes: Partial<BlFields> = {}
                  const baseline = bl?.currentFields
                  for (const { key } of BL_FIELD_LABELS) {
                    if (!baseline || baseline[key] !== draft[key]) changes[key] = draft[key]
                  }
                  submitCustomerBlEdit(shipment.id, changes, shipment.customerName)
                  setEditing(false)
                }}
              >
                Submit — Customer (approval-gated)
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : bl ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BL_FIELD_LABELS.map(({ key, label }) => (
              <div key={key} className="rounded-btn border border-line bg-surface px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-wide text-muted">{label}</p>
                <p className="mt-0.5 whitespace-pre-line text-[13px] text-heading">{bl.currentFields[key] || '—'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">No BL draft yet.</p>
        )}

        {versions.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Version history (bl_versions — append-only)
            </p>
            <div className="space-y-1.5">
              {versions
                .slice()
                .reverse()
                .map((v) => (
                  <div key={v.id} className="flex items-center gap-3 text-xs text-body">
                    <span className="font-mono font-semibold text-heading">v{v.version}</span>
                    <span>{v.editedBy} ({v.editedByRole})</span>
                    <span className="text-muted">{new Date(v.editedAt).toLocaleString()}</span>
                    {v.amendment && (
                      <span className="rounded-badge bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">
                        amendment
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Documents sequence ── */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Documents — sequence and trigger
        </p>
        <div className="space-y-2">
          {DOC_SEQUENCE.map((d, i) => {
            const uploaded = docs.find((x) => x.docType === d.type)
            return (
              <div
                key={d.type}
                className="flex items-center gap-3 rounded-btn border border-line bg-surface px-4 py-2.5"
              >
                <span className="w-6 font-mono text-[11px] text-muted">{String(i + 1).padStart(2, '0')}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-heading">{d.type}</p>
                  <p className="truncate text-[11px] text-muted">{d.trigger}</p>
                </div>
                {uploaded ? (
                  <span className="flex items-center gap-1.5 text-xs text-primary">
                    <CheckCircle2 size={14} />
                    {uploaded.status} · {uploaded.uploadedBy}
                  </span>
                ) : (
                  <>
                    <StatusChip status="Pending" />
                    <Button size="sm" variant="ghost" onClick={() => uploadDocument(shipment.id, d.type, 'Ops')}>
                      <Upload size={13} /> Upload
                    </Button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
