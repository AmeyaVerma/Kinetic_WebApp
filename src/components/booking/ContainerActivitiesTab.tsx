import { useState } from 'react'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { MarkMilestoneButton } from '../ui/MarkMilestoneButton'
import { useDataStore } from '../../store/useDataStore'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import { CONTAINER_ACTIVITY_DEFS } from '../../mocks/seed'

/* ── Origin + destination container activities — generic, keyed by any
   record id (bookingId or FF shipment id share the same store slice).
   When `containerNos` is passed (NVOCC bookings, from Container info's
   per-container rows), each activity is marked per-container: clicking
   the row opens the container list, and the activity only shows done
   once every container has a date. Without it (FF — no per-container
   list exists yet) it falls back to the old single whole-record mark. ── */
export function ContainerActivitiesTab({
  recordId,
  containerNos,
}: {
  recordId: string
  containerNos?: string[]
}) {
  const { containerActivities, containerActivityMarks, markContainerActivity, markContainerActivityForContainer } =
    useDataStore()
  const currentUser = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? currentUser?.role) === 'admin'
  const acts =
    containerActivities[recordId] ?? CONTAINER_ACTIVITY_DEFS.map((d) => ({ ...d, completedAt: null }))
  const marks = containerActivityMarks[recordId] ?? []
  const [openKey, setOpenKey] = useState<string | null>(null)

  const perContainer = !!containerNos && containerNos.length > 0

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
              .map((a) => {
                const markedCount = perContainer
                  ? containerNos!.filter((no) =>
                      marks.some((m) => m.key === a.key && m.containerNo === no && m.completedAt),
                    ).length
                  : 0
                const isOpen = openKey === a.key
                return (
                  <div key={a.key}>
                    <div
                      role={perContainer ? 'button' : undefined}
                      tabIndex={perContainer ? 0 : undefined}
                      onClick={perContainer ? () => setOpenKey(isOpen ? null : a.key) : undefined}
                      onKeyDown={
                        perContainer
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenKey(isOpen ? null : a.key) }
                            }
                          : undefined
                      }
                      className={`flex items-center gap-3 rounded-btn border px-4 py-2.5 ${
                        a.completedAt ? 'border-primary/30 bg-primary/5' : 'border-line bg-surface'
                      } ${perContainer ? 'cursor-pointer' : ''}`}
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
                      {perContainer && !a.completedAt && (
                        <span className="font-mono text-[11px] text-muted">
                          {markedCount}/{containerNos!.length}
                        </span>
                      )}
                      {a.completedAt ? (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <span className="font-mono text-[11px] text-muted">
                            {new Date(a.completedAt).toLocaleDateString()}
                          </span>
                          {!perContainer && isAdmin && (
                            <MarkMilestoneButton
                              initialDate={a.completedAt.slice(0, 10)}
                              onConfirm={(date) =>
                                markContainerActivity(recordId, a.key, date, currentUser?.name ?? 'Admin')
                              }
                            />
                          )}
                        </div>
                      ) : perContainer ? (
                        isOpen ? <ChevronDown size={15} className="text-muted" /> : <ChevronRight size={15} className="text-muted" />
                      ) : (
                        <MarkMilestoneButton onConfirm={(date) => markContainerActivity(recordId, a.key, date)} />
                      )}
                    </div>

                    {perContainer && isOpen && (
                      <div className="mt-1.5 ml-8 space-y-1 rounded-btn border border-line bg-surface-2/40 p-2">
                        {containerNos!.map((no) => {
                          const mark = marks.find((m) => m.key === a.key && m.containerNo === no)
                          return (
                            <div
                              key={no}
                              className="flex items-center justify-between gap-2 rounded-btn px-2.5 py-1.5 text-[12px]"
                            >
                              <span className="font-mono text-body">{no}</span>
                              {mark?.completedAt ? (
                                <div className="flex items-center gap-1.5">
                                  <Check size={12} className="text-primary" />
                                  <span className="font-mono text-[11px] text-muted">
                                    {new Date(mark.completedAt).toLocaleDateString()}
                                  </span>
                                  {isAdmin && (
                                    <MarkMilestoneButton
                                      initialDate={mark.completedAt.slice(0, 10)}
                                      onConfirm={(date) =>
                                        markContainerActivityForContainer(
                                          recordId,
                                          a.key,
                                          no,
                                          date,
                                          currentUser?.name ?? 'Admin',
                                        )
                                      }
                                    />
                                  )}
                                </div>
                              ) : (
                                <MarkMilestoneButton
                                  onConfirm={(date) =>
                                    markContainerActivityForContainer(recordId, a.key, no, date, currentUser?.name)
                                  }
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
