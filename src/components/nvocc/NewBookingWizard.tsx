import { useMemo, useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Select, TextInput } from '../ui/Field'
import { AddableSelect } from '../ui/AddableSelect'
import { useDataStore } from '../../store/useDataStore'
import {
  mockAgents,
  mockDepots,
  mockVendors,
  mockVessels,
} from '../../mocks/masters'
import type { ChargeLine, Direction, FreightTerms } from '../../lib/types'

interface DraftCharge {
  chargeCodeId: string
  amount: number
  currency: 'USD' | 'INR'
  vendorId: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (bookingId: string) => void
  /** Pre-fill from an accepted quote (doc §0.5c) */
  prefill?: { customerId: string | null; customerName: string; origin: string; destination: string }
}

export function NewBookingWizard({ open, onClose, onCreated, prefill }: Props) {
  const createBooking = useDataStore((s) => s.createBooking)
  const masters = useDataStore((s) => s.masters)
  const addMasterOption = useDataStore((s) => s.addMasterOption)
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 — header (doc §1 field grid)
  const [customerId, setCustomerId] = useState(prefill?.customerId ?? '')
  const [direction, setDirection] = useState<Direction>('Export')
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().slice(0, 10))
  const [principal, setPrincipal] = useState('Kinetic Line')
  const [shipper, setShipper] = useState(prefill?.customerName ?? '')
  const [consignee, setConsignee] = useState('')
  const [originAgentId, setOriginAgentId] = useState('')
  const [destAgentId, setDestAgentId] = useState('')
  const [freeDaysOrigin, setFreeDaysOrigin] = useState(7)
  const [freeDaysDest, setFreeDaysDest] = useState(14)
  const [transitTime, setTransitTime] = useState(7)
  const [vesselId, setVesselId] = useState('')
  const [freightTerms, setFreightTerms] = useState<FreightTerms>('Prepaid')
  const [surveyorId, setSurveyorId] = useState('')
  const [emptyYardId, setEmptyYardId] = useState('')
  const [containerType, setContainerType] = useState('40HC')
  const [containerQty, setContainerQty] = useState(1)
  const [commodity, setCommodity] = useState('')
  const [packages, setPackages] = useState(0)
  const [packageType, setPackageType] = useState('Cartons')
  const [grossWeightKg, setGrossWeightKg] = useState(0)

  // Step 2 — costing (doc §2)
  const [chargeLines, setChargeLines] = useState<DraftCharge[]>([
    { chargeCodeId: 'cc1', amount: 0, currency: 'USD', vendorId: null },
  ])

  const vessel = mockVessels.find((v) => v.id === vesselId)
  const customer = masters.customers.find((c) => c.id === customerId)

  const rateTotal = useMemo(() => {
    // Demo total at a flat FX for display only (real FX comes from currency master later)
    const fx = (c: DraftCharge) => (c.currency === 'INR' ? c.amount / 84 : c.amount)
    return chargeLines.reduce((a, c) => a + fx(c), 0)
  }, [chargeLines])

  const step1Valid = customerId && shipper && consignee && vesselId

  const reset = () => {
    setStep(1)
    setCustomerId('')
    setShipper('')
    setConsignee('')
    setVesselId('')
    setChargeLines([
      { chargeCodeId: 'cc1', amount: 0, currency: 'USD', vendorId: null },
    ])
  }

  const submit = () => {
    if (!vessel || !customer) return
    const charges: Omit<ChargeLine, 'id' | 'bookingId'>[] = chargeLines
      .filter((c) => c.amount > 0)
      .map((c) => ({
        chargeCodeId: c.chargeCodeId,
        chargeName: masters.chargeCodes.find((cc) => cc.id === c.chargeCodeId)?.name ?? 'Charge',
        type: 'sell' as const,
        amount: c.amount,
        currency: c.currency,
        vendorId: c.vendorId,
      }))
    const id = createBooking(
      {
        direction,
        bookingPartyId: customer.id,
        bookingPartyName: customer.name,
        bookingDate,
        principal,
        shipper,
        consignee,
        notifyParty: 'Same as consignee',
        originAgentId: originAgentId || null,
        destinationAgentId: destAgentId || null,
        freeDaysOrigin,
        freeDaysDest,
        transitTime,
        vesselId: vessel.id,
        vesselName: vessel.name,
        voyageNo: vessel.voyageNo,
        pol: vessel.pol,
        pod: vessel.pod,
        etd: vessel.etd,
        eta: vessel.eta,
        freightTerms,
        surveyorId: surveyorId || null,
        emptyYardId: emptyYardId || null,
        containerType,
        containerQty,
        containerNos: [],
        commodity,
        hsCode: '',
        packages,
        packageType,
        grossWeightKg,
        sealNo: '',
      },
      charges,
    )
    reset()
    onCreated(id)
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title={step === 1 ? 'New booking — header' : 'New booking — costing'}
      subtitle={`Step ${step} of 2 · NVOCC module`}
      wide
      footer={
        <>
          {step === 2 && (
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
          )}
          {step === 1 ? (
            <Button disabled={!step1Valid} onClick={() => setStep(2)} className="disabled:opacity-50">
              Next — costing
            </Button>
          ) : (
            <Button onClick={submit}>Create booking</Button>
          )}
        </>
      }
    >
      {step === 1 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Booking party (customer master)">
            <AddableSelect
              value={customerId}
              onChange={setCustomerId}
              placeholder="Select customer…"
              addLabel="Add customer"
              options={masters.customers.map((c) => ({ value: c.id, label: c.name }))}
              onAdd={(name) => addMasterOption('customers', name)}
            />
          </Field>
          <Field label="Direction">
            <Select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
              <option>Export</option>
              <option>Import</option>
            </Select>
          </Field>
          <Field label="Booking date">
            <TextInput type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
          </Field>
          <Field label="Principal">
            <TextInput value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          </Field>
          <Field label="Shipper">
            <TextInput value={shipper} onChange={(e) => setShipper(e.target.value)} placeholder="Shipper name" />
          </Field>
          <Field label="Consignee">
            <TextInput value={consignee} onChange={(e) => setConsignee(e.target.value)} placeholder="Consignee name + address" />
          </Field>
          <Field label="Origin agent">
            <Select value={originAgentId} onChange={(e) => setOriginAgentId(e.target.value)}>
              <option value="">—</option>
              {mockAgents.filter((a) => a.role !== 'destination').map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Destination agent">
            <Select value={destAgentId} onChange={(e) => setDestAgentId(e.target.value)}>
              <option value="">—</option>
              {mockAgents.filter((a) => a.role !== 'origin').map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Vessel (auto-fills voyage, POL, POD, ETD, ETA)">
            <Select value={vesselId} onChange={(e) => setVesselId(e.target.value)}>
              <option value="">Select vessel…</option>
              {mockVessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} / {v.voyageNo} — {v.pol} → {v.pod}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Freight terms">
            <Select value={freightTerms} onChange={(e) => setFreightTerms(e.target.value as FreightTerms)}>
              <option>Prepaid</option>
              <option>Collect</option>
            </Select>
          </Field>
          <Field label="Free days (origin)">
            <TextInput type="number" value={freeDaysOrigin} onChange={(e) => setFreeDaysOrigin(+e.target.value)} />
          </Field>
          <Field label="Free days (destination)">
            <TextInput type="number" value={freeDaysDest} onChange={(e) => setFreeDaysDest(+e.target.value)} />
          </Field>
          <Field label="Transit time (days)">
            <TextInput type="number" value={transitTime} onChange={(e) => setTransitTime(+e.target.value)} />
          </Field>
          <Field label="Surveyor (vendor master)">
            <Select value={surveyorId} onChange={(e) => setSurveyorId(e.target.value)}>
              <option value="">—</option>
              {mockVendors.filter((v) => v.kind === 'Surveyor').map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Empty container yard (depot master)">
            <Select value={emptyYardId} onChange={(e) => setEmptyYardId(e.target.value)}>
              <option value="">—</option>
              {mockDepots.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Container type">
            <AddableSelect
              value={containerType}
              onChange={setContainerType}
              addLabel="Add container type"
              options={masters.containerTypes.map((t) => ({ value: t, label: t }))}
              onAdd={(name) => addMasterOption('containerTypes', name)}
            />
          </Field>
          <Field label="Container qty">
            <TextInput type="number" min={1} value={containerQty} onChange={(e) => setContainerQty(+e.target.value)} />
          </Field>
          <Field label="Commodity">
            <TextInput value={commodity} onChange={(e) => setCommodity(e.target.value)} placeholder="e.g. General cargo" />
          </Field>
          <Field label="Packages">
            <div className="flex gap-2">
              <TextInput type="number" value={packages} onChange={(e) => setPackages(+e.target.value)} />
              <AddableSelect
                value={packageType}
                onChange={setPackageType}
                addLabel="Add package type"
                options={masters.packageTypes.map((t) => ({ value: t, label: t }))}
                onAdd={(name) => addMasterOption('packageTypes', name)}
              />
            </div>
          </Field>
          <Field label="Gross weight (kg)">
            <TextInput type="number" value={grossWeightKg} onChange={(e) => setGrossWeightKg(+e.target.value)} />
          </Field>
          {vessel && (
            <div className="rounded-btn border border-line bg-surface-2/60 p-3 text-xs text-body sm:col-span-2">
              <span className="font-medium text-heading">Auto from vessel master:</span>{' '}
              {vessel.pol} → {vessel.pod} · ETD {vessel.etd} · ETA {vessel.eta} · Carrier {vessel.carrier}
            </div>
          )}
        </div>
      ) : (
        <div>
          <p className="mb-4 text-xs text-muted">
            Rate per charge line. Add ad-hoc lines in any currency.
          </p>
          <div className="space-y-2">
            {chargeLines.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <AddableSelect
                  value={c.chargeCodeId}
                  onChange={(v) => setChargeLines((ls) => ls.map((x, j) => (j === i ? { ...x, chargeCodeId: v } : x)))}
                  addLabel="Add charge code"
                  options={masters.chargeCodes.map((cc) => ({ value: cc.id, label: cc.name }))}
                  onAdd={(name) => addMasterOption('chargeCodes', name)}
                />
                <TextInput
                  type="number"
                  placeholder="Amount"
                  value={c.amount || ''}
                  onChange={(e) => setChargeLines((ls) => ls.map((x, j) => (j === i ? { ...x, amount: +e.target.value } : x)))}
                />
                <Select
                  value={c.currency}
                  onChange={(e) => setChargeLines((ls) => ls.map((x, j) => (j === i ? { ...x, currency: e.target.value as 'USD' | 'INR' } : x)))}
                >
                  <option>USD</option>
                  <option>INR</option>
                </Select>
                <button
                  onClick={() => setChargeLines((ls) => ls.filter((_, j) => j !== i))}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-accent-coral hover:bg-surface-2"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => setChargeLines((ls) => [...ls, { chargeCodeId: 'cc8', amount: 0, currency: 'USD', vendorId: null }])}
          >
            <Plus size={14} /> Add charge line
          </Button>
          <div className="mt-5 rounded-btn border border-line bg-surface-2/60 p-4 text-sm">
            <span className="text-body">Rate total (indicative, USD eq.): </span>
            <span className="font-mono font-semibold text-primary">
              ${rateTotal.toFixed(0)}
            </span>
          </div>
        </div>
      )}
    </Modal>
  )
}
