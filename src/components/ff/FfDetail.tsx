import { useState } from 'react'
import { Check, AlertTriangle, Link2, Plus } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Field, Select, TextInput } from '../ui/Field'
import { useDataStore } from '../../store/useDataStore'
import { FF_STAGES, ffGp } from '../../lib/ff'
import { mockAgents, mockCustomers } from '../../mocks/masters'
import type { FfShipment } from '../../lib/types'

export function FfDetail({ shipment: f }: { shipment: FfShipment }) {
  const { activities, ffShipments } = useDataStore()
  const jobActivities = activities.filter((a) => a.bookingId === f.id)
  const stageIdx = FF_STAGES.indexOf(f.stage)
  const children = ffShipments.filter((c) => c.parentId === f.id)

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono text-lg font-bold">{f.ref}</h3>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>{f.mode}</span>·<span>{f.origin} → {f.destination}</span>·<span>{f.incoterm}</span>
          {f.specialHandling && (
            <span className="rounded-badge bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">
              {f.specialHandling}
            </span>
          )}
          {f.linkedNvoccRef && (
            <span className="flex items-center gap-1 rounded-badge bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-heading">
              <Link2 size={10} /> NVOCC master {f.linkedNvoccRef}
            </span>
          )}
        </div>
      </div>

      {/* Stage stepper */}
      <div className="mt-4 flex flex-wrap items-center gap-1">
        {FF_STAGES.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <span
              className={`rounded-badge px-2.5 py-1 text-[11px] font-medium ${
                i < stageIdx ? 'bg-primary/15 text-primary' : i === stageIdx ? 'bg-primary text-white' : 'bg-surface-2 text-muted'
              }`}
            >
              {s}
            </span>
            {i < FF_STAGES.length - 1 && <span className="text-line">→</span>}
          </div>
        ))}
      </div>

      <div className="mt-5">
        {f.creditHold ? (
          <p className="flex items-center gap-2 rounded-btn border border-[#FECACA] bg-[#FEE2E2] px-4 py-3 text-sm font-medium text-[#B91C1C]">
            <AlertTriangle size={15} /> Held — over credit limit. Finance sign-off pending in the shared Approvals queue.
          </p>
        ) : (
          <>
            {f.isConsolParent && <ConsolPanel parent={f} childHbls={children} />}
            {!f.isConsolParent && f.stage === 'Carrier & Pickup' && <CarrierPanel f={f} />}
            {!f.isConsolParent && f.stage === 'Documentation' && <DocsPanel f={f} />}
            {!f.isConsolParent && f.stage === 'Export & Transit' && <ExportPanel f={f} />}
            {!f.isConsolParent && f.stage === 'Arrival & Delivery' && <ArrivalPanel f={f} />}
            {!f.isConsolParent && f.stage === 'Financial Close' && <FinClosePanel f={f} />}
            {f.stage === 'Closed' && (
              <p className="rounded-btn border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
                <Check size={14} className="mr-1 inline" /> Financially closed — Actual GP locked.
              </p>
            )}
          </>
        )}
      </div>

      {/* Vendor lines / GP (always visible for non-parent) */}
      {!f.isConsolParent && f.vendorLines.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Buy side — {f.vendorLines.length} vendor line(s) · sell ${f.sellAmount.toLocaleString()}
          </p>
          <div className="space-y-1.5">
            {f.vendorLines.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-btn border border-line bg-surface-2/40 px-3 py-2 text-xs">
                <span className="rounded-badge bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-heading">{v.role}</span>
                <span className="text-body">{v.vendorName}</span>
                <span className="ml-auto font-mono text-body">booked ${v.buyAmount.toLocaleString()}</span>
                {v.billedAmount !== null ? (
                  <span className={`font-mono font-semibold ${v.varianceFlag ? 'text-accent-orange' : 'text-primary'}`}>
                    billed ${v.billedAmount.toLocaleString()}{v.varianceFlag && ' ⚠'}
                  </span>
                ) : (
                  <span className="text-muted">bill pending</span>
                )}
              </div>
            ))}
          </div>
          <GpLine f={f} />
        </div>
      )}

      {/* Audit log */}
      <div className="mt-5 border-t border-line pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Shipment audit log</p>
        {jobActivities.slice(0, 6).map((a) => (
          <div key={a.id} className="flex items-start gap-3 py-1.5 text-xs">
            <span className="w-32 shrink-0 font-mono text-muted">{new Date(a.at).toLocaleString()}</span>
            <span className="w-28 shrink-0 font-medium text-heading">{a.actor}</span>
            <span className="text-body">{a.action}</span>
          </div>
        ))}
        {jobActivities.length === 0 && <p className="text-xs text-muted">No entries yet</p>}
      </div>
    </Card>
  )
}

function GpLine({ f }: { f: FfShipment }) {
  const gp = ffGp(f)
  return (
    <p className="mt-3 text-sm">
      <span className="text-body">P&L: </span>
      <span className={`font-mono font-semibold ${gp.value >= 0 ? 'text-primary' : 'text-accent-coral'}`}>
        ${gp.value.toLocaleString()}
      </span>
      <span className={`ml-2 rounded-badge px-2 py-0.5 text-[10px] font-semibold ${gp.actual ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEF3C7] text-[#B45309]'}`}>
        {gp.actual ? 'Actual GP — all vendor bills matched' : 'Estimated GP — vendor bills pending'}
      </span>
    </p>
  )
}

/* ── Flow 6: LCL consolidation parent ────────────────────────── */

function ConsolPanel({ parent, childHbls }: { parent: FfShipment; childHbls: FfShipment[] }) {
  const { addChildHbl, closeConsolRun, ffPickupComplete } = useDataStore()
  const [customerId, setCustomerId] = useState('')
  const [sell, setSell] = useState(0)
  const customer = mockCustomers.find((c) => c.id === customerId)

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        One container, many shippers — each child HBL has its own SI, house document, client, and P&L.
        Manifest auto-updates. Closing the run apportions container cost across children by revenue share.
      </p>
      <div className="space-y-1.5">
        {childHbls.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-btn border border-line bg-surface px-3 py-2 text-xs">
            <span className="font-mono font-medium text-link">{c.ref}</span>
            <span className="text-body">{c.customerName}</span>
            <span className="ml-auto font-mono text-body">sell ${c.sellAmount.toLocaleString()}</span>
            <span className="text-muted">{c.stage}</span>
          </div>
        ))}
        {childHbls.length === 0 && <p className="text-xs text-muted">No child HBLs yet</p>}
      </div>

      {!parent.consolClosed ? (
        <>
          <div className="flex flex-wrap items-end gap-2 rounded-btn border border-line bg-surface-2/50 p-3">
            <div className="w-56">
              <p className="mb-1 text-[11px] text-body">New shipper (child HBL)</p>
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Select shipper…</option>
                {mockCustomers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div className="w-32">
              <p className="mb-1 text-[11px] text-body">Sell ($)</p>
              <TextInput type="number" value={sell || ''} onChange={(e) => setSell(+e.target.value)} />
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={!customer || !sell}
              className="disabled:opacity-50"
              onClick={() => {
                addChildHbl(parent.id, { customerId: customer!.id, customerName: customer!.name, sellAmount: sell })
                setCustomerId(''); setSell(0)
              }}
            >
              <Plus size={13} /> Add child HBL
            </Button>
          </div>
          <Button
            disabled={childHbls.length === 0}
            className="disabled:opacity-50"
            onClick={() => closeConsolRun(parent.id)}
          >
            Close consolidation run — apportion ${parent.vendorLines.reduce((a, v) => a + v.buyAmount, 0).toLocaleString()} container cost
          </Button>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-primary">
            <Check size={13} className="mr-1 inline" />
            Run closed — container cost apportioned by revenue share; container-level milestones apply to all child HBLs. Children proceed through Flows 4–5 and close financially on their own timelines.
          </p>
          {parent.stage === 'Carrier & Pickup' && (
            <Button size="sm" variant="secondary" onClick={() => ffPickupComplete(parent.id)}>
              Container gate-in at CFS complete → Documentation
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Flow 2: carrier, agent, pickup ──────────────────────────── */

function CarrierPanel({ f }: { f: FfShipment }) {
  const { ffConfirmCarrier, ffPickupComplete, bookings } = useDataStore()
  const [useInternal, setUseInternal] = useState(!!f.linkedNvoccRef)
  const [nvoccRef, setNvoccRef] = useState(f.linkedNvoccRef ?? '')
  const [carrier, setCarrier] = useState(f.carrierName)
  const [agentId, setAgentId] = useState(f.agentId ?? '')
  const confirmed = !!f.carrierName || !!f.linkedNvoccRef

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Carrier confirmed against the buy-side vendor from quotation. If Kinetic Line's own NVOCC has space on
        this lane, link internally — milestones auto-subscribe from the NVOCC booking.
      </p>
      {!confirmed ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Capacity source">
            <Select value={useInternal ? 'internal' : 'external'} onChange={(e) => setUseInternal(e.target.value === 'internal')}>
              <option value="external">External carrier / co-loader</option>
              <option value="internal">Kinetic Line NVOCC (internal link)</option>
            </Select>
          </Field>
          {useInternal ? (
            <Field label="NVOCC booking (master)">
              <Select value={nvoccRef} onChange={(e) => setNvoccRef(e.target.value)}>
                <option value="">Select…</option>
                {bookings.slice(0, 10).map((b) => (
                  <option key={b.id} value={b.bookingRef}>{b.bookingRef} — {b.pol} → {b.pod}</option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Carrier / co-loader name">
              <TextInput value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. Maersk / co-loader" />
            </Field>
          )}
          <Field label="Agent (origin/destination — Agency module)">
            <Select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">—</option>
              {mockAgents.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.country})</option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-3">
            <Button
              size="sm"
              disabled={useInternal ? !nvoccRef : !carrier}
              className="disabled:opacity-50"
              onClick={() =>
                ffConfirmCarrier(f.id, {
                  linkedNvoccRef: useInternal ? nvoccRef : null,
                  carrierName: useInternal ? 'Kinetic Line NVOCC (internal)' : carrier,
                  agentId: agentId || null,
                })
              }
            >
              Confirm carrier + allocate agent
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-body">
            <Check size={13} className="mr-1 inline text-primary" />
            Carrier: <span className="font-medium text-heading">{f.carrierName}</span>
            {f.agentId && <> · Agent: {mockAgents.find((a) => a.id === f.agentId)?.name}</>}
            {' '}· Agent gains RLS-scoped dashboard visibility.
          </p>
          <Button size="sm" onClick={() => ffPickupComplete(f.id)}>
            Cargo collected — log signed proof of collection → Documentation
          </Button>
        </div>
      )}
    </div>
  )
}

/* ── Flow 3: documentation ───────────────────────────────────── */

function DocsPanel({ f }: { f: FfShipment }) {
  const { ffDocAction } = useDataStore()
  const [releaseType, setReleaseType] = useState(f.mode === 'Air' ? 'AWB (standard)' : 'Original')
  const houseLabel = f.mode === 'Air' ? 'HAWB' : 'HBL'

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        SI intake → completeness check → MBL/MAWB from carrier → {houseLabel} auto-draft (governed fields +
        clause library) → review → release ({f.mode === 'Air' ? 'standard AWB' : 'Original / Telex / Seaway'}).
      </p>
      <div className="flex flex-wrap gap-2">
        {!f.siReceived && (
          <Button size="sm" variant="secondary" onClick={() => ffDocAction(f.id, 'si_received')}>
            SI received (completeness check)
          </Button>
        )}
        {f.siReceived && !f.weightVarianceFlagged && f.houseDocStatus === 'None' && (
          <Button size="sm" variant="ghost" className="text-accent-orange" onClick={() => ffDocAction(f.id, 'weight_variance')}>
            Flag weight/measure variance
          </Button>
        )}
        {f.siReceived && !f.mblUploaded && (
          <Button size="sm" variant="secondary" onClick={() => ffDocAction(f.id, 'mbl_uploaded')}>
            Master doc (MBL/MAWB) uploaded
          </Button>
        )}
        {f.siReceived && f.mblUploaded && f.houseDocStatus === 'None' && (
          <Button size="sm" onClick={() => ffDocAction(f.id, 'draft_house')}>
            Auto-draft {houseLabel} from SI + booking
          </Button>
        )}
        {f.houseDocStatus === 'Draft' && (
          <>
            <Button size="sm" variant="secondary" onClick={() => ffDocAction(f.id, 'draft_house')}>
              Ops/Agent edit (direct, versioned — v{f.houseDocVersion})
            </Button>
            <Button size="sm" variant="secondary" onClick={() => ffDocAction(f.id, 'customer_edit')}>
              Customer edit (→ Approvals queue)
            </Button>
          </>
        )}
      </div>
      {f.weightVarianceFlagged && (
        <p className="flex items-center gap-1.5 text-xs text-accent-orange">
          <AlertTriangle size={13} /> Weight variance flagged — Ops sign-off recorded before proceeding.
        </p>
      )}
      {f.houseDocStatus === 'Awaiting approval' && (
        <p className="text-xs text-muted">Customer changes pending in the shared Approvals queue.</p>
      )}
      {f.houseDocStatus === 'Draft' && (
        <div className="flex items-end gap-2">
          <div className="w-48">
            <p className="mb-1 text-[11px] text-body">Release type</p>
            <Select value={releaseType} onChange={(e) => setReleaseType(e.target.value)}>
              {f.mode === 'Air' ? (
                <option>AWB (standard)</option>
              ) : (
                <>
                  <option>Original</option>
                  <option>Telex</option>
                  <option>Seaway</option>
                </>
              )}
            </Select>
          </div>
          <Button size="sm" onClick={() => ffDocAction(f.id, 'release', releaseType)}>
            Release {houseLabel} — locks document
          </Button>
        </div>
      )}
    </div>
  )
}

/* ── Flow 4: export customs & departure ──────────────────────── */

function ExportPanel({ f }: { f: FfShipment }) {
  const { ffExportAction } = useDataStore()
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Broker → shipping bill before cut-off → clearance → gate-in + {f.mode === 'Air' ? 'chargeable weight' : 'VGM'} → cut-off → departure (SOB) → in-transit vs ETA.
      </p>
      {f.exportHold && (
        <p className="flex items-center gap-1.5 rounded-btn border border-[#FECACA] bg-[#FEE2E2] px-3 py-2 text-xs font-medium text-[#B91C1C]">
          <AlertTriangle size={13} /> EXPORT CUSTOMS HOLD — Ops + customer notified
          <Button size="sm" variant="secondary" className="ml-auto" onClick={() => ffExportAction(f.id, 'resolve_hold')}>
            Resolve with broker
          </Button>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {!f.brokerAssigned && (
          <Button size="sm" variant="secondary" onClick={() => ffExportAction(f.id, 'broker')}>
            Assign broker + file shipping bill
          </Button>
        )}
        {f.brokerAssigned && !f.exportHold && !f.letExportReceived && (
          <>
            <Button size="sm" variant="ghost" className="text-accent-coral" onClick={() => ffExportAction(f.id, 'hold')}>
              Customs hold raised
            </Button>
            <Button size="sm" variant="secondary" onClick={() => ffExportAction(f.id, 'let_export')}>
              "Let Export Order" received
            </Button>
          </>
        )}
        {f.letExportReceived && !f.gateInDone && (
          <Button size="sm" variant="secondary" onClick={() => ffExportAction(f.id, 'gate_in_vgm')}>
            {f.mode === 'Air' ? 'Cargo tendered + chargeable weight' : 'Gate-in + VGM submitted'}
          </Button>
        )}
        {f.gateInDone && f.cutoffMet === null && (
          <>
            <Button size="sm" variant="secondary" onClick={() => ffExportAction(f.id, 'cutoff_met')}>
              Cut-off met
            </Button>
            <Button size="sm" variant="ghost" className="text-accent-orange" onClick={() => ffExportAction(f.id, 'cutoff_missed')}>
              Cut-off missed — re-plan
            </Button>
          </>
        )}
        {f.cutoffMet === false && (
          <Button size="sm" variant="secondary" onClick={() => ffExportAction(f.id, 'cutoff_met')}>
            Re-planned to next sailing/flight — cut-off met
          </Button>
        )}
        {f.gateInDone && f.cutoffMet === true && !f.departed && (
          <Button size="sm" onClick={() => ffExportAction(f.id, 'depart')}>
            Departed — SOB/uplift confirmed → Arrival
          </Button>
        )}
      </div>
    </div>
  )
}

/* ── Flow 5: arrival, delivery ───────────────────────────────── */

function ArrivalPanel({ f }: { f: FfShipment }) {
  const { ffArrivalAction } = useDataStore()
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Arrival notice → destination agent → Bill of Entry → Out of Charge → D&D check → DO → last-mile → POD.
      </p>
      {f.importHold && (
        <p className="flex items-center gap-1.5 rounded-btn border border-[#FECACA] bg-[#FEE2E2] px-3 py-2 text-xs font-medium text-[#B91C1C]">
          <AlertTriangle size={13} /> IMPORT CUSTOMS HOLD — Ops + customer notified
          <Button size="sm" variant="secondary" className="ml-auto" onClick={() => ffArrivalAction(f.id, 'resolve_hold')}>
            Resolve with broker
          </Button>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {!f.arrivalNoticeSent && (
          <Button size="sm" variant="secondary" onClick={() => ffArrivalAction(f.id, 'arrival_notice')}>
            Arrival notice → consignee
          </Button>
        )}
        {f.arrivalNoticeSent && !f.importHold && !f.outOfCharge && (
          <>
            <Button size="sm" variant="ghost" className="text-accent-coral" onClick={() => ffArrivalAction(f.id, 'import_hold')}>
              Import hold raised
            </Button>
            <Button size="sm" variant="secondary" onClick={() => ffArrivalAction(f.id, 'out_of_charge')}>
              Bill of Entry + "Out of Charge"
            </Button>
          </>
        )}
        {f.outOfCharge && f.ddOutcome === null && (
          <>
            <Button size="sm" variant="secondary" onClick={() => ffArrivalAction(f.id, 'dd_none')}>
              Within free time — no D&D
            </Button>
            <Button size="sm" variant="ghost" className="text-accent-orange" onClick={() => ffArrivalAction(f.id, 'dd_customer')}>
              D&D — customer-caused, bill it
            </Button>
            <Button size="sm" variant="ghost" onClick={() => ffArrivalAction(f.id, 'dd_absorbed')}>
              D&D — absorb as ops cost
            </Button>
          </>
        )}
        {f.ddOutcome !== null && !f.doIssued && (
          <Button size="sm" variant="secondary" onClick={() => ffArrivalAction(f.id, 'issue_do')}>
            Issue Delivery Order + dispatch last-mile
          </Button>
        )}
        {f.doIssued && !f.podCaptured && (
          <Button size="sm" onClick={() => ffArrivalAction(f.id, 'pod')}>
            POD captured → Delivered
          </Button>
        )}
      </div>
    </div>
  )
}

/* ── Flow 5b: financial close ────────────────────────────────── */

function FinClosePanel({ f }: { f: FfShipment }) {
  const { ffInvoiceClient, ffMatchVendorBill, ffMarkPaid, ffFinancialClose } = useDataStore()
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const allMatched = f.vendorLines.length > 0 && f.vendorLines.every((v) => v.billedAmount !== null)

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Client invoice off the consolidated sell; vendor bills arrive independently and match to costing lines.
        Variance &gt;10% routes to the Approvals queue. GP flips Estimated → Actual only when every bill is matched.
      </p>
      <div className="flex flex-wrap gap-2">
        {!f.clientInvoiced && (
          <Button size="sm" onClick={() => ffInvoiceClient(f.id)}>
            Raise client invoice — ${f.sellAmount.toLocaleString()}
          </Button>
        )}
        {f.clientInvoiced && !f.paid && (
          <Button size="sm" variant="secondary" onClick={() => ffMarkPaid(f.id)}>
            Payment received in full
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {f.vendorLines.filter((v) => v.billedAmount === null).map((v) => (
          <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-btn border border-line bg-surface-2/50 px-3 py-2 text-xs">
            <span className="text-body">{v.role} — {v.vendorName} (booked ${v.buyAmount.toLocaleString()})</span>
            <div className="ml-auto flex items-center gap-2">
              <div className="w-28">
                <TextInput
                  type="number"
                  placeholder="Billed $"
                  value={amounts[v.id] || ''}
                  onChange={(e) => setAmounts((a) => ({ ...a, [v.id]: +e.target.value }))}
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={!amounts[v.id]}
                className="disabled:opacity-50"
                onClick={() => ffMatchVendorBill(f.id, v.id, amounts[v.id])}
              >
                Match bill
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button
        disabled={!f.paid || !allMatched}
        className="disabled:opacity-50"
        onClick={() => ffFinancialClose(f.id)}
      >
        Mark Financially Closed {(!f.paid || !allMatched) && '(needs full payment + all bills matched)'}
      </Button>
    </div>
  )
}
