import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Upload, ExternalLink } from 'lucide-react'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, TextInput, Select, Textarea } from '../../components/ui/Field'
import { useDataStore } from '../../store/useDataStore'
import { useCurrentUser } from '../../store/useAuthStore'
import type { Party, PartyAuthorizedPerson } from '../../lib/types'

const EXPORTER_IMPORTER_CLASS = ['Exporter', 'Importer', 'Both']
const TYPE_OF_FIRM = ['Proprietorship', 'Partnership', 'LLP', 'Private Limited', 'Public Limited', 'Trust', 'HUF', 'Other']
const MSME_TYPE = ['Micro', 'Small', 'Medium']
const ADDRESS_TYPE = ['Head Office', 'Branch'] as const

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
          <BranchesSection party={party} />
          <AuthorizedPersonsSection party={party} />
          <DocumentsSection party={party} actor={user?.name ?? 'Ops'} />

          <div className="flex justify-end">
            <Button onClick={() => navigate('/master/parties')}>Done</Button>
          </div>
        </>
      )}
    </div>
  )
}

/* ── HO/Branches ─────────────────────────────────────────────── */

const emptyBranch = {
  addressType: 'Head Office' as (typeof ADDRESS_TYPE)[number],
  city: '',
  address: '',
  state: '',
  country: '',
  postalCode: '',
  gstNumber: '',
}

function BranchesSection({ party }: { party: Party }) {
  const { partyBranches, addPartyBranch } = useDataStore()
  const [draft, setDraft] = useState(emptyBranch)
  const [saving, setSaving] = useState(false)
  const rows = partyBranches.filter((b) => b.partyId === party.id)

  const handleAdd = async () => {
    setSaving(true)
    await addPartyBranch(party.id, {
      addressType: draft.addressType,
      srNo: rows.length,
      city: draft.city || null,
      address: draft.address || null,
      state: draft.state || null,
      country: draft.country || null,
      postalCode: draft.postalCode || null,
      gstNumber: draft.gstNumber || null,
      contactPerson: null,
      email: null,
      phone: null,
      fax: null,
      bankBranch: null,
      accountType: null,
      accountNumber: null,
      ifsc: null,
    })
    setSaving(false)
    setDraft(emptyBranch)
  }

  return (
    <Card>
      <CardHeader title="HO/Branches" />
      <div className="grid grid-cols-1 gap-3 px-5 pb-3 sm:grid-cols-2 lg:grid-cols-6">
        <Field label="Address Type">
          <Select value={draft.addressType} onChange={(e) => setDraft((d) => ({ ...d, addressType: e.target.value as typeof d.addressType }))}>
            {ADDRESS_TYPE.map((o) => <option key={o} value={o}>{o}</option>)}
          </Select>
        </Field>
        <Field label="City">
          <TextInput value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} />
        </Field>
        <Field label="Address">
          <TextInput value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} />
        </Field>
        <Field label="State">
          <TextInput value={draft.state} onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value }))} />
        </Field>
        <Field label="Postal Code">
          <TextInput value={draft.postalCode} onChange={(e) => setDraft((d) => ({ ...d, postalCode: e.target.value }))} />
        </Field>
        <Field label="GST Number">
          <TextInput value={draft.gstNumber} onChange={(e) => setDraft((d) => ({ ...d, gstNumber: e.target.value }))} />
        </Field>
      </div>
      <div className="px-5 pb-4">
        <Button size="sm" onClick={handleAdd} disabled={saving}>
          <Plus size={13} /> Add
        </Button>
      </div>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">City</th>
              <th className="px-3 py-2 font-medium">Address</th>
              <th className="px-3 py-2 font-medium">State</th>
              <th className="px-3 py-2 font-medium">Postal Code</th>
              <th className="px-3 py-2 font-medium">GST Number</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2 font-medium text-heading">{b.addressType}</td>
                <td className="px-3 py-2 text-body">{b.city || '—'}</td>
                <td className="px-3 py-2 text-body">{b.address || '—'}</td>
                <td className="px-3 py-2 text-body">{b.state || '—'}</td>
                <td className="px-3 py-2 text-body">{b.postalCode || '—'}</td>
                <td className="px-3 py-2 font-mono text-body">{b.gstNumber || '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-4 text-center text-muted">No branches added yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ── Company Authorized Person ───────────────────────────────── */

const emptyPerson = { name: '', designation: '', contactNumber: '', email: '', location: '' }

function AuthorizedPersonsSection({ party }: { party: Party }) {
  const { partyAuthorizedPersons, addPartyAuthorizedPerson } = useDataStore()
  const [draft, setDraft] = useState(emptyPerson)
  const [saving, setSaving] = useState(false)
  const rows = partyAuthorizedPersons.filter((p) => p.partyId === party.id)

  const handleAdd = async () => {
    if (!draft.name.trim()) return
    setSaving(true)
    await addPartyAuthorizedPerson(party.id, {
      name: draft.name.trim(),
      designation: draft.designation || null,
      contactNumber: draft.contactNumber || null,
      email: draft.email || null,
      location: draft.location || null,
    })
    setSaving(false)
    setDraft(emptyPerson)
  }

  return (
    <Card>
      <CardHeader title="Company Authorized Person" />
      <div className="grid grid-cols-1 gap-3 px-5 pb-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Name">
          <TextInput value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        </Field>
        <Field label="Designation">
          <TextInput value={draft.designation} onChange={(e) => setDraft((d) => ({ ...d, designation: e.target.value }))} />
        </Field>
        <Field label="Contact Number">
          <TextInput value={draft.contactNumber} onChange={(e) => setDraft((d) => ({ ...d, contactNumber: e.target.value }))} />
        </Field>
        <Field label="email ID">
          <TextInput type="email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
        </Field>
      </div>
      <div className="px-5 pb-4">
        <Button size="sm" onClick={handleAdd} disabled={saving || !draft.name.trim()}>
          <Plus size={13} /> Add
        </Button>
      </div>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Designation</th>
              <th className="px-3 py-2 font-medium">Contact Number</th>
              <th className="px-3 py-2 font-medium">Email ID</th>
              <th className="px-3 py-2 font-medium">Location</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p: PartyAuthorizedPerson) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2 font-medium text-heading">{p.name}</td>
                <td className="px-3 py-2 text-body">{p.designation || '—'}</td>
                <td className="px-3 py-2 text-body">{p.contactNumber || '—'}</td>
                <td className="px-3 py-2 text-body">{p.email || '—'}</td>
                <td className="px-3 py-2 text-body">{p.location || '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-4 text-center text-muted">No authorized persons added yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ── Document Space ──────────────────────────────────────────── */

function DocumentsSection({ party, actor }: { party: Party; actor: string }) {
  const { partyDocuments, uploadPartyDocument, getPartyDocumentUrl } = useDataStore()
  const [file, setFile] = useState<File | null>(null)
  const [docName, setDocName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rows = partyDocuments.filter((d) => d.partyId === party.id)

  const handleUpload = async () => {
    if (!file || !docName.trim()) {
      setError('Choose a file and enter a document name.')
      return
    }
    setUploading(true)
    setError(null)
    const { error: err } = await uploadPartyDocument(party.id, docName.trim(), file, actor)
    setUploading(false)
    if (err) {
      setError(err)
      return
    }
    setFile(null)
    setDocName('')
  }

  const handleOpen = async (storagePath: string) => {
    const url = await getPartyDocumentUrl(storagePath)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Card>
      <CardHeader title="Document Space" />
      <div className="grid grid-cols-1 gap-3 px-5 pb-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
        <Field label="File">
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-body file:mr-3 file:rounded-btn file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-xs file:font-medium file:text-body"
          />
        </Field>
        <Field label="Document Name *">
          <TextInput value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="e.g. GST Certificate" />
        </Field>
        <Button size="sm" onClick={handleUpload} disabled={uploading}>
          <Upload size={13} /> {uploading ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
      {error && <p className="px-5 pb-3 text-xs text-[#DC2626]">{error}</p>}
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
              <th className="px-4 py-2 font-medium">Document</th>
              <th className="px-3 py-2 font-medium">Link</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2 font-medium text-heading">{d.documentName}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => handleOpen(d.storagePath)}
                    className="inline-flex items-center gap-1 text-link hover:underline"
                  >
                    Open <ExternalLink size={11} />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={2} className="px-4 py-4 text-center text-muted">No documents uploaded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
