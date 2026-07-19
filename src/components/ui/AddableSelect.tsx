import { useState } from 'react'
import { Plus, Check, X } from 'lucide-react'
import { Select } from './Field'

export interface Option {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: Option[]
  /** Adds a new option to the underlying master list; returns the new value to select. */
  onAdd: (name: string) => string
  placeholder?: string
  /** Label for the "add" affordance, e.g. "Add customer". */
  addLabel?: string
}

/**
 * A <select> with an inline "+ Add" affordance. Picking "Add" reveals a small
 * text input; submitting appends the value to the master list (via onAdd) and
 * selects it immediately — so new options reflect in the data without leaving
 * the form. Used wherever a dropdown is backed by an extensible master list.
 */
export function AddableSelect({ value, onChange, options, onAdd, placeholder, addLabel = 'Add new' }: Props) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const commit = () => {
    const newValue = onAdd(draft)
    if (newValue) onChange(newValue)
    setDraft('')
    setAdding(false)
  }

  if (adding) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { setDraft(''); setAdding(false) }
          }}
          placeholder={addLabel + '…'}
          className="w-full rounded-input border border-primary bg-surface px-3 py-2 text-sm text-heading placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="button"
          onClick={commit}
          disabled={!draft.trim()}
          title="Add"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn bg-primary text-white hover:bg-primary-hover disabled:opacity-40"
        >
          <Check size={15} />
        </button>
        <button
          type="button"
          onClick={() => { setDraft(''); setAdding(false) }}
          title="Cancel"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn text-muted hover:bg-surface-2"
        >
          <X size={15} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
      <button
        type="button"
        onClick={() => setAdding(true)}
        title={addLabel}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn border border-line text-primary hover:bg-primary/10"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}
