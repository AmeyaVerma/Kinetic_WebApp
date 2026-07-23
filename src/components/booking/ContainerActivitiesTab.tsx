import { Check } from 'lucide-react'
import { MarkMilestoneButton } from '../ui/MarkMilestoneButton'
import { useDataStore } from '../../store/useDataStore'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import { CONTAINER_ACTIVITY_DEFS } from '../../mocks/seed'

/* ── Origin + destination container activities — generic, keyed by any
   record id (bookingId or FF shipment id share the same store slice). ── */
export function ContainerActivitiesTab({ recordId }: { recordId: string }) {
  const { containerActivities, markContainerActivity } = useDataStore()
  const currentUser = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? currentUser?.role) === 'admin'
  const acts =
    containerActivities[recordId] ?? CONTAINER_ACTIVITY_DEFS.map((d) => ({ ...d, completedAt: null }))

  const sections = [
    { key: 'origin' as const, label: 'Origin activities' },
    { key: 'destination' as const, label: 'Destination activities' },
  ]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {sections.map((sec) => (
        <div key={sec.key}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{sec.label}</p>
          <div className="space-y-1.5">
            {acts
              .filter((a) => a.section === sec.key)
              .map((a) => (
                <div
                  key={a.key}
                  className={`flex items-center gap-3 rounded-btn border px-4 py-2.5 ${
                    a.completedAt ? 'border-primary/30 bg-primary/5' : 'border-line bg-surface'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${
                      a.completedAt ? 'bg-primary text-white' : 'border border-line text-transparent'
                    }`}
                  >
                    <Check size={12} />
                  </span>
                  <span className={`flex-1 text-[13px] ${a.completedAt ? 'font-medium text-heading' : 'text-body'}`}>
                    {a.label}
                  </span>
                  {a.completedAt ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-muted">
                        {new Date(a.completedAt).toLocaleDateString()}
                      </span>
                      {isAdmin && (
                        <MarkMilestoneButton
                          initialDate={a.completedAt.slice(0, 10)}
                          onConfirm={(date) =>
                            markContainerActivity(recordId, a.key, date, currentUser?.name ?? 'Admin')
                          }
                        />
                      )}
                    </div>
                  ) : (
                    <MarkMilestoneButton onConfirm={(date) => markContainerActivity(recordId, a.key, date)} />
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
