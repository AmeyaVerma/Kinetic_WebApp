import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Link2, Boxes, Ship, DollarSign, ClipboardCheck } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatKpi } from '../components/ui/StatKpi'
import { CsvButton } from '../components/ui/CsvButton'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Field, Select, TextInput } from '../components/ui/Field'
import { useDataStore } from '../store/useDataStore'
import { ffGp, INCOTERMS } from '../lib/ff'
import { mockVendors } from '../mocks/masters'
import { PartySearchField } from '../components/nvocc/PartySearchField'
import { PortSearchField } from '../components/nvocc/PortSearchField'
import type { FfMode, FfShipment, FfStage, FfVendorRole } from '../lib/types'

const STAGE_TONE: Record<FfStage, BadgeTone> = {
  Booking: 'neutral',
  'Carrier & Pickup': 'success',
  Documentation: 'warn',
  'Export & Transit': 'info',
  'Arrival & Delivery': 'success',
  'Financial Close': 'warn',
  Closed: 'done',
}

export function FreightPage() {
  const navigate = useNavigate()
  const [wizardOpen, setWizardOpen] = useState(false)
  const { ffShipments, fetchFfShipments } = useDataStore()

  useEffect(() => {
    fetchFfShipments()
  }, [fetchFfShipments])

  const parents = useMemo(() => ffShipments.filter((f) => !f.parentId), [ffShipments])

  const kpis = useMemo(() => {
    const open = parents.filter((f) => f.stage !== 'Closed')
    const gpTotal = parents.reduce((a, f) => a + ffGp(f).value, 0)
    return {
      total: parents.length,
      open: open.length,
      inTransit: parents.filter((f) => f.stage === 'Export & Transit').length,
      gpTotal,
      docs: parents.filter((f) => f.stage === 'Documentation').length,
    }
  }, [parents])

  const shipmentRows = useMemo(
    () =>
      parents.map((f) => ({
        Ref: f.ref,
        Mode: f.mode,
        Customer: f.customerName,
        Origin: f.origin,
        Destination: f.destination,
        Sell: f.sellAmount,
        GP: ffGp(f).value,
        Stage: f.stage,
      })),
    [parents],
  )

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

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatKpi label="Total Shipments" value={kpis.total} icon={<Boxes size={17} />} tint="#ECFDF5" color="#10B981" />
        <StatKpi label="Open" value={kpis.open} icon={<ClipboardCheck size={17} />} tint="#EFF6FF" color="#3B82F6" />
        <StatKpi label="In Transit" value={kpis.inTransit} icon={<Ship size={17} />} tint="#F5F3FF" color="#8B5CF6" />
        <StatKpi label="In Documentation" value={kpis.docs} icon={<Link2 size={17} />} tint="#FEFCE8" color="#F59E0B" />
        <StatKpi label="Total GP" value={`$${kpis.gpTotal.toLocaleString()}`} icon={<DollarSign size={17} />} tint="#FFF7ED" color="#F97316" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-end border-b border-line px-4 py-2.5">
          <CsvButton filename="freight-shipments" rows={shipmentRows} />
        </div>
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
                    selected={false}
                    onClick={() => navigate(`/freight/${f.id}`)}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <FfWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(id) => { setWizardOpen(false); navigate(`/freight/${id}`) }}
      />
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
        <Badge tone={STAGE_TONE[f.stage]} label={f.stage} />
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
  const [isConsol, setIsConsol] = useState(false)

  // Parties -- from the shared Parties master, not a list of eight mock names.
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [shipperId, setShipperId] = useState<string | null>(null)
  const [shipper, setShipper] = useState('')
  const [consigneeId, setConsigneeId] = useState<string | null>(null)
  const [consignee, setConsignee] = useState('')
  const [notifyId, setNotifyId] = useState<string | null>(null)
  const [notify, setNotify] = useState('')

  // Lane -- ports, never free text. Production holds "jjjjj to j" because this
  // used to be two open text boxes.
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')

  // Cargo
  const [incoterm, setIncoterm] = useState('FOB')
  const [commodity, setCommodity] = useState('')
  const [hsCode, setHsCode] = useState('')
  const [packages, setPackages] = useState('')
  const [grossWeight, setGrossWeight] = useState('')
  const [volume, setVolume] = useState('')
  const [hazardous, setHazardous] = useState(false)
  const [etd, setEtd] = useState('')
  const [eta, setEta] = useState('')

  // Mode-specific
  const [carrierBookingRef, setCarrierBookingRef] = useState('')
  const [awbNo, setAwbNo] = useState('')
  const [airline, setAirline] = useState('')
  const [flightNo, setFlightNo] = useState('')
  const [chargeableWeight, setChargeableWeight] = useState('')
  const [vehicleNo, setVehicleNo] = useState('')
  const [lrNumber, setLrNumber] = useState('')

  const [sell, setSell] = useState(0)
  const [special, setSpecial] = useState('')
  const [daysOfCredit, setDaysOfCredit] = useState(0)
  const [lines, setLines] = useState<DraftVendorLine[]>([
    { role: 'Carrier', vendorId: '', buyAmount: 0 },
  ])

  const isAir = mode === 'Air'
  const isRoad = mode === 'Road'
  const isSea = !isAir && !isRoad

  const buy = lines.reduce((a, l) => a + l.buyAmount, 0)
  const margin = sell > 0 ? ((sell - buy) / sell) * 100 : 0
  const valid = (!!customerId || isConsol) && !!origin && !!destination && (isConsol || sell > 0)

  const reset = () => {
    setCustomerId(null); setCustomerName(''); setShipperId(null); setShipper('')
    setConsigneeId(null); setConsignee(''); setNotifyId(null); setNotify('')
    setOrigin(''); setDestination(''); setSell(0); setIsConsol(false); setSpecial('')
    setCommodity(''); setHsCode(''); setPackages(''); setGrossWeight(''); setVolume('')
    setHazardous(false); setEtd(''); setEta('')
    setCarrierBookingRef(''); setAwbNo(''); setAirline(''); setFlightNo('')
    setChargeableWeight(''); setVehicleNo(''); setLrNumber('')
    setDaysOfCredit(0)
    setLines([{ role: 'Carrier', vendorId: '', buyAmount: 0 }])
  }

  const submit = () => {
    const id = createFfShipment(
      {
        mode,
        customerId,
        customerName: isConsol ? 'Consolidation (multiple shippers)' : customerName,
        bookingPartyId: customerId,
        shipper, shipperPartyId: shipperId,
        consignee, consigneePartyId: consigneeId,
        notifyParty: notify, notifyPartyId: notifyId,
        origin,
        destination,
        incoterm,
        sellAmount: isConsol ? 0 : sell,
        isConsolParent: isConsol,
        specialHandling: special || null,
        daysOfCredit,
        commodity,
        hsCode,
        packages,
        grossWeightKg: grossWeight,
        volumeM3: volume ? Number(volume) : null,
        hazmatStatus: hazardous ? 'Haz' : 'Non-Haz',
        etd,
        eta,
        // Only the block belonging to this mode is sent; the rest stay null
        // rather than carrying a stale value from a mode the user changed
        // away from mid-form.
        carrierBookingRef: isSea ? carrierBookingRef : null,
        awbNo: isAir ? awbNo : null,
        airline: isAir ? airline : null,
        flightNo: isAir ? flightNo : null,
        chargeableWeightKg: isAir && chargeableWeight ? Number(chargeableWeight) : null,
        vehicleNo: isRoad ? vehicleNo : null,
        lrNumber: isRoad ? lrNumber : null,
      },
      lines
        .filter((l) => l.buyAmount > 0 && l.vendorId)
        .map((l) => ({
          role: l.role,
          vendorId: l.vendorId,
          vendorName: mockVendors.find((v) => v.id === l.vendorId)?.name ?? 'Vendor',
          buyAmount: l.buyAmount,
        })),
    )
    reset()
    onCreated(id)
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title="New RKS shipment"
      subtitle="Parties and lane from the shared masters, buy lines per vendor role, one consolidated sell"
      wide
      footer={
        <Button disabled={!valid} className="disabled:opacity-50" onClick={submit}>
          Confirm booking (RKSF ref)
        </Button>
      }
    >
      <div className="space-y-5">
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
              <option value="no">No, single unit</option>
              <option value="yes">Yes, parent booking with child HBLs added later</option>
            </Select>
          </Field>
        </div>

        <FormSection title="Parties" hint="All from the shared Parties master, the same firms Kinetic books.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!isConsol && (
              <Field label="Booking party (customer)" required>
                <PartySearchField
                  value={customerName}
                  roles={['Importer', 'Exporter']}
                  commercialRole="Customer"
                  placeholder="Search customer..."
                  onSelect={(p) => { setCustomerId(p.id); setCustomerName(p.name) }}
                />
              </Field>
            )}
            <Field label="Shipper">
              <PartySearchField
                value={shipper}
                roles={['Exporter']}
                commercialRole="Customer"
                placeholder="Search shipper..."
                onSelect={(p) => { setShipperId(p.id); setShipper(p.name) }}
              />
            </Field>
            <Field label="Consignee">
              <PartySearchField
                value={consignee}
                roles={['Importer']}
                commercialRole="Customer"
                placeholder="Search consignee..."
                onSelect={(p) => { setConsigneeId(p.id); setConsignee(p.name) }}
              />
            </Field>
            <Field label="Notify party">
              <PartySearchField
                value={notify}
                roles={['Importer', 'Exporter']}
                commercialRole="Customer"
                placeholder="Search notify party..."
                onSelect={(p) => { setNotifyId(p.id); setNotify(p.name) }}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Lane" hint="From the port master. Typing these by hand is how production ended up holding a lane called jjjjj to j.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Origin" required>
              <PortSearchField value={origin} placeholder="Search port..." onSelect={setOrigin} />
            </Field>
            <Field label="Destination" required>
              <PortSearchField value={destination} placeholder="Search port..." onSelect={setDestination} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Cargo">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Commodity">
              <TextInput value={commodity} onChange={(e) => setCommodity(e.target.value)} placeholder="e.g. General cargo" />
            </Field>
            <Field label="HS code">
              <TextInput value={hsCode} onChange={(e) => setHsCode(e.target.value)} />
            </Field>
            <Field label="Incoterm">
              <Select value={incoterm} onChange={(e) => setIncoterm(e.target.value)}>
                {INCOTERMS.map((i) => <option key={i}>{i}</option>)}
              </Select>
            </Field>
            <Field label="Packages">
              <TextInput value={packages} onChange={(e) => setPackages(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label="Gross weight (kg)">
              <TextInput value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} inputMode="decimal" />
            </Field>
            <Field label="Volume (cbm)">
              <TextInput value={volume} onChange={(e) => setVolume(e.target.value)} inputMode="decimal" />
            </Field>
            <Field label="ETD">
              <TextInput type="date" value={etd} onChange={(e) => setEtd(e.target.value)} />
            </Field>
            <Field label="ETA">
              <TextInput type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
            </Field>
            <Field label="Hazardous">
              <Select value={hazardous ? 'yes' : 'no'} onChange={(e) => setHazardous(e.target.value === 'yes')}>
                <option value="no">Non-hazardous</option>
                <option value="yes">Hazardous, MSDS required</option>
              </Select>
            </Field>
          </div>
        </FormSection>

        {/* Only the block that belongs to this mode. An air shipment has no
            container and a road shipment has no vessel, so asking for them
            was noise the desk had to ignore. */}
        <FormSection title={isAir ? 'Air' : isRoad ? 'Road' : 'Sea'}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {isSea && (
              <Field label="Carrier booking reference">
                <TextInput value={carrierBookingRef} onChange={(e) => setCarrierBookingRef(e.target.value)} />
              </Field>
            )}
            {isAir && (
              <>
                <Field label="AWB number">
                  <TextInput value={awbNo} onChange={(e) => setAwbNo(e.target.value)} />
                </Field>
                <Field label="Airline">
                  <TextInput value={airline} onChange={(e) => setAirline(e.target.value)} />
                </Field>
                <Field label="Flight number">
                  <TextInput value={flightNo} onChange={(e) => setFlightNo(e.target.value)} />
                </Field>
                <Field label="Chargeable weight (kg)">
                  <TextInput value={chargeableWeight} onChange={(e) => setChargeableWeight(e.target.value)} inputMode="decimal" />
                </Field>
              </>
            )}
            {isRoad && (
              <>
                <Field label="Vehicle number">
                  <TextInput value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
                </Field>
                <Field label="LR number">
                  <TextInput value={lrNumber} onChange={(e) => setLrNumber(e.target.value)} />
                </Field>
              </>
            )}
            <Field label="Special handling">
              <TextInput value={special} onChange={(e) => setSpecial(e.target.value)} placeholder="None" />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Commercials">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {!isConsol && (
              <Field label="Consolidated client sell (USD)" required>
                <TextInput type="number" value={sell || ''} onChange={(e) => setSell(+e.target.value)} />
              </Field>
            )}
            <Field label="Days of credit">
              <TextInput
                type="number"
                min={0}
                max={75}
                value={daysOfCredit || ''}
                onChange={(e) => setDaysOfCredit(Math.max(0, Math.min(75, +e.target.value || 0)))}
                placeholder="0"
              />
            </Field>
          </div>

          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
            Buy side, one line per vendor role
          </p>
          <div className="space-y-2">
            {lines.map((l, i) => {
              const choices = vendorsForRole(l.role)
              return (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    value={l.role}
                    onChange={(e) =>
                      setLines((ls) => ls.map((x, j) => (j === i ? { ...x, role: e.target.value as FfVendorRole, vendorId: '' } : x)))
                    }
                  >
                    <option>Carrier</option>
                    <option>Customs</option>
                    <option>Trucking</option>
                    <option>Warehousing</option>
                    <option>Insurance</option>
                  </Select>
                  <Select
                    value={l.vendorId}
                    onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, vendorId: e.target.value } : x)))}
                  >
                    <option value="">
                      {choices.length ? 'Select vendor...' : 'No ' + l.role.toLowerCase() + ' vendors on file'}
                    </option>
                    {choices.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </Select>
                  <TextInput
                    type="number"
                    placeholder="Buy $"
                    value={l.buyAmount || ''}
                    onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, buyAmount: +e.target.value } : x)))}
                  />
                  <button
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-accent-coral hover:bg-surface-2"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )
            })}
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => setLines((ls) => [...ls, { role: 'Trucking', vendorId: '', buyAmount: 0 }])}
          >
            <Plus size={13} /> Add vendor line
          </Button>

          {!isConsol && sell > 0 && (
            <div className="mt-4 rounded-btn border border-line bg-surface-2/60 p-3 text-sm">
              <span className="text-body">Estimated GP: </span>
              <span className="font-mono font-semibold text-primary">
                ${(sell - buy).toLocaleString()} ({margin.toFixed(0)}%)
              </span>
            </div>
          )}
        </FormSection>
      </div>
    </Modal>
  )
}

/** A titled group inside the booking form. */
function FormSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-surface-2/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {hint && <p className="mb-3 mt-0.5 text-[11px] text-muted">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </div>
  )
}

/**
 * Vendors that can actually fill a given buy line.
 *
 * The spec: "Vendor lines filtered by role. A Carrier line currently offers a
 * surveyor and a repair shop as options." Until the Vendors master exists this
 * maps onto the kinds the mock list already carries: still the wrong source,
 * but no longer the wrong vendors.
 */
function vendorsForRole(role: FfVendorRole) {
  const kinds: Record<FfVendorRole, string[]> = {
    Carrier: ['Shipping line'],
    Customs: ['Broker'],
    Trucking: ['Trucker'],
    Warehousing: ['CFS'],
    Insurance: [],
  }
  return mockVendors.filter((v) => kinds[role].includes(v.kind))
}

