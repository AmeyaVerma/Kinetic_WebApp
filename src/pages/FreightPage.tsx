import { useMemo, useState } from 'react'
import { Plus, Trash2, Link2 } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusChip } from '../components/ui/StatusChip'
import { Modal } from '../components/ui/Modal'
import { Field, Select, TextInput } from '../components/ui/Field'
import { FfDetail } from '../components/ff/FfDetail'
import { useDataStore } from '../store/useDataStore'
import { ffGp, INCOTERMS, CREDIT_LIMIT_USD } from '../lib/ff'
import { mockCustomers, mockVendors } from '../mocks/masters'
import type { ChipStatus, FfMode, FfShipment, FfStage, FfVendorRole } from '../lib/types'

const STAGE_CHIP: Record<FfStage, ChipStatus> = {
  Booking: 'Draft',
  'Carrier & Pickup': 'Booked',
  Documentation: 'Documentation',
  'Export & Transit': 'In Transit',
  'Arrival & Delivery': 'Arrived',
  'Financial Close': 'BL Draft',
  Closed: 'Delivered',
}

export function FreightPage() {
  const [wizardOpen, setWizardOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { ffShipments } = useDataStore()

  const parents = useMemo(() => ffShipments.filter((f) => !f.parentId), [ffShipments])
  const selected = ffShipments.find((f) => f.id === selectedId) ?? null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Freight FWD</h1>
          <p className="mt-1 text-sm text-muted">
            We arrange carriage — House + Master documents, multi-vendor buy vs one consolidated sell.
            GP = client sell − sum of every vendor bill.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus size={15} /> New FF booking
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Ref</th>
                <th className="px-3 py-3 font-medium">Mode</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Lane</th>
                <th className="px-3 py-3 font-medium">Sell</th>
                <th className="px-3 py-3 font-medium">GP</th>
                <th className="px-3 py-3 font-medium">Stage</th>
              </tr>
            </thead>
            <tbody>
              {parents.map((f) => {
                const gp = ffGp(f)
                const children = ffShipments.filter((c) => c.parentId === f.id)
                return (
                  <FfRow
                    key={f.id}
                    shipment={f}
                    gp={gp}
                    childCount={children.length}
                    selected={selectedId === f.id}
                    onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && <FfDetail shipment={selected} />}

      <FfWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onCreated={(id) => { setWizardOpen(false); setSelectedId(id) }} />
    </div>
  )
}

function FfRow({
  shipment: f,
  gp,
  childCount,
  selected,
  onClick,
}: {
  shipment: FfShipment
  gp: { value: number; actual: boolean }
  childCount: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60 ${selected ? 'bg-primary/5' : ''}`}
    >
      <td className="px-5 py-3 font-mono text-xs font-medium text-link">
        {f.ref}
        {f.isConsolParent && (
          <span className="ml-1.5 rounded-badge bg-[#EDE9FE] px-1.5 py-0.5 text-[10px] font-semibold text-[#6D28D9]">
            LCL consol · {childCount} HBL
          </span>
        )}
        {f.linkedNvoccRef && <Link2 size={11} className="ml-1.5 inline text-muted" />}
        {f.creditHold && (
          <span className="ml-1.5 rounded-badge bg-[#FEE2E2] px-1.5 py-0.5 text-[10px] font-semibold text-[#DC2626]">
            credit hold
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-body">{f.mode}</td>
      <td className="px-3 py-3 text-xs text-body">{f.customerName}</td>
      <td className="px-3 py-3 text-xs text-body">{f.origin} → {f.destination} · {f.incoterm}</td>
      <td className="px-3 py-3 font-mono text-xs text-body">
        {f.isConsolParent ? '—' : `$${f.sellAmount.toLocaleString()}`}
      </td>
      <td className="px-3 py-3 font-mono text-xs">
        {f.isConsolParent ? (
          <span className="text-muted">per child</span>
        ) : (
          <>
            <span className={gp.value >= 0 ? 'text-primary' : 'text-accent-coral'}>
              ${gp.value.toLocaleString()}
            </span>
            <span className={`ml-1.5 rounded-badge px-1.5 py-0.5 text-[10px] font-semibold ${gp.actual ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEF3C7] text-[#B45309]'}`}>
              {gp.actual ? 'Actual' : 'Estimated'}
            </span>
          </>
        )}
      </td>
      <td className="px-3 py-3">
        <StatusChip status={STAGE_CHIP[f.stage]} />
        <span className="ml-2 text-[11px] text-muted">{f.stage}</span>
      </td>
    </tr>
  )
}

/* ── New FF booking wizard (flow 1) ──────────────────────────── */

interface DraftVendorLine {
  role: FfVendorRole
  vendorId: string
  buyAmount: number
}

function FfWizard({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const createFfShipment = useDataStore((s) => s.createFfShipment)
  const [mode, setMode] = useState<FfMode>('Sea FCL')
  const [customerId, setCustomerId] = useState('')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [incoterm, setIncoterm] = useState('FOB')
  const [sell, setSell] = useState(0)
  const [isConsol, setIsConsol] = useState(false)
  const [special, setSpecial] = useState('')
  const [lines, setLines] = useState<DraftVendorLine[]>([
    { role: 'Carrier', vendorId: 'vn1', buyAmount: 0 },
  ])

  const customer = mockCustomers.find((c) => c.id === customerId)
  const buy = lines.reduce((a, l) => a + l.buyAmount, 0)
  const margin = sell > 0 ? ((sell - buy) / sell) * 100 : 0
  const valid = (customer || isConsol) && origin && destination && (isConsol || sell > 0)

  const reset = () => {
    setCustomerId(''); setOrigin(''); setDestination(''); setSell(0); setIsConsol(false); setSpecial('')
    setLines([{ role: 'Carrier', vendorId: 'vn1', buyAmount: 0 }])
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title="New FF booking"
      subtitle="Multi-vendor buy estimate + single consolidated client sell (flow 1)"
      wide
      footer={
        <Button
          disabled={!valid}
          className="disabled:opacity-50"
          onClick={() => {
            const id = createFfShipment(
              {
                mode,
                customerId: customer?.id ?? null,
                customerName: isConsol ? '— consolidation (multiple shippers)' : customer?.name ?? '',
                origin,
                destination,
                incoterm,
                sellAmount: isConsol ? 0 : sell,
                isConsolParent: isConsol,
                specialHandling: special || null,
              },
              lines
                .filter((l) => l.buyAmount > 0)
                .map((l) => ({
                  role: l.role,
                  vendorId: l.vendorId,
                  vendorName: mockVendors.find((v) => v.id === l.vendorId)?.name ?? 'Vendor',
                  buyAmount: l.buyAmount,
                })),
            )
            reset()
            onCreated(id)
          }}
        >
          Confirm booking (KINFF ref)
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Mode">
          <Select value={mode} onChange={(e) => setMode(e.target.value as FfMode)}>
            <option>Sea FCL</option>
            <option>Sea LCL</option>
            <option>Air</option>
            <option>Road</option>
            <option>Multimodal</option>
          </Select>
        </Field>
        <Field label="LCL consolidation (parent/child structure)">
          <Select value={isConsol ? 'yes' : 'no'} onChange={(e) => setIsConsol(e.target.value === 'yes')}>
            <option value="no">No — single unit</option>
            <option value="yes">Yes — parent booking, child HBLs added later</option>
          </Select>
        </Field>
        {!isConsol && (
          <Field label="Customer">
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select…</option>
              {mockCustomers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Incoterm">
          <Select value={incoterm} onChange={(e) => setIncoterm(e.target.value)}>
            {INCOTERMS.map((i) => <option key={i}>{i}</option>)}
          </Select>
        </Field>
        <Field label="Origin">
          <TextInput value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g. NHAVA SHEVA" />
        </Field>
        <Field label="Destination">
          <TextInput value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. JEBEL ALI" />
        </Field>
        <Field label="Special handling (hazardous / temp-controlled / oversized)">
          <TextInput value={special} onChange={(e) => setSpecial(e.target.value)} placeholder="None" />
        </Field>
        {!isConsol && (
          <Field label="Consolidated client sell (USD)">
            <TextInput type="number" value={sell || ''} onChange={(e) => setSell(+e.target.value)} />
          </Field>
        )}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Buy side — one line per vendor role
        </p>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select value={l.role} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, role: e.target.value as FfVendorRole } : x)))}>
                <option>Carrier</option>
                <option>Customs</option>
                <option>Trucking</option>
                <option>Warehousing</option>
                <option>Insurance</option>
              </Select>
              <Select value={l.vendorId} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, vendorId: e.target.value } : x)))}>
                {mockVendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </Select>
              <TextInput
                type="number"
                placeholder="Buy $"
                value={l.buyAmount || ''}
                onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, buyAmount: +e.target.value } : x)))}
              />
              <button onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-accent-coral hover:bg-surface-2">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <Button size="sm" variant="secondary" className="mt-2" onClick={() => setLines((ls) => [...ls, { role: 'Trucking', vendorId: 'vn5', buyAmount: 0 }])}>
          <Plus size={13} /> Add vendor line
        </Button>
      </div>

      {!isConsol && (
        <div className="mt-4 rounded-btn border border-line bg-surface-2/60 p-3 text-xs text-body">
          Buy total <span className="font-mono font-semibold">${buy.toLocaleString()}</span> · Estimated GP{' '}
          <span className={`font-mono font-semibold ${sell - buy >= 0 ? 'text-primary' : 'text-accent-coral'}`}>
            ${(sell - buy).toLocaleString()}
          </span>{' '}
          ({margin.toFixed(1)}%)
          {sell > CREDIT_LIMIT_USD && (
            <span className="ml-2 rounded-badge bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-semibold text-[#DC2626]">
              over ${CREDIT_LIMIT_USD.toLocaleString()} credit limit — will hold for Finance sign-off
            </span>
          )}
        </div>
      )}
    </Modal>
  )
}
