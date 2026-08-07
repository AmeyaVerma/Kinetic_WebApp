import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, FieldPill, TextInput } from '../../components/ui/Field'
import { EditableTextPill } from '../../components/ui/EditableTextPill'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabaseClient'
import type { VesselRecord, VesselVoyageRecord } from '../../lib/types'

type VoyageDraft = { voyage: string; eta: string; etd: string; igmNo: string; igmDate: string; terminal: string }
const emptyVoyageDraft: VoyageDraft = { voyage: '', eta: '', etd: '', igmNo: '', igmDate: '', terminal: '' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToVessel(row: any): VesselRecord {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    name: row.name,
    code: row.code,
    vesselType: row.vessel_type,
    nationality: row.nationality,
    buildYear: row.build_year,
    grt: row.grt === null ? null : Number(row.grt),
    nrt: row.nrt === null ? null : Number(row.nrt),
    deadWeight: row.dead_weight === null ? null : Number(row.dead_weight),
    lengthOverall: row.length_overall === null ? null : Number(row.length_overall),
    beam: row.beam === null ? null : Number(row.beam),
    summerDraft: row.summer_draft === null ? null : Number(row.summer_draft),
    winterDraft: row.winter_draft === null ? null : Number(row.winter_draft),
    noOfTanks: row.no_of_tanks,
    imoCode: row.imo_code,
    owner: row.owner,
    masterName: row.master_name,
    serviceName: row.service_name,
    createdAt: row.created_at,
  }
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

const NUMERIC_FIELDS = new Set([
  'buildYear', 'grt', 'nrt', 'deadWeight', 'lengthOverall', 'beam', 'summerDraft', 'winterDraft', 'noOfTanks',
])

/** Master Data → Vessels detail. Fetched live from Supabase by id (not
    from a preloaded store array — see VesselsMasterPage for why) along
    with that vessel's voyage schedule (vessel_voyages, read-only here). */
export function VesselDetailPage() {
  const { id } = useParams<{ id: string }>()
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? user?.role) === 'admin'

  const [vessel, setVessel] = useState<VesselRecord | null>(null)
  const [voyages, setVoyages] = useState<VesselVoyageRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [showAddVoyage, setShowAddVoyage] = useState(false)
  const [voyageDraft, setVoyageDraft] = useState<VoyageDraft>(emptyVoyageDraft)
  const [savingVoyage, setSavingVoyage] = useState(false)
  const [voyageError, setVoyageError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      supabase.from('vessels').select('*').eq('id', id).single(),
      supabase.from('vessel_voyages').select('*').eq('vessel_id', id).order('eta', { ascending: false }),
    ]).then(([vRes, voyRes]) => {
      if (vRes.data) setVessel(rowToVessel(vRes.data))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (voyRes.data) setVoyages((voyRes.data as any[]).map(rowToVoyage))
      setLoading(false)
    })
  }, [id])

  function updateField(field: keyof VesselRecord, value: string) {
    if (!vessel) return
    const column = String(field).replace(/([A-Z])/g, '_$1').toLowerCase()
    const isNumeric = NUMERIC_FIELDS.has(field)
    const parsed = value === '' ? null : isNumeric ? Number(value) : value
    supabase
      .from('vessels')
      .update({ [column]: parsed })
      .eq('id', vessel.id)
      .then(({ error }) => {
        if (error) console.error('updateVessel failed', error)
      })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setVessel((v) => (v ? ({ ...v, [field]: parsed } as any) : v))
  }

  async function handleAddVoyage() {
    if (!vessel) return
    if (!voyageDraft.voyage.trim()) {
      setVoyageError('Voyage is required.')
      return
    }
    setSavingVoyage(true)
    setVoyageError(null)
    const { data, error } = await supabase
      .from('vessel_voyages')
      .insert({
        vessel_id: vessel.id,
        voyage: voyageDraft.voyage.trim(),
        eta: voyageDraft.eta || null,
        etd: voyageDraft.etd || null,
        igm_no: voyageDraft.igmNo || null,
        igm_date: voyageDraft.igmDate || null,
        terminal: voyageDraft.terminal || null,
      })
      .select()
      .single()
    setSavingVoyage(false)
    if (error || !data) {
      setVoyageError(error?.message ?? 'Could not add voyage.')
      return
    }
    setVoyages((v) => [rowToVoyage(data), ...v])
    setVoyageDraft(emptyVoyageDraft)
    setShowAddVoyage(false)
  }

  const text = (label: string, field: keyof VesselRecord, value: string | number | null) =>
    isAdmin ? (
      <EditableTextPill label={label} value={value === null ? '' : String(value)} onChange={(v) => updateField(field, v)} />
    ) : (
      <FieldPill label={label} value={value === null ? '' : String(value)} />
    )

  if (loading || !vessel) {
    return (
      <div className="space-y-5">
        <Link to="/master/vessels" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Vessels
        </Link>
        <Card className="flex h-40 items-center justify-center">
          <p className="text-sm text-muted">{loading ? 'Loading…' : 'Vessel not found.'}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/vessels" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Vessels
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{vessel.name}</h1>
        <p className="mt-1 font-mono text-xs text-muted">
          {[vessel.code, vessel.imoCode && `IMO ${vessel.imoCode}`].filter(Boolean).join(' · ') || '—'}
        </p>
        {!isAdmin && (
          <p className="mt-1 text-xs text-muted">Fields are read-only here — only an Admin can edit vessel details.</p>
        )}
      </div>

      <Card className="p-5">
        <div className="space-y-5">
          <section>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted">Identity</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {text('Code', 'code', vessel.code)}
              {text('IMO Code', 'imoCode', vessel.imoCode)}
              {text('Vessel Type', 'vesselType', vessel.vesselType)}
              {text('Nationality', 'nationality', vessel.nationality)}
              {text('Build Year', 'buildYear', vessel.buildYear)}
            </div>
          </section>

          <section>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted">Specification</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {text('GRT', 'grt', vessel.grt)}
              {text('NRT', 'nrt', vessel.nrt)}
              {text('Dead Weight', 'deadWeight', vessel.deadWeight)}
              {text('Length Overall', 'lengthOverall', vessel.lengthOverall)}
              {text('Beam', 'beam', vessel.beam)}
              {text('Summer Draft', 'summerDraft', vessel.summerDraft)}
              {text('Winter Draft', 'winterDraft', vessel.winterDraft)}
              {text('No. of Tanks', 'noOfTanks', vessel.noOfTanks)}
            </div>
          </section>

          <section>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted">Ownership & Service</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {text('Owner', 'owner', vessel.owner)}
              {text('Master Name', 'masterName', vessel.masterName)}
              {text('Service Name', 'serviceName', vessel.serviceName)}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Voyage Schedule</p>
              {isAdmin && (
                <Button size="sm" variant="secondary" onClick={() => setShowAddVoyage((v) => !v)}>
                  <Plus size={13} /> Add New Voyage
                </Button>
              )}
            </div>

            {isAdmin && showAddVoyage && (
              <div className="mb-3 rounded-btn border border-line bg-surface-2/60 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Voyage">
                    <TextInput value={voyageDraft.voyage} onChange={(e) => setVoyageDraft((d) => ({ ...d, voyage: e.target.value }))} />
                  </Field>
                  <Field label="ETA">
                    <TextInput type="date" value={voyageDraft.eta} onChange={(e) => setVoyageDraft((d) => ({ ...d, eta: e.target.value }))} />
                  </Field>
                  <Field label="ETD">
                    <TextInput type="date" value={voyageDraft.etd} onChange={(e) => setVoyageDraft((d) => ({ ...d, etd: e.target.value }))} />
                  </Field>
                  <Field label="IGM No">
                    <TextInput value={voyageDraft.igmNo} onChange={(e) => setVoyageDraft((d) => ({ ...d, igmNo: e.target.value }))} />
                  </Field>
                  <Field label="IGM Date">
                    <TextInput type="date" value={voyageDraft.igmDate} onChange={(e) => setVoyageDraft((d) => ({ ...d, igmDate: e.target.value }))} />
                  </Field>
                  <Field label="Terminal">
                    <TextInput value={voyageDraft.terminal} onChange={(e) => setVoyageDraft((d) => ({ ...d, terminal: e.target.value }))} />
                  </Field>
                </div>
                {voyageError && <p className="mt-2 text-xs text-[#DC2626]">{voyageError}</p>}
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setShowAddVoyage(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleAddVoyage} disabled={savingVoyage}>{savingVoyage ? 'Saving…' : 'Save Voyage'}</Button>
                </div>
              </div>
            )}

            {voyages.length === 0 ? (
              <div className="rounded-btn border border-line bg-surface-2/60 px-3 py-2">
                <p className="text-[13px] text-muted">No voyages on record for this vessel.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-btn border border-line">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                      <th className="px-3 py-2 font-medium">Voyage</th>
                      <th className="px-3 py-2 font-medium">ETA</th>
                      <th className="px-3 py-2 font-medium">ETD</th>
                      <th className="px-3 py-2 font-medium">IGM No</th>
                      <th className="px-3 py-2 font-medium">IGM Date</th>
                      <th className="px-3 py-2 font-medium">Terminal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voyages.map((voy) => (
                      <tr key={voy.id} className="border-b border-line text-xs text-body last:border-0">
                        <td className="px-3 py-2 font-mono">{voy.voyage || <span className="text-muted">—</span>}</td>
                        <td className="px-3 py-2">{voy.eta || <span className="text-muted">—</span>}</td>
                        <td className="px-3 py-2">{voy.etd || <span className="text-muted">—</span>}</td>
                        <td className="px-3 py-2 font-mono">{voy.igmNo || <span className="text-muted">—</span>}</td>
                        <td className="px-3 py-2">{voy.igmDate || <span className="text-muted">—</span>}</td>
                        <td className="px-3 py-2">{voy.terminal || <span className="text-muted">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </Card>
    </div>
  )
}
