import { useEffect, useMemo, useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Select, TextInput } from '../ui/Field'
import { AddableSelect } from '../ui/AddableSelect'
import { PartySearchField } from './PartySearchField'
import { VesselSearchField } from './VesselSearchField'
import { PortSearchField } from './PortSearchField'
import { useDataStore } from '../../store/useDataStore'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabaseClient'
import { mockDepots, mockVendors } from '../../mocks/masters'
import type { ChargeLine, Direction, FreightTerms } from '../../lib/types'

interface DraftCharge {
  chargeCodeId: string
  amount: number
  currency: 'USD' | 'INR'
  vendorId: string | null
}

/** Costing step only offers these three at booking creation — the rest of
    the charge-code master (BL fee, DO fee, Detention, Survey, etc.) is
    still available on the booking detail page's Invoicing tab, added
    post-creation. A future "Local charges master" will extend this list;
    not wired up yet since that master doesn't exist. */
const WIZARD_CHARGE_CODE_IDS = ['cc1', 'cc2', 'cc3']

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (bookingId: string) => void
}

export function NewBookingWizard({ open, onClose, onCreated }: Props) {
  const createBooking = useDataStore((s) => s.createBooking)
  const masters = useDataStore((s) => s.masters)
  const addMasterOption = useDataStore((s) => s.addMasterOption)
  const currentUser = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? currentUser?.role) === 'admin'
  const actor = currentUser?.name ?? 'Ops'
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 — header (doc §1 field grid)
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [direction, setDirection] = useState<Direction>('Export')
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().slice(0, 10))
  const [principal, setPrincipal] = useState('Kinetic Line')
  const [shipper, setShipper] = useState('')
  const [consignee, setConsignee] = useState('')
  const [originAgentId, setOriginAgentId] = useState('')
  const [originAgentName, setOriginAgentName] = useState('')
  const [destAgentId, setDestAgentId] = useState('')
  const [destAgentName, setDestAgentName] = useState('')
  const [freeDaysOrigin, setFreeDaysOrigin] = useState(7)
  const [freeDaysDest, setFreeDaysDest] = useState(14)
  const [transitTime, setTransitTime] = useState(7)
  const [vesselId, setVesselId] = useState('')
  const [vesselName, setVesselName] = useState('')
  const [voyageNo, setVoyageNo] = useState('')
  const [etd, setEtd] = useState('')
  const [eta, setEta] = useState('')
  const [voyages, setVoyages] = useState<{ id: string; voyage: string | null; etd: string | null; eta: string | null }[]>([])
  const [portOfReceipt, setPortOfReceipt] = useState('')
  const [pol, setPol] = useState('')
  const [pod, setPod] = useState('')
  const [finalPlaceOfDischarge, setFinalPlaceOfDischarge] = useState('')
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

  useEffect(() => {
    if (!vesselId) {
      setVoyages([])
      return
    }
    supabase
      .from('vessel_voyages')
      .select('id,voyage,etd,eta')
      .eq('vessel_id', vesselId)
      .order('eta', { ascending: false })
      .then(({ data }) => setVoyages((data as typeof voyages) ?? []))
  }, [vesselId])

  const rateTotal = useMemo(() => {
    // Demo total at a flat FX for display only (real FX comes from currency master later)
    const fx = (c: DraftCharge) => (c.currency === 'INR' ? c.amount / 84 : c.amount)
    return chargeLines.reduce((a, c) => a + fx(c), 0)
  }, [chargeLines])

  const step1Valid =
    !!customerId &&
    !!direction &&
    !!bookingDate &&
    !!principal.trim() &&
    !!originAgentId &&
    !!destAgentId &&
    !!vesselId &&
    !!freightTerms &&
    freeDaysOrigin >= 0 &&
    freeDaysDest >= 0 &&
    transitTime >= 0 &&
    !!surveyorId &&
    !!emptyYardId &&
    !!containerType &&
    containerQty >= 1

  const reset = () => {
    setStep(1)
    setCustomerId('')
    setCustomerName('')
    setShipper('')
    setConsignee('')
    setOriginAgentId('')
    setOriginAgentName('')
    setDestAgentId('')
    setDestAgentName('')
    setVesselId('')
    setVesselName('')
    setVoyageNo('')
    setEtd('')
    setEta('')
    setPortOfReceipt('')
    setPol('')
    setPod('')
    setFinalPlaceOfDischarge('')
    setChargeLines([
      { chargeCodeId: 'cc1', amount: 0, currency: 'USD', vendorId: null },
    ])
  }

  const submit = () => {
    if (!vesselId || !customerId) return
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
        bookingPartyId: customerId,
        bookingPartyName: customerName,
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
        vesselId,
        vesselName,
        voyageNo,
        portOfReceipt,
        pol,
        pod,
        finalPlaceOfDischarge,
        etd,
        eta,
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
      { actor, isAdmin },
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
          <Field label="Booking party (Parties master)" required>
            <PartySearchField
              value={customerName}
              roles={['Importer', 'Exporter']}
              placeholder="Search customer…"
              onSelect={(p) => {
                setCustomerId(p.id)
                setCustomerName(p.name)
              }}
            />
          </Field>
          <Field label="Direction" required>
            <Select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
              <option>Export</option>
              <option>Import</option>
            </Select>
          </Field>
          <Field label="Booking date" required>
            <TextInput type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
          </Field>
          <Field label="Principal" required>
            <TextInput value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          </Field>
          <Field label="Shipper (Parties master)">
            <PartySearchField
              value={shipper}
              roles={['Exporter']}
              placeholder="Search shipper…"
              onSelect={(p) => setShipper(p.name)}
            />
          </Field>
          <Field label="Consignee (Parties master)">
            <PartySearchField
              value={consignee}
              roles={['Importer']}
              placeholder="Search consignee…"
              onSelect={(p) => setConsignee(p.name)}
            />
          </Field>
          <Field label="Origin agent (Parties master)" required>
            <PartySearchField
              value={originAgentName}
              roles={['Forwarder']}
              placeholder="Search agent…"
              onSelect={(p) => {
                setOriginAgentId(p.id)
                setOriginAgentName(p.name)
              }}
            />
          </Field>
          <Field label="Destination agent (Parties master)" required>
            <PartySearchField
              value={destAgentName}
              roles={['Forwarder']}
              placeholder="Search agent…"
              onSelect={(p) => {
                setDestAgentId(p.id)
                setDestAgentName(p.name)
              }}
            />
          </Field>
          <Field label="Vessel (Vessels master)" required>
            <VesselSearchField
              value={vesselName}
              onSelect={(v) => {
                setVesselId(v.id)
                setVesselName(v.name)
                setVoyageNo('')
                setEtd('')
                setEta('')
              }}
            />
          </Field>
          <Field label="Voyage no.">
            {voyages.length > 0 ? (
              <Select
                value={voyageNo}
                onChange={(e) => {
                  const v = voyages.find((x) => x.voyage === e.target.value)
                  setVoyageNo(e.target.value)
                  setEtd(v?.etd ?? etd)
                  setEta(v?.eta ?? eta)
                }}
              >
                <option value="">—</option>
                {voyages.map((v) => (
                  <option key={v.id} value={v.voyage ?? ''}>{v.voyage || '(untitled)'}</option>
                ))}
              </Select>
            ) : (
              <TextInput
                value={voyageNo}
                placeholder={vesselId ? 'No voyages on file' : 'Pick a vessel first'}
                onChange={(e) => setVoyageNo(e.target.value)}
              />
            )}
          </Field>
          <Field label="ETD (origin)">
            <TextInput type="date" value={etd} onChange={(e) => setEtd(e.target.value)} />
          </Field>
          <Field label="ETA (destination)">
            <TextInput type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
          </Field>
          <Field label="Port of Receipt (Sea Ports master)">
            <PortSearchField value={portOfReceipt} placeholder="Search port…" onSelect={setPortOfReceipt} />
          </Field>
          <Field label="Port of Loading (Sea Ports master)">
            <PortSearchField value={pol} placeholder="Search port…" onSelect={setPol} />
          </Field>
          <Field label="Port of Destination (Sea Ports master)">
            <PortSearchField value={pod} placeholder="Search port…" onSelect={setPod} />
          </Field>
          <Field label="Final Place of Discharge (Sea Ports master)">
            <PortSearchField value={finalPlaceOfDischarge} placeholder="Search port…" onSelect={setFinalPlaceOfDischarge} />
          </Field>
          <Field label="Freight terms" required>
            <Select value={freightTerms} onChange={(e) => setFreightTerms(e.target.value as FreightTerms)}>
              <option>Prepaid</option>
              <option>Collect</option>
            </Select>
          </Field>
          <Field label="Free days (origin)" required>
            <TextInput type="number" value={freeDaysOrigin} onChange={(e) => setFreeDaysOrigin(+e.target.value)} />
          </Field>
          <Field label="Free days (destination)" required>
            <TextInput type="number" value={freeDaysDest} onChange={(e) => setFreeDaysDest(+e.target.value)} />
          </Field>
          <Field label="Transit time (days)" required>
            <TextInput type="number" value={transitTime} onChange={(e) => setTransitTime(+e.target.value)} />
          </Field>
          <Field label="Surveyor (vendor master)" required>
            <Select value={surveyorId} onChange={(e) => setSurveyorId(e.target.value)}>
              <option value="">—</option>
              {mockVendors.filter((v) => v.kind === 'Surveyor').map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Empty container yard (depot master)" required>
            <Select value={emptyYardId} onChange={(e) => setEmptyYardId(e.target.value)}>
              <option value="">—</option>
              {mockDepots.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Container type" required>
            <AddableSelect
              value={containerType}
              onChange={setContainerType}
              addLabel="Add container type"
              options={masters.containerTypes.map((t) => ({ value: t, label: t }))}
              onAdd={(name) => addMasterOption('containerTypes', name)}
            />
          </Field>
          <Field label="Container qty" required>
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
        </div>
      ) : (
        <div>
          <p className="mb-1 text-xs text-muted">
            Rate per charge line. Add ad-hoc lines in any currency.
          </p>
          {!isAdmin && (
            <p className="mb-3 text-xs text-accent-orange">
              This costing will go to Admin for approval before it appears on the charge sheet — the booking itself is created immediately.
            </p>
          )}
          <div className="space-y-2">
            {chargeLines.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={c.chargeCodeId}
                  onChange={(e) => setChargeLines((ls) => ls.map((x, j) => (j === i ? { ...x, chargeCodeId: e.target.value } : x)))}
                >
                  {masters.chargeCodes
                    .filter((cc) => WIZARD_CHARGE_CODE_IDS.includes(cc.id))
                    .map((cc) => (
                      <option key={cc.id} value={cc.id}>{cc.name}</option>
                    ))}
                </Select>
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
            onClick={() => setChargeLines((ls) => [...ls, { chargeCodeId: 'cc1', amount: 0, currency: 'USD', vendorId: null }])}
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
