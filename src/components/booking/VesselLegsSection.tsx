import { useEffect, useState } from 'react'
import { Plus, Ship, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { EditableDatePill } from '../ui/EditableDatePill'
import type { Booking, VesselLeg, VesselVoyageRecord } from '../../lib/types'

const EMPTY_LEG: Omit<VesselLeg, 'id'> = {
  vesselId: null,
  vesselName: '',
  voyageNo: '',
  etaOrigin: null,
  etdOrigin: null,
  etaDestination: null,
  portId: null,
  terminal: null,
  plannedGateOpen: null,
  plannedGateClose: null,
  plannedSiCutoff: null,
  plannedVgmCutoff: null,
  plannedCyCutoff: null,
}

/** Legacy bookings (or ones nobody's opened this tab on yet) have no
    vesselLegs array — fall back to a single leg built from the booking's
    flat vessel/voyage/date fields captured at creation. First edit here
    materializes the real array via onChange. */
function legsFromBooking(booking: Booking): VesselLeg[] {
  if (booking.vesselLegs && booking.vesselLegs.length > 0) return booking.vesselLegs
  return [
    {
      id: 'primary',
      vesselId: booking.vesselId,
      vesselName: booking.vesselName,
      voyageNo: booking.voyageNo,
      etaOrigin: null,
      etdOrigin: booking.etd || null,
      etaDestination: booking.eta || null,
      portId: null,
      terminal: booking.terminal ?? null,
      plannedGateOpen: booking.plannedGateOpen ?? null,
      plannedGateClose: booking.plannedGateClose ?? null,
      plannedSiCutoff: booking.plannedSiCutoff ?? null,
      plannedVgmCutoff: booking.plannedVgmCutoff ?? null,
      plannedCyCutoff: booking.plannedCyCutoff ?? null,
    },
  ]
}

/** Vessels section (Shipment details O+D) — one card per vessel leg
    (transhipment support). Vessel/voyage is picked from the Vessels
    master; picking a voyage pre-fills ETD/SOB origin, ETA destination,
    and terminal from that voyage's schedule. */
export function VesselLegsSection({
  booking,
  onChange,
}: {
  booking: Booking
  onChange: (legs: VesselLeg[]) => void
}) {
  const legs = legsFromBooking(booking)
  // Transhipment = No means a single-leg voyage — only one vessel allowed.
  // Yes opens it up to multiple legs (one per transhipment port).
  const multipleAllowed = booking.transhipment === 'Yes'

  const updateLeg = (id: string, patch: Partial<VesselLeg>) => {
    onChange(legs.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }
  const addLeg = () => {
    if (!multipleAllowed) return
    onChange([...legs, { id: `leg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, ...EMPTY_LEG }])
  }
  const removeLeg = (id: string) => {
    if (legs.length <= 1) return
    onChange(legs.filter((l) => l.id !== id))
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Vessels</p>
        <button
          type="button"
          onClick={addLeg}
          disabled={!multipleAllowed}
          title={multipleAllowed ? undefined : 'Set Transhipment to Yes to add more than one vessel'}
          className="flex items-center gap-1 text-xs font-medium text-link hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
        >
          <Plus size={13} /> Add vessel
        </button>
      </div>
      <div className="space-y-4">
        {legs.map((leg, i) => (
          <VesselLegCard
            key={leg.id}
            leg={leg}
            index={i}
            removable={legs.length > 1}
            onChange={(patch) => updateLeg(leg.id, patch)}
            onRemove={() => removeLeg(leg.id)}
          />
        ))}
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToVoyage(row: any): VesselVoyageRecord {
  return {
    id: row.id,
    vesselId: row.vessel_id,
    voyage: row.voyage,
    eta: row.eta,
    etd: row.etd,
    igmNo: row.igm_no,
    igmDate: row.igm_date,
    terminal: row.terminal,
    createdAt: row.created_at,
  }
}

function VesselLegCard({
  leg,
  index,
  removable,
  onChange,
  onRemove,
}: {
  leg: VesselLeg
  index: number
  removable: boolean
  onChange: (patch: Partial<VesselLeg>) => void
  onRemove: () => void
}) {
  const [query, setQuery] = useState(leg.vesselName)
  const [results, setResults] = useState<{ id: string; name: string; code: string | null }[]>([])
  const [open, setOpen] = useState(false)
  const [voyages, setVoyages] = useState<VesselVoyageRecord[]>([])

  useEffect(() => {
    setQuery(leg.vesselName)
  }, [leg.vesselName])

  useEffect(() => {
    if (!leg.vesselId) {
      setVoyages([])
      return
    }
    let cancelled = false
    supabase
      .from('vessel_voyages')
      .select('*')
      .eq('vessel_id', leg.vesselId)
      .order('eta', { ascending: false })
      .then(({ data }) => {
        if (cancelled || !data) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setVoyages((data as any[]).map(rowToVoyage))
      })
    return () => {
      cancelled = true
    }
  }, [leg.vesselId])

  useEffect(() => {
    const q = query.trim()
    if (!q || q === leg.vesselName) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      const safe = q.replace(/[,%]/g, ' ')
      supabase
        .from('vessels')
        .select('id,name,code')
        .ilike('name', `%${safe}%`)
        .order('name', { ascending: true })
        .limit(8)
        .then(({ data }) => setResults((data as { id: string; name: string; code: string | null }[]) ?? []))
    }, 250)
    return () => clearTimeout(t)
  }, [query, leg.vesselName])

  const pickVessel = (v: { id: string; name: string }) => {
    onChange({ vesselId: v.id, vesselName: v.name, voyageNo: '' })
    setQuery(v.name)
    setOpen(false)
  }

  const pickVoyage = (voyageNo: string) => {
    const v = voyages.find((x) => x.voyage === voyageNo)
    onChange({
      voyageNo,
      etdOrigin: v?.etd ?? leg.etdOrigin,
      etaDestination: v?.eta ?? leg.etaDestination,
    })
  }

  // Port/Terminal — sourced only from the Ports/ICDs/Terminals master
  // (sea_ports / sea_port_terminals), never free text. One search box
  // matches LOCODE, terminal code, or port name and picks both at once.
  type TerminalMatch = {
    id: string
    name: string
    code: string | null
    port_id: string
    sea_ports: { id: string; name: string; code: string | null } | null
  }
  const [portQuery, setPortQuery] = useState('')
  const [portResults, setPortResults] = useState<TerminalMatch[]>([])
  const [portOpen, setPortOpen] = useState(false)
  const [portName, setPortName] = useState('')

  useEffect(() => {
    if (!leg.portId) {
      setPortName('')
      return
    }
    let cancelled = false
    supabase
      .from('sea_ports')
      .select('id,name')
      .eq('id', leg.portId)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setPortName(data.name as string)
      })
    return () => {
      cancelled = true
    }
  }, [leg.portId])

  useEffect(() => {
    const q = portQuery.trim()
    if (!q) {
      setPortResults([])
      return
    }
    const t = setTimeout(() => {
      const safe = q.replace(/[,%]/g, ' ')
      supabase
        .from('sea_port_terminals')
        .select('id,name,code,port_id,sea_ports!inner(id,name,code)')
        .or(
          `name.ilike.%${safe}%,code.ilike.%${safe}%,sea_ports.name.ilike.%${safe}%,sea_ports.code.ilike.%${safe}%`
        )
        .order('name', { ascending: true })
        .limit(10)
        .then(({ data }) => setPortResults((data as unknown as TerminalMatch[]) ?? []))
    }, 250)
    return () => clearTimeout(t)
  }, [portQuery])

  const pickTerminal = (m: TerminalMatch) => {
    if (!m.sea_ports) return
    onChange({ portId: m.sea_ports.id, terminal: m.name })
    setPortName(m.sea_ports.name)
    setPortQuery('')
    setPortOpen(false)
  }

  return (
    <div className="rounded-card border border-line bg-surface-2/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-heading">
          <Ship size={13} className="text-primary" /> Vessel {index + 1}
        </p>
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            title="Remove vessel"
            className="text-muted hover:text-accent-red"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="relative">
          <label className="block rounded-btn border border-line bg-surface px-3 py-2 focus-within:border-primary">
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Vessel</p>
            <input
              type="text"
              value={query}
              placeholder="Search vessel…"
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              className="mt-0.5 w-full bg-transparent text-[13px] text-heading focus:outline-none"
            />
          </label>
          {open && results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-btn border border-line bg-surface shadow-lg">
              {results.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onMouseDown={() => pickVessel(v)}
                  className="block w-full px-3 py-2 text-left text-[12px] text-body hover:bg-surface-2"
                >
                  {v.name}
                  {v.code ? ` (${v.code})` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="block rounded-btn border border-line bg-surface px-3 py-2 focus-within:border-primary">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Voyage</p>
          {voyages.length > 0 ? (
            <select
              value={leg.voyageNo}
              onChange={(e) => pickVoyage(e.target.value)}
              className="mt-0.5 w-full bg-transparent text-[13px] text-heading focus:outline-none"
            >
              <option value="" className="bg-white text-[#0F172A]">—</option>
              {voyages.map((v) => (
                <option key={v.id} value={v.voyage ?? ''} className="bg-white text-[#0F172A]">
                  {v.voyage || '(untitled)'}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={leg.voyageNo}
              placeholder={leg.vesselId ? 'No voyages on file' : 'Pick a vessel first'}
              onChange={(e) => onChange({ voyageNo: e.target.value })}
              className="mt-0.5 w-full bg-transparent text-[13px] text-heading placeholder:text-muted focus:outline-none"
            />
          )}
        </label>
        <EditableDatePill label="ETA Origin" value={leg.etaOrigin ?? ''} onChange={(v) => onChange({ etaOrigin: v })} />
        <EditableDatePill
          label="ETD / SOB Origin"
          value={leg.etdOrigin ?? ''}
          onChange={(v) => onChange({ etdOrigin: v })}
        />
        <EditableDatePill
          label="ETA Destination"
          value={leg.etaDestination ?? ''}
          onChange={(v) => onChange({ etaDestination: v })}
        />
        <div className="relative sm:col-span-2">
          <label className="block rounded-btn border border-line bg-surface px-3 py-2 focus-within:border-primary">
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Port / Terminal</p>
            <input
              type="text"
              value={portOpen ? portQuery : leg.terminal ? `${portName} — ${leg.terminal}` : portName}
              placeholder="Search LOCODE, terminal code, or port name…"
              onChange={(e) => {
                setPortQuery(e.target.value)
                setPortOpen(true)
              }}
              onFocus={() => {
                setPortQuery('')
                setPortOpen(true)
              }}
              onBlur={() => setTimeout(() => setPortOpen(false), 150)}
              className="mt-0.5 w-full bg-transparent text-[13px] text-heading focus:outline-none"
            />
          </label>
          {portOpen && portResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-btn border border-line bg-surface shadow-lg">
              {portResults.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={() => pickTerminal(m)}
                  className="block w-full px-3 py-2 text-left text-[12px] text-body hover:bg-surface-2"
                >
                  {m.sea_ports?.name}
                  {m.sea_ports?.code ? ` (${m.sea_ports.code})` : ''} — {m.name}
                  {m.code ? ` (${m.code})` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
        <EditableDatePill
          label="Gate open (planned)"
          value={leg.plannedGateOpen ?? ''}
          onChange={(v) => onChange({ plannedGateOpen: v })}
        />
        <EditableDatePill
          label="Gate close (planned)"
          value={leg.plannedGateClose ?? ''}
          onChange={(v) => onChange({ plannedGateClose: v })}
        />
        <EditableDatePill
          label="SI cut-off (planned)"
          value={leg.plannedSiCutoff ?? ''}
          onChange={(v) => onChange({ plannedSiCutoff: v })}
        />
        <EditableDatePill
          label="Dock Cutoff"
          value={leg.plannedVgmCutoff ?? ''}
          onChange={(v) => onChange({ plannedVgmCutoff: v })}
        />
        <EditableDatePill
          label="CY cut-off (planned)"
          value={leg.plannedCyCutoff ?? ''}
          onChange={(v) => onChange({ plannedCyCutoff: v })}
        />
      </div>
    </div>
  )
}
