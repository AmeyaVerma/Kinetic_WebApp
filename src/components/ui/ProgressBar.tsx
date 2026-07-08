interface Props {
  pct: number
  color?: string
  trackClassName?: string
  height?: number
}

export function ProgressBar({ pct, color = '#3B82F6', height = 5 }: Props) {
  return (
    <div
      className="w-full overflow-hidden rounded-badge bg-surface-2"
      style={{ height }}
    >
      <div
        className="h-full rounded-badge transition-all"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }}
      />
    </div>
  )
}
