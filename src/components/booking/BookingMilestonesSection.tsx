import { Check } from 'lucide-react'
import { MarkMilestoneButton } from '../ui/MarkMilestoneButton'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import type { MilestoneDef, MilestoneEntry } from '../../lib/types'

/** Shared "mark these booking milestones from here" block — dropped into
    whichever operational tab owns each milestone key per the Ops mapping
    (Container activities / Documents / Invoicing). The Milestones tab
    itself never uses this — it only ever shows a read-only log. */
export function BookingMilestonesSection({
  title,
  defs,
  entries,
  onMark,
  onEditDate,
}: {
  title: string
  defs: MilestoneDef[]
  entries: MilestoneEntry[]
  onMark: (key: string, completedAt: string) => void
  onEditDate: (key: string, completedAt: string) => void
}) {
  const currentUser = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? currentUser?.role) === 'admin'

  if (defs.length === 0) return null

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="space-y-1.5">
        {defs.map((d) => {
          const entry = entries.find((e) => e.key === d.key && e.completedAt)
          return (
            <div
              key={d.key}
              className={`flex items-center gap-3 rounded-btn border px-4 py-2.5 ${
                entry ? 'border-primary/30 bg-primary/5' : 'border-line bg-surface'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full ${
                  entry ? 'bg-primary text-white' : 'border border-line text-transparent'
                }`}
              >
                <Check size={12} />
              </span>
              <span className={`flex-1 text-[13px] ${entry ? 'font-medium text-heading' : 'text-body'}`}>
                {d.label}
              </span>
              {entry ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-muted">
                    {new Date(entry.completedAt!).toLocaleDateString()} · {entry.completedBy}
                  </span>
                  {isAdmin && (
                    <MarkMilestoneButton
                      initialDate={entry.completedAt!.slice(0, 10)}
                      onConfirm={(date) => onEditDate(d.key, date)}
                    />
                  )}
                </div>
              ) : (
                <MarkMilestoneButton onConfirm={(date) => onMark(d.key, date)} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
