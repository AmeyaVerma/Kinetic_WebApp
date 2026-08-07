import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, TextInput, Select, Textarea } from '../../components/ui/Field'
import { PartyBranchesSection } from '../../components/master/PartyBranchesSection'
import { PartyAuthorizedPersonsSection } from '../../components/master/PartyAuthorizedPersonsSection'
import { PartyDocumentsSection } from '../../components/master/PartyDocumentsSection'
import { useDataStore } from '../../store/useDataStore'
import { useCurrentUser } from '../../store/useAuthStore'
import type { Party } from '../../lib/types'

const EXPORTER_IMPORTER_CLASS = ['Exporter', 'Importer', 'Both']
const TYPE_OF_FIRM = ['Proprietorship', 'Partnership', 'LLP', 'Private Limited', 'Public Limited', 'Trust', 'HUF', 'Other']
const MSME_TYPE = ['Micro', 'Small', 'Medium']

type BasicFields = {
  legalName: string
  partyPrefix: string
  accountingCode: string
  legacyUsername: string
  legacyPassword: string
  city: string
  state: string
  country: string
  postalCode: string
  gstin: string
  email: string
  phone: string
  salesPerson: string
  clientCoordinator: string
  exporterImporterClass: string
  exporterImporterType: string
  iec: string
  typeOfFirm: string
  msmeType: string
  msmeNo: string
  pan: string
  bin: string
  cin: string
  tin: string
  dobOrIncorporationDate: string
  remarks: string
}

const emptyBasic: BasicFields = {
  legalName: '',
  partyPrefix: '',
  accountingCode: '',
  legacyUsername: '',
  legacyPassword: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  gstin: '',
  email: '',
  phone: '',
  salesPerson: '',
  clientCoordinator: '',
  exporterImporterClass: '',
  exporterImporterType: '',
  iec: '',
  typeOfFirm: '',
  msmeType: '',
  msmeNo: '',
  pan: '',
  bin: '',
  cin: '',
  tin: '',
  dobOrIncorporationDate: '',
  remarks: '',
}

/** Add Party — matches the legacy app's form layout: basic info + KYC in
    one save, then HO/Branches, Authorized Persons and Documents attach to
    the saved party (they need a real party id to point at). */
export function AddPartyPage() {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const { createParty } = useDataStore()
  const [basic, setBasic] = useState(emptyBasic)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [party, setParty] = useState<Party | null>(null)

  const setField = (k: keyof BasicFields) => (v: string) => setBasic((b) => ({ ...b, [k]: v }))

  const handleCreate = async () => {
    if (!basic.legalName.trim()) {
      setError('Party Name is required.')
      return
    }
    setSaving(true)
    setError(null)
    const { party: created, error: err } = await createParty({
      legalName: basic.legalName.trim(),
      displayName: basic.legalName.trim(),
      addressLine: null,
      city: basic.city || null,
      state: basic.state || null,
      postalCode: basic.postalCode || null,
      country: basic.country || null,
      addressRaw: null,
      pan: basic.pan || null,
      gstin: basic.gstin || null,
      iec: basic.iec || null,
      taxId: null,
      email: basic.email || null,
      phone: basic.phone || null,
      salesPerson: basic.salesPerson || null,
      accountingCode: basic.accountingCode || null,
      partyCodeLegacy: null,
      partyPrefix: basic.partyPrefix || null,
      legacyUsername: basic.legacyUsername || null,
      legacyPassword: basic.legacyPassword || null,
      clientCoordinator: basic.clientCoordinator || null,
      exporterImporterClass: basic.exporterImporterClass || null,
      exporterImporterType: basic.exporterImporterType || null,
      typeOfFirm: basic.typeOfFirm || null,
      msmeType: basic.msmeType || null,
      msmeNo: basic.msmeNo || null,
      cin: basic.cin || null,
      tin: basic.tin || null,
      bin: basic.bin || null,
      dobOrIncorporationDate: basic.dobOrIncorporationDate || null,
      remarks: basic.remarks || null,
    })
    setSaving(false)
    if (err || !created) {
      setError(err ?? 'Could not create party.')
      return
    }
    setParty(created)
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/parties" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Parties
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{party ? party.legalName : 'Add Party'}</h1>
        <p className="mt-1 text-sm text-muted">
          {party
            ? `Party code ${party.code} — add branches, authorized persons and documents below.`
            : 'Basic details and KYC save together as one record; branches, authorized persons and documents attach once saved.'}
        </p>
      </div>

      {!party ? (
        <>
          <Card>
            <CardHeader title="Basic Info" />
            <div className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2">
              <Field label="Party Name *">
                <TextInput value={basic.legalName} onChange={(e) => setField('legalName')(e.target.value)} />
              </Field>
              <Field label="Party Prefix / Manual / Common Code">
                <TextInput value={basic.partyPrefix} onChange={(e) => setField('partyPrefix')(e.target.value)} />
              </Field>
              <Field label="Accounting Code / EDI Code">
                <TextInput value={basic.accountingCode} onChange={(e) => setField('accountingCode')(e.target.value)} />
              </Field>
              <Field label="Sales Person">
                <TextInput value={basic.salesPerson} onChange={(e) => setField('salesPerson')(e.target.value)} />
              </Field>
              <Field label="Client Co-ordinator">
                <TextInput value={basic.clientCoordinator} onChange={(e) => setField('clientCoordinator')(e.target.value)} />
              </Field>
              <Field label="User Name">
                <TextInput value={basic.legacyUsername} onChange={(e) => setField('legacyUsername')(e.target.value)} />
              </Field>
              <Field label="Password">
                <TextInput type="password" value={basic.legacyPassword} onChange={(e) => setField('legacyPassword')(e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Primary Address" />
            <div className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="City">
                <TextInput value={basic.city} onChange={(e) => setField('city')(e.target.value)} />
              </Field>
              <Field label="State">
                <TextInput value={basic.state} onChange={(e) => setField('state')(e.target.value)} />
              </Field>
              <Field label="Country">
                <TextInput value={basic.country} onChange={(e) => setField('country')(e.target.value)} />
              </Field>
              <Field label="Postal Code">
                <TextInput value={basic.postalCode} onChange={(e) => setField('postalCode')(e.target.value)} />
              </Field>
              <Field label="GSTIN">
                <TextInput value={basic.gstin} onChange={(e) => setField('gstin')(e.target.value)} />
              </Field>
              <Field label="Email">
                <TextInput type="email" value={basic.email} onChange={(e) => setField('email')(e.target.value)} />
              </Field>
              <Field label="Phone">
                <TextInput value={basic.phone} onChange={(e) => setField('phone')(e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="KYC (Know Your Customer)" />
            <div className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Exporter / Importer Class">
                <Select value={basic.exporterImporterClass} onChange={(e) => setField('exporterImporterClass')(e.target.value)}>
                  <option value="">—</option>
                  {EXPORTER_IMPORTER_CLASS.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
              </Field>
              <Field label="Exporter / Importer Type">
                <TextInput value={basic.exporterImporterType} onChange={(e) => setField('exporterImporterType')(e.target.value)} />
              </Field>
              <Field label="Importer Exporter Code (IEC)">
                <TextInput value={basic.iec} onChange={(e) => setField('iec')(e.target.value)} />
              </Field>
              <Field label="Type of Firm">
                <Select value={basic.typeOfFirm} onChange={(e) => setField('typeOfFirm')(e.target.value)}>
                  <option value="">—</option>
                  {TYPE_OF_FIRM.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
              </Field>
              <Field label="MSME Type">
                <Select value={basic.msmeType} onChange={(e) => setField('msmeType')(e.target.value)}>
                  <option value="">—</option>
                  {MSME_TYPE.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
              </Field>
              <Field label="MSME No">
                <TextInput value={basic.msmeNo} onChange={(e) => setField('msmeNo')(e.target.value)} />
              </Field>
              <Field label="PAN">
                <TextInput value={basic.pan} onChange={(e) => setField('pan')(e.target.value)} />
              </Field>
              <Field label="BIN">
                <TextInput value={basic.bin} onChange={(e) => setField('bin')(e.target.value)} />
              </Field>
              <Field label="CIN">
                <TextInput value={basic.cin} onChange={(e) => setField('cin')(e.target.value)} />
              </Field>
              <Field label="TIN">
                <TextInput value={basic.tin} onChange={(e) => setField('tin')(e.target.value)} />
              </Field>
              <Field label="Date of Birth (Sole Prop.) / Date of Incorporation">
                <TextInput type="date" value={basic.dobOrIncorporationDate} onChange={(e) => setField('dobOrIncorporationDate')(e.target.value)} />
              </Field>
              <div className="sm:col-span-2 lg:col-span-3">
                <Field label="Remarks">
                  <Textarea value={basic.remarks} onChange={(e) => setField('remarks')(e.target.value)} />
                </Field>
              </div>
            </div>
          </Card>

          {error && <p className="text-sm text-[#DC2626]">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => navigate('/master/parties')}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Saving…' : 'Create Party'}</Button>
          </div>
        </>
      ) : (
        <>
          <PartyBranchesSection party={party} />
          <PartyAuthorizedPersonsSection party={party} />
          <PartyDocumentsSection party={party} actor={user?.name ?? 'Ops'} />

          <div className="flex justify-end">
            <Button onClick={() => navigate('/master/parties')}>Done</Button>
          </div>
        </>
      )}
    </div>
  )
}
