interface Tab {
  key: string
  label: string
  badge?: number
}

interface Props {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
}

export function Tabs({ tabs, active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5 border-b border-line pb-3">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex items-center gap-1.5 rounded-btn px-3.5 py-2 text-[13px] font-medium transition-colors ${
            active === t.key
              ? 'bg-primary text-white shadow-sm'
              : 'text-body hover:bg-surface-2'
          }`}
        >
          {t.label}
          {t.badge !== undefined && t.badge > 0 && (
            <span
              className={`rounded-badge px-1.5 py-0.5 text-[10px] font-bold ${
                active === t.key ? 'bg-white/25 text-white' : 'bg-surface-2 text-heading'
              }`}
            >
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
