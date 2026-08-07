import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/Field'
import { useDataStore } from '../../store/useDataStore'
import type { Party, PartyAuthorizedPerson } from '../../lib/types'

const emptyPerson = { name: '', designation: '', contactNumber: '', email: '', location: '' }

/** Company Authorized Person — shared by AddPartyPage (post-create) and
    PartyDetailPage. */
export function PartyAuthorizedPersonsSection({ party }: { party: Party }) {
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
