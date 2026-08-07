import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { FieldPill, Textarea } from '../../components/ui/Field'
import { EditableTextPill } from '../../components/ui/EditableTextPill'
import { EditableSelectPill } from '../../components/ui/EditableSelectPill'
import { EditableDateOnlyPill } from '../../components/ui/EditableDatePill'
import { Tabs } from '../../components/ui/Tabs'
import { PartyBranchesSection } from '../../components/master/PartyBranchesSection'
import { PartyAuthorizedPersonsSection } from '../../components/master/PartyAuthorizedPersonsSection'
import { PartyDocumentsSection } from '../../components/master/PartyDocumentsSection'
import { useDataStore } from '../../store/useDataStore'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import type { Party } from '../../lib/types'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'branches', label: 'HO/Branches' },
  { key: 'persons', label: 'Authorized Persons' },
  { key: 'documents', label: 'Documents' },
]

const PARTY_TYPES = ['Company', 'Individual', 'Control'] as const
const STATUSES = ['Active', 'Inactive'] as const
const EXPORTER_IMPORTER_CLASS = ['Exporter', 'Importer', 'Both']
const TYPE_OF_FIRM = ['Proprietorship', 'Partnership', 'LLP', 'Private Limited', 'Public Limited', 'Trust', 'HUF', 'Other']
const MSME_TYPE = ['Micro', 'Small', 'Medium']

export function PartyDetailPage() {
  const { code } = useParams<{ code: string }>()
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? user?.role) === 'admin'
  const { parties, fetchParties, fetchPartyChildren, partyBranches, partyAuthorizedPersons, partyDocuments } =
    useDataStore()
  const [tab, setTab] = useState('overview')

  const party = parties.find((p) => p.code === code)

  useEffect(() => {
    if (parties.length === 0) fetchParties()
  }, [parties.length, fetchParties])

  useEffect(() => {
    if (party) fetchPartyChildren(party.id)
  }, [party, fetchPartyChildren])

  if (!party) {
    return (
      <div className="space-y-5">
        <Link to="/master/parties" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Parties
        </Link>
        <Card className="flex h-40 items-center justify-center">
          <p className="text-sm text-muted">{parties.length === 0 ? 'Loading…' : 'Party not found.'}</p>
        </Card>
      </div>
    )
  }

  const branchCount = partyBranches.filter((b) => b.partyId === party.id).length
  const personCount = partyAuthorizedPersons.filter((p) => p.partyId === party.id).length
  const docCount = partyDocuments.filter((d) => d.partyId === party.id).length

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/parties" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Parties
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{party.legalName}</h1>
          {party.isSelf && (
            <span className="rounded-badge bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Kinetic (self)</span>
          )}
          <span
            className={`rounded-badge px-2 py-0.5 text-[10px] font-semibold ${
              party.status === 'Active' ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-surface-2 text-muted'
            }`}
          >
            {party.status}
          </span>
        </div>
        <p className="mt-1 font-mono text-xs text-muted">
          {party.code} · {party.partyType}
          {party.roles.length > 0 && ` · ${party.roles.join(', ')}`}
        </p>
        {!isAdmin && (
          <p className="mt-1 text-xs text-muted">Fields are read-only here — only an Admin can edit party details.</p>
        )}
      </div>

      <Card className="p-5">
        <Tabs
          tabs={TABS.map((t) => ({
            ...t,
            badge: t.key === 'branches' ? branchCount : t.key === 'persons' ? personCount : t.key === 'documents' ? docCount : undefined,
          }))}
          active={tab}
          onChange={setTab}
        />
        <div className="mt-4">
          {tab === 'overview' && (
            <OverviewTab party={party} isAdmin={isAdmin} actor={user?.name ?? 'Admin'} />
          )}
        </div>
      </Card>

      {tab === 'branches' && <PartyBranchesSection party={party} />}
      {tab === 'persons' && <PartyAuthorizedPersonsSection party={party} />}
      {tab === 'documents' && <PartyDocumentsSection party={party} actor={user?.name ?? 'Ops'} />}
    </div>
  )
}

function OverviewTab({ party: p, isAdmin, actor }: { party: Party; isAdmin: boolean; actor: string }) {
  const { updateParty } = useDataStore()
  const [remarksDraft, setRemarksDraft] = useState(p.remarks ?? '')

  const set = (field: keyof Party) => (v: string) => updateParty(p.id, field, v, actor)

  const text = (label: string, field: keyof Party, value: string | null) =>
    isAdmin ? (
      <EditableTextPill label={label} value={value ?? ''} onChange={set(field)} />
    ) : (
      <FieldPill label={label} value={value ?? ''} />
    )

  const select = (label: string, field: keyof Party, value: string | null, options: readonly string[]) =>
    isAdmin ? (
      <EditableSelectPill label={label} value={value ?? ''} options={options} onChange={set(field)} />
    ) : (
      <FieldPill label={label} value={value ?? ''} />
    )

  const date = (label: string, field: keyof Party, value: string | null) =>
    isAdmin ? (
      <EditableDateOnlyPill label={label} value={value ?? ''} onChange={set(field)} />
    ) : (
      <FieldPill label={label} value={value ?? ''} />
    )

  return (
    <div className="space-y-5">
      <section>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted">Basic Info</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {text('Party Name', 'legalName', p.legalName)}
          {select('Party Type', 'partyType', p.partyType, PARTY_TYPES)}
          {select('Status', 'status', p.status, STATUSES)}
          {text('Roles (comma-separated)', 'roles', p.roles.join(', '))}
          {text('Party Prefix', 'partyPrefix', p.partyPrefix)}
          {text('Accounting Code', 'accountingCode', p.accountingCode)}
          {text('Legacy Party Code', 'partyCodeLegacy', p.partyCodeLegacy)}
          {text('Sales Person', 'salesPerson', p.salesPerson)}
          {text('Client Co-ordinator', 'clientCoordinator', p.clientCoordinator)}
          {text('User Name', 'legacyUsername', p.legacyUsername)}
        </div>
      </section>

      <section>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted">Primary Address</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {text('City', 'city', p.city)}
          {text('State', 'state', p.state)}
          {text('Country', 'country', p.country)}
          {text('Postal Code', 'postalCode', p.postalCode)}
          {text('GSTIN', 'gstin', p.gstin)}
          {text('Email', 'email', p.email)}
          {text('Phone', 'phone', p.phone)}
        </div>
        {isAdmin ? (
          <div className="mt-3">
            <label className="block rounded-btn border border-line bg-surface-2/60 px-3 py-2 focus-within:border-primary">
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Address (as imported)</p>
              <input
                type="text"
                defaultValue={p.addressRaw ?? ''}
                onBlur={(e) => {
                  if (e.target.value !== (p.addressRaw ?? '')) updateParty(p.id, 'addressRaw', e.target.value, actor)
                }}
                className="mt-0.5 w-full bg-transparent text-[13px] text-heading focus:outline-none"
              />
            </label>
          </div>
        ) : (
          p.addressRaw && (
            <div className="mt-3 rounded-btn border border-line bg-surface-2/60 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Address (as imported)</p>
              <p className="mt-1 text-[13px] text-body">{p.addressRaw}</p>
            </div>
          )
        )}
      </section>

      <section>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted">KYC (Know Your Customer)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {select('Exporter / Importer Class', 'exporterImporterClass', p.exporterImporterClass, EXPORTER_IMPORTER_CLASS)}
          {text('Exporter / Importer Type', 'exporterImporterType', p.exporterImporterType)}
          {text('IEC', 'iec', p.iec)}
          {select('Type of Firm', 'typeOfFirm', p.typeOfFirm, TYPE_OF_FIRM)}
          {select('MSME Type', 'msmeType', p.msmeType, MSME_TYPE)}
          {text('MSME No', 'msmeNo', p.msmeNo)}
          {text('PAN', 'pan', p.pan)}
          {text('BIN', 'bin', p.bin)}
          {text('CIN', 'cin', p.cin)}
          {text('TIN', 'tin', p.tin)}
          {date('DOB / Incorporation Date', 'dobOrIncorporationDate', p.dobOrIncorporationDate)}
        </div>
        {isAdmin ? (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-body">Remarks</p>
            <Textarea
              value={remarksDraft}
              onChange={(e) => setRemarksDraft(e.target.value)}
              onBlur={() => {
                if (remarksDraft !== (p.remarks ?? '')) updateParty(p.id, 'remarks', remarksDraft, actor)
              }}
            />
          </div>
        ) : (
          p.remarks && (
            <div className="mt-3 rounded-btn border border-line bg-surface-2/60 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Remarks</p>
              <p className="mt-1 text-[13px] text-body">{p.remarks}</p>
            </div>
          )
        )}
      </section>
    </div>
  )
}
