import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Plus } from 'lucide-react'
import { Card } from '../ui/Card'
import { TextInput, Textarea, Select } from '../ui/Field'
import { supabase } from '../../lib/supabaseClient'
import { useDataStore } from '../../store/useDataStore'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import type { Booking } from '../../lib/types'
import { useFieldBinding } from './BookingEditContext'
import {
  fieldsForSection,
  type BookingSection,
  type BookingDocumentFieldSpec,
} from '../../lib/bookingDocumentFields'

/**
 * The booking fields that exist so the generated documents have something to
 * read.
 *
 * These sit inside the booking's own tabs rather than on the documents,
 * because a document never holds its own copy of a value. A blank here is
 * why a document prints a blank — which is the point: the gap is visible on
 * the booking, where someone can fix it, instead of being quietly typed onto
 * one PDF and missing from the next.
 */
export function DocumentFieldsSection({
  booking,
  section,
  title = 'Document details',
}: {
  booking: Booking
  section: BookingSection
  title?: string
}) {
  const update = useDataStore((s) => s.updateBookingDocumentField)
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const role = viewAsRole ?? user?.role
  const canEdit = role === 'admin' || role === 'ops'

  // Joins the booking-wide Edit/Save session: while an Admin is editing,
  // changes here collect in the same draft and are written by one Save.
  const binding = useFieldBinding(booking, (field, _label, value) =>
    update(booking.id, field as Parameters<typeof update>[1], value, user?.name ?? 'Ops'),
  )

  const fields = fieldsForSection(section, booking.direction)
  const needsMasters = fields.some((f) =>
    f.widget === 'depot' || f.widget === 'surveyor' || f.widget === 'cha',
  )

  const [masters, setMasters] = useState<{
    depots: { id: string; name: string }[]
    surveyors: { id: string; name: string }[]
    chas: { id: string; name: string }[]
  }>({ depots: [], surveyors: [], chas: [] })

  useEffect(() => {
    if (!needsMasters) return
    let live = true
    Promise.all([
      supabase.from('empty_depots').select('id, name').order('name'),
      supabase.from('surveyors').select('id, name').order('name'),
      supabase.from('chas').select('id, name').order('name'),
    ]).then(([d, s, c]) => {
      if (!live) return
      setMasters({
        depots: (d.data as { id: string; name: string }[]) ?? [],
        surveyors: (s.data as { id: string; name: string }[]) ?? [],
        chas: (c.data as { id: string; name: string }[]) ?? [],
      })
    })
    return () => {
      live = false
    }
  }, [needsMasters])

  if (fields.length === 0) return null

  const valueOf = (f: BookingDocumentFieldSpec) => binding.value(f.key)

  const commit = (f: BookingDocumentFieldSpec, value: string) => {
    binding.commit(f.key, f.label, value)
  }

  const optionsFor = (f: BookingDocumentFieldSpec) => {
    if (f.widget === 'depot') return masters.depots
    if (f.widget === 'surveyor') return masters.surveyors
    if (f.widget === 'cha') return masters.chas
    return []
  }

  const masterNameFor = (f: BookingDocumentFieldSpec) =>
    f.widget === 'depot' ? 'depots' : f.widget === 'surveyor' ? 'surveyors' : 'CHAs'

  const isMasterWidget = (f: BookingDocumentFieldSpec) =>
    f.widget === 'depot' || f.widget === 'surveyor' || f.widget === 'cha'

  const tableFor = (f: BookingDocumentFieldSpec) =>
    f.widget === 'depot' ? 'empty_depots' : f.widget === 'surveyor' ? 'surveyors' : 'chas'

  const masterKeyFor = (f: BookingDocumentFieldSpec) =>
    f.widget === 'depot' ? 'depots' : f.widget === 'surveyor' ? 'surveyors' : 'chas'

  /** A record created from inside the booking joins the list immediately,
      so the person can carry on rather than losing their place. */
  const addMaster = (f: BookingDocumentFieldSpec, rec: { id: string; name: string }) => {
    const key = masterKeyFor(f) as 'depots' | 'surveyors' | 'chas'
    setMasters((m) => ({
      ...m,
      [key]: [...m[key], rec].sort((a, b) => a.name.localeCompare(b.name)),
    }))
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start gap-2">
        <FileText size={15} className="mt-0.5 text-muted" />
        <div>
          <h3 className="font-display text-sm">{title}</h3>
          <p className="text-xs text-muted">
            Printed on the generated documents. A blank here prints as a blank
            on the document.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <label key={f.key} className="space-y-1">
            <span className="block font-mono text-[10px] uppercase tracking-wide text-muted">
              {f.label}
            </span>

            {isMasterWidget(f) ? (
              <MasterPicker
                value={valueOf(f)}
                options={optionsFor(f)}
                table={tableFor(f)}
                noun={masterNameFor(f)}
                disabled={!canEdit || !binding.canType}
                onChange={(v) => commit(f, v)}
                onCreated={(rec) => addMaster(f, rec)}
              />
            ) : f.widget === 'select' ? (
              <Select
                value={valueOf(f)}
                disabled={!canEdit || !binding.canType}
                onChange={(e) => commit(f, e.target.value)}
              >
                <option value="">— not set —</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            ) : f.widget === 'textarea' ? (
              // Controlled while editing so Cancel visibly reverts the field;
              // uncontrolled otherwise, where a blur-commit is still right for
              // the approval path.
              binding.editing ? (
                <Textarea
                  key={'edit-' + f.key}
                  rows={3}
                  value={valueOf(f)}
                  disabled={!canEdit || !binding.canType}
                  onChange={(e) => commit(f, e.target.value)}
                />
              ) : (
                <Textarea
                  key={'view-' + f.key}
                  rows={3}
                  defaultValue={valueOf(f)}
                  disabled={!canEdit || !binding.canType}
                  onBlur={(e) => commit(f, e.target.value)}
                />
              )
            ) : (
              binding.editing ? (
                <TextInput
                  key={'edit-' + f.key}
                  type={f.widget === 'date' ? 'date' : f.widget === 'number' ? 'number' : 'text'}
                  value={valueOf(f)}
                  disabled={!canEdit || !binding.canType}
                  onChange={(e) => commit(f, e.target.value)}
                />
              ) : (
                <TextInput
                  key={'view-' + f.key}
                  type={f.widget === 'date' ? 'date' : f.widget === 'number' ? 'number' : 'text'}
                  defaultValue={valueOf(f)}
                  disabled={!canEdit || !binding.canType}
                  onBlur={(e) => commit(f, e.target.value)}
                />
              )
            )}

            <span className="block text-[10px] text-muted">{f.usedBy}</span>
          </label>
        ))}
      </div>


    </Card>
  )
}

/**
 * A master-data picker that can also create the record it is missing.
 *
 * Siddharth's instruction for CHAs was "add while making an import booking" —
 * these lists get filled as the work happens, not in a setup phase before it.
 * Sending someone to Master Data mid-booking loses their place, and an empty
 * list used to be a dead end with nothing but a link away from the page.
 */
function MasterPicker({
  value,
  options,
  table,
  noun,
  disabled,
  onChange,
  onCreated,
}: {
  value: string
  options: { id: string; name: string }[]
  table: 'empty_depots' | 'surveyors' | 'chas'
  noun: string
  disabled?: boolean
  onChange: (v: string) => void
  onCreated: (rec: { id: string; name: string }) => void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .from(table)
      .insert({ name: trimmed })
      .select('id, name')
      .single()
    setSaving(false)
    if (err || !data) {
      setError(err?.message ?? 'Could not save')
      return
    }
    const rec = data as { id: string; name: string }
    onCreated(rec)
    onChange(rec.id)
    setName('')
    setAdding(false)
  }

  if (adding) {
    return (
      <div className="space-y-1">
        <TextInput
          autoFocus
          value={name}
          placeholder={`New ${noun.replace(/s$/, '')} name`}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            }
            if (e.key === 'Escape') {
              setAdding(false)
              setName('')
              setError(null)
            }
          }}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving || !name.trim()}
            className="text-xs font-medium text-link hover:underline disabled:text-muted disabled:no-underline"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false)
              setName('')
              setError(null)
            }}
            className="text-xs text-muted hover:text-heading"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <Select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">— not set —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
      {!disabled && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-[11px] font-medium text-link hover:underline"
        >
          <Plus size={11} /> Add {noun.replace(/s$/, '')}
        </button>
      )}
      {options.length === 0 && (
        <p className="text-[11px] text-muted">
          No {noun} yet — add one here, or in{' '}
          <Link to={MASTER_LINKS[table]} className="underline">
            Master Data
          </Link>
          .
        </p>
      )}
    </div>
  )
}

const MASTER_LINKS: Record<'empty_depots' | 'surveyors' | 'chas', string> = {
  empty_depots: '/master/containers/empty-depots',
  surveyors: '/master/surveyors',
  chas: '/master/chas',
}
