import { useState } from 'react'
import { Plus, Trash2, X, Check } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Field, Select, TextInput } from '../ui/Field'
import { useDataStore } from '../../store/useDataStore'
import type { CustomFieldType } from '../../lib/types'

const TYPE_OPTIONS: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
]

/**
 * User-defined fields on the booking record (Workflow §11). Definitions are
 * global for the entity (apply to every booking); values are per booking.
 * Config-driven so this becomes a tenant's own schema later — no code change.
 */
export function CustomFieldsCard({ bookingId }: { bookingId: string }) {
  const {
    customFieldDefs,
    customFieldValues,
    addCustomFieldDef,
    removeCustomFieldDef,
    setCustomFieldValue,
  } = useDataStore()

  const defs = customFieldDefs.filter((d) => d.entity === 'booking')
  const values = customFieldValues[bookingId] ?? {}

  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [type, setType] = useState<CustomFieldType>('text')
  const [optionsText, setOptionsText] = useState('')

  const reset = () => { setLabel(''); setType('text'); setOptionsText(''); setAdding(false) }
  const canSave = label.trim() && (type !== 'select' || optionsText.trim())

  const save = () => {
    const options =
      type === 'select'
        ? optionsText.split(',').map((o) => o.trim()).filter(Boolean)
        : []
    addCustomFieldDef({ entity: 'booking', label: label.trim(), type, options })
    reset()
  }

  return (
    <Card>
      <div className="flex items-center justify-between px-5 pt-5">
        <div>
          <h3 className="text-[15px] font-semibold">Custom fields</h3>
          <p className="text-xs text-muted">
            User-defined fields — apply to every booking; values save per booking.
          </p>
        </div>
        {!adding && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus size={14} /> Add field
          </Button>
        )}
      </div>

      <div className="space-y-3 px-5 pb-5 pt-4">
        {defs.length === 0 && !adding && (
          <p className="rounded-btn border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            No custom fields yet — click “Add field” to define one.
          </p>
        )}

        {defs.map((d) => (
          <div key={d.id} className="grid grid-cols-[1fr_1.5fr_auto] items-center gap-3">
            <span className="text-[13px] font-medium text-heading">{d.label}</span>
            {d.type === 'select' ? (
              <Select
                value={values[d.id] ?? ''}
                onChange={(e) => setCustomFieldValue(bookingId, d.id, e.target.value)}
              >
                <option value="">—</option>
                {d.options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            ) : (
              <TextInput
                type={d.type === 'number' ? 'number' : d.type === 'date' ? 'date' : 'text'}
                value={values[d.id] ?? ''}
                onChange={(e) => setCustomFieldValue(bookingId, d.id, e.target.value)}
                placeholder={`Enter ${d.label.toLowerCase()}`}
              />
            )}
            <button
              onClick={() => removeCustomFieldDef(d.id)}
              title="Delete this field (removes it from all bookings)"
              className="flex h-8 w-8 items-center justify-center rounded-btn text-muted hover:bg-surface-2 hover:text-accent-coral"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {adding && (
          <div className="space-y-3 rounded-btn border border-line bg-surface-2/50 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Field name">
                <TextInput
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Special instructions"
                  autoFocus
                />
              </Field>
              <Field label="Field type">
                <Select value={type} onChange={(e) => setType(e.target.value as CustomFieldType)}>
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </Field>
              {type === 'select' && (
                <Field label="Dropdown options (comma-separated)">
                  <TextInput
                    value={optionsText}
                    onChange={(e) => setOptionsText(e.target.value)}
                    placeholder="e.g. Low, Medium, High"
                  />
                </Field>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={!canSave} className="disabled:opacity-50" onClick={save}>
                <Check size={14} /> Add field
              </Button>
              <Button size="sm" variant="ghost" onClick={reset}>
                <X size={14} /> Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
