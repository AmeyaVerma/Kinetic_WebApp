import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, TextInput } from '../../components/ui/Field'
import { supabase } from '../../lib/supabaseClient'
import type { VesselRecord, VesselVoyageRecord } from '../../lib/types'

type VesselFields = {
  name: string
  code: string
  vesselType: string
  nationality: string
  buildYear: string
  grt: string
  nrt: string
  deadWeight: string
  lengthOverall: string
  beam: string
  summerDraft: string
  winterDraft: string
  noOfTanks: string
  imoCode: string
  owner: string
  masterName: string
  serviceName: string
}

const emptyVessel: VesselFields = {
  name: '',
  code: '',
  vesselType: '',
  nationality: '',
  buildYear: '',
  grt: '',
  nrt: '',
  deadWeight: '',
  lengthOverall: '',
  beam: '',
  summerDraft: '',
  winterDraft: '',
  noOfTanks: '',
  imoCode: '',
  owner: '',
  masterName: '',
  serviceName: '',
}

type VoyageFields = {
  voyage: string
  eta: string
  etd: string
  igmNo: string
  igmDate: string
  terminal: string
}

const emptyVoyage: VoyageFields = { voyage: '', eta: '', etd: '', igmNo: '', igmDate: '', terminal: '' }

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

/** Add Vessel — mirrors the legacy "Vessel Master" screen: vessel identity
    fields save as one record first, then Voyage Details (Add New Voyage +
    Voyage List) attach to the saved vessel, same two-phase flow as
    AddPartyPage (branches/persons/documents attach after the party saves). */
export function AddVesselPage() {
  const navigate = useNavigate()
  const [fields, setFields] = useState(emptyVessel)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vessel, setVessel] = useState<VesselRecord | null>(null)

  const [voyageFields, setVoyageFields] = useState(emptyVoyage)
  const [voyages, setVoyages] = useState<VesselVoyageRecord[]>([])
  const [savingVoyage, setSavingVoyage] = useState(false)
  const [voyageError, setVoyageError] = useState<string | null>(null)

  const setField = (k: keyof VesselFields) => (v: string) => setFields((f) => ({ ...f, [k]: v }))
  const setVoyageField = (k: keyof VoyageFields) => (v: string) => setVoyageFields((f) => ({ ...f, [k]: v }))

  const handleCreate = async () => {
    if (!fields.name.trim() || !fields.code.trim() || !fields.vesselType.trim() || !fields.nationality.trim() || !fields.grt.trim() || !fields.nrt.trim()) {
      setError('Vessel Name, Vessel Code, Vessel Type, Vessel Nationality, GRT and NRT are required.')
      return
    }
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('vessels')
      .insert({
        name: fields.name.trim(),
        code: fields.code.trim(),
        vessel_type: fields.vesselType.trim(),
        nationality: fields.nationality.trim(),
        build_year: fields.buildYear ? Number(fields.buildYear) : null,
        grt: Number(fields.grt),
        nrt: Number(fields.nrt),
        dead_weight: fields.deadWeight ? Number(fields.deadWeight) : null,
        length_overall: fields.lengthOverall ? Number(fields.lengthOverall) : null,
        beam: fields.beam ? Number(fields.beam) : null,
        summer_draft: fields.summerDraft ? Number(fields.summerDraft) : null,
        winter_draft: fields.winterDraft ? Number(fields.winterDraft) : null,
        no_of_tanks: fields.noOfTanks ? Number(fields.noOfTanks) : null,
        imo_code: fields.imoCode || null,
        owner: fields.owner || null,
        master_name: fields.masterName || null,
        service_name: fields.serviceName || null,
      })
      .select()
      .single()
    setSaving(false)
    if (err || !data) {
      setError(err?.message ?? 'Could not create vessel.')
      return
    }
    setVessel(rowToVessel(data))
  }

  const handleAddVoyage = async () => {
    if (!vessel) return
    if (!voyageFields.voyage.trim()) {
      setVoyageError('Voyage is required.')
      return
    }
    setSavingVoyage(true)
    setVoyageError(null)
    const { data, error: err } = await supabase
      .from('vessel_voyages')
      .insert({
        vessel_id: vessel.id,
        voyage: voyageFields.voyage.trim(),
        eta: voyageFields.eta || null,
        etd: voyageFields.etd || null,
        igm_no: voyageFields.igmNo || null,
        igm_date: voyageFields.igmDate || null,
        terminal: voyageFields.terminal || null,
      })
      .select()
      .single()
    setSavingVoyage(false)
    if (err || !data) {
      setVoyageError(err?.message ?? 'Could not add voyage.')
      return
    }
    setVoyages((v) => [...v, rowToVoyage(data)])
    setVoyageFields(emptyVoyage)
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/vessels" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Vessels
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{vessel ? vessel.name : 'Add New Vessel'}</h1>
        <p className="mt-1 text-sm text-muted">
          {vessel
            ? 'Vessel saved — add its voyage schedule below, or come back and add more later from the vessel detail page.'
            : 'Vessel identity fields save as one record; voyages attach once the vessel is saved.'}
        </p>
      </div>

      {!vessel ? (
        <>
          <Card>
            <CardHeader title="Vessel Master" />
            <div className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Vessel Name *">
                <TextInput value={fields.name} onChange={(e) => setField('name')(e.target.value)} />
              </Field>
              <Field label="Vessel Code (Call Sign) *">
                <TextInput value={fields.code} onChange={(e) => setField('code')(e.target.value)} />
              </Field>
              <Field label="Vessel Type *">
                <TextInput value={fields.vesselType} onChange={(e) => setField('vesselType')(e.target.value)} />
              </Field>
              <Field label="Vessel Nationality *">
                <TextInput value={fields.nationality} onChange={(e) => setField('nationality')(e.target.value)} />
              </Field>
              <Field label="Year of Build">
                <TextInput type="number" value={fields.buildYear} onChange={(e) => setField('buildYear')(e.target.value)} />
              </Field>
              <Field label="GRT *">
                <TextInput type="number" value={fields.grt} onChange={(e) => setField('grt')(e.target.value)} />
              </Field>
              <Field label="NRT *">
                <TextInput type="number" value={fields.nrt} onChange={(e) => setField('nrt')(e.target.value)} />
              </Field>
              <Field label="Dead Weight">
                <TextInput type="number" value={fields.deadWeight} onChange={(e) => setField('deadWeight')(e.target.value)} />
              </Field>
              <Field label="Length Overall">
                <TextInput type="number" value={fields.lengthOverall} onChange={(e) => setField('lengthOverall')(e.target.value)} />
              </Field>
              <Field label="Beam (Width)">
                <TextInput type="number" value={fields.beam} onChange={(e) => setField('beam')(e.target.value)} />
              </Field>
              <Field label="Summer Draft">
                <TextInput type="number" value={fields.summerDraft} onChange={(e) => setField('summerDraft')(e.target.value)} />
              </Field>
              <Field label="Winter Draft">
                <TextInput type="number" value={fields.winterDraft} onChange={(e) => setField('winterDraft')(e.target.value)} />
              </Field>
              <Field label="Number of Tanks">
                <TextInput type="number" value={fields.noOfTanks} onChange={(e) => setField('noOfTanks')(e.target.value)} />
              </Field>
              <Field label="IMO Code">
                <TextInput value={fields.imoCode} onChange={(e) => setField('imoCode')(e.target.value)} />
              </Field>
              <Field label="Vessel Owner">
                <TextInput value={fields.owner} onChange={(e) => setField('owner')(e.target.value)} />
              </Field>
              <Field label="Name of the Master">
                <TextInput value={fields.masterName} onChange={(e) => setField('masterName')(e.target.value)} />
              </Field>
              <Field label="Service Name">
                <TextInput value={fields.serviceName} onChange={(e) => setField('serviceName')(e.target.value)} />
              </Field>
            </div>
          </Card>

          {error && <p className="text-sm text-[#DC2626]">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => navigate('/master/vessels')}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Saving…' : 'Create Vessel'}</Button>
          </div>
        </>
      ) : (
        <>
          <Card className="overflow-hidden">
            <CardHeader title="Voyage Details" />
            <div className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Voyage">
                <TextInput value={voyageFields.voyage} onChange={(e) => setVoyageField('voyage')(e.target.value)} />
              </Field>
              <Field label="ETA">
                <TextInput type="date" value={voyageFields.eta} onChange={(e) => setVoyageField('eta')(e.target.value)} />
              </Field>
              <Field label="ETD">
                <TextInput type="date" value={voyageFields.etd} onChange={(e) => setVoyageField('etd')(e.target.value)} />
              </Field>
              <Field label="IGM No">
                <TextInput value={voyageFields.igmNo} onChange={(e) => setVoyageField('igmNo')(e.target.value)} />
              </Field>
              <Field label="IGM Date">
                <TextInput type="date" value={voyageFields.igmDate} onChange={(e) => setVoyageField('igmDate')(e.target.value)} />
              </Field>
              <Field label="Terminal">
                <TextInput value={voyageFields.terminal} onChange={(e) => setVoyageField('terminal')(e.target.value)} />
              </Field>
            </div>
            {voyageError && <p className="px-5 pb-3 text-sm text-[#DC2626]">{voyageError}</p>}
            <div className="flex justify-end px-5 pb-5">
              <Button size="sm" onClick={handleAddVoyage} disabled={savingVoyage}>
                <Plus size={13} /> {savingVoyage ? 'Adding…' : 'Add New Voyage'}
              </Button>
            </div>

            <div className="overflow-x-auto border-t border-line">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-5 py-3 font-medium">Voyage</th>
                    <th className="px-3 py-3 font-medium">ETA</th>
                    <th className="px-3 py-3 font-medium">ETD</th>
                    <th className="px-3 py-3 font-medium">IGM No</th>
                    <th className="px-3 py-3 font-medium">IGM Date</th>
                    <th className="px-5 py-3 font-medium">Terminal</th>
                  </tr>
                </thead>
                <tbody>
                  {voyages.map((voy) => (
                    <tr key={voy.id} className="border-b border-line text-xs text-body last:border-0">
                      <td className="px-5 py-3 font-mono">{voy.voyage}</td>
                      <td className="px-3 py-3">{voy.eta || <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-3">{voy.etd || <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-3 font-mono">{voy.igmNo || <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-3">{voy.igmDate || <span className="text-muted">—</span>}</td>
                      <td className="px-5 py-3">{voy.terminal || <span className="text-muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {voyages.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted">No voyages added yet.</p>}
            </div>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => navigate(`/master/vessels/${vessel.id}`)}>Done</Button>
          </div>
        </>
      )}
    </div>
  )
}
