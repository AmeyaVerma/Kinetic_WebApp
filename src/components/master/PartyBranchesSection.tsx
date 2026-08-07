import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { Field, TextInput, Select } from '../ui/Field'
import { useDataStore } from '../../store/useDataStore'
import type { Party } from '../../lib/types'

const ADDRESS_TYPE = ['Head Office', 'Branch'] as const

const emptyBranch = {
  addressType: 'Head Office' as (typeof ADDRESS_TYPE)[number],
  city: '',
  address: '',
  state: '',
  country: '',
  postalCode: '',
  gstNumber: '',
}

/** HO/Branches — a party can have several registered addresses, each with
    its own GST number. Shared by AddPartyPage (post-create) and
    PartyDetailPage. */
export function PartyBranchesSection({ party }: { party: Party }) {
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
