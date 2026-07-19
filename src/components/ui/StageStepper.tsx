interface Props {
  stages: string[]
  /** Index of the current stage; earlier stages read as done, later as upcoming. -1 = none active. */
  currentIndex: number
}

/**
 * Horizontal stage roadmap — pills joined by arrows, the current one filled,
 * earlier ones tinted, later ones muted. (Relocated from the FF detail view.)
 */
export function StageStepper({ stages, currentIndex }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {stages.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <span
            className={`rounded-badge px-2.5 py-1 text-[11px] font-medium ${
              i < currentIndex
                ? 'bg-primary/15 text-primary'
                : i === currentIndex
                  ? 'bg-primary text-white'
                  : 'bg-surface-2 text-muted'
            }`}
          >
            {s}
          </span>
          {i < stages.length - 1 && <span className="text-line">→</span>}
        </div>
      ))}
    </div>
  )
}
