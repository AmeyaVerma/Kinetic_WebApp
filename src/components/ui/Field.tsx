import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const inputCls =
  'w-full rounded-input border border-[#E5E7EB] dark:border-line bg-surface px-3.5 py-2.5 text-sm text-heading placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-body">{label}</span>
      {children}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputCls} {...props} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={4} className={`${inputCls} resize-y`} {...props} />
}

export function Select({ children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={inputCls} {...rest}>
      {children}
    </select>
  )
}

/** Read-only field pill matching the workflow doc's field grid */
export function FieldPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-btn border border-line bg-surface-2/60 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-[13px] text-heading">{value || '—'}</p>
    </div>
  )
}
