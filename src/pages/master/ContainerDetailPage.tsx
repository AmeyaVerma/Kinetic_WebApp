import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { FieldPill, Textarea } from '../../components/ui/Field'
import { EditableTextPill } from '../../components/ui/EditableTextPill'
import { EditableDateOnlyPill } from '../../components/ui/EditableDatePill'
import { useDataStore } from '../../store/useDataStore'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import type { ContainerRecord } from '../../lib/types'

export function ContainerDetailPage() {
  const { containerNo } = useParams<{ containerNo: string }>()
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? user?.role) === 'admin'
  const { containers, fetchContainers } = useDataStore()

  const container = containers.find((c) => c.containerNo === containerNo)

  useEffect(() => {
    if (containers.length === 0) fetchContainers()
  }, [containers.length, fetchContainers])

  if (!container) {
    return (
      <div className="space-y-5">
        <Link to="/master/containers/fleet" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Container
        </Link>
        <Card className="flex h-40 items-center justify-center">
          <p className="text-sm text-muted">{containers.length === 0 ? 'Loading…' : 'Container not found.'}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/containers/fleet" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Container
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-2xl font-bold">{container.containerNo}</h1>
          {container.status && (
            <span className="rounded-badge bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-semibold text-[#059669]">
              {container.status}
            </span>
          )}
        </div>
        <p className="mt-1 font-mono text-xs text-muted">
          {container.size} {container.containerType} · ISO {container.isoType}
        </p>
        {!isAdmin && (
          <p className="mt-1 text-xs text-muted">Fields are read-only here — only an Admin can edit container details.</p>
        )}
      </div>

      <Card className="p-5">
        <OverviewTab container={container} isAdmin={isAdmin} actor={user?.name ?? 'Admin'} />
      </Card>
    </div>
  )
}

function OverviewTab({ container: c, isAdmin, actor }: { container: ContainerRecord; isAdmin: boolean; actor: string }) {
  const { updateContainer } = useDataStore()
  const [remarksDraft, setRemarksDraft] = useState(c.remarks ?? '')

  const set = (field: keyof ContainerRecord) => (v: string) => updateContainer(c.id, field, v, actor)

  const text = (label: string, field: keyof ContainerRecord, value: string | number | null) =>
    isAdmin ? (
      <EditableTextPill label={label} value={value === null ? '' : String(value)} onChange={set(field)} />
    ) : (
      <FieldPill label={label} value={value === null ? '' : String(value)} />
    )

  const date = (label: string, field: keyof ContainerRecord, value: string | null) =>
    isAdmin ? (
      <EditableDateOnlyPill label={label} value={value ?? ''} onChange={set(field)} />
    ) : (
      <FieldPill label={label} value={value ?? ''} />
    )

  return (
    <div className="space-y-5">
      <section>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted">Location & Status</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {text('Status', 'status', c.status)}
          {date('Last Activity Date', 'lastActivityDate', c.lastActivityDate)}
          {text('Port', 'port', c.port)}
          {text('Depot', 'depot', c.depot)}
          {text('Principal', 'principal', c.principal)}
          {text('Owner', 'owner', c.owner)}
          {text('Hire Status', 'hireStatus', c.hireStatus)}
          {text('Free Days', 'freeDays', c.freeDays)}
        </div>
      </section>

      <section>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted">Specification</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {text('Size', 'size', c.size)}
          {text('Type', 'containerType', c.containerType)}
          {text('ISO Type', 'isoType', c.isoType)}
          {text('Max Gross Wt', 'maxGrossWt', c.maxGrossWt)}
          {text('Tare Weight', 'tareWeight', c.tareWeight)}
          {text('Capacity', 'capacity', c.capacity)}
        </div>
      </section>

      <section>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted">Remarks</p>
        {isAdmin ? (
          <Textarea
            value={remarksDraft}
            onChange={(e) => setRemarksDraft(e.target.value)}
            onBlur={() => {
              if (remarksDraft !== (c.remarks ?? '')) updateContainer(c.id, 'remarks', remarksDraft, actor)
            }}
          />
        ) : (
          <div className="rounded-btn border border-line bg-surface-2/60 px-3 py-2">
            <p className="text-[13px] text-body">{c.remarks || <span className="text-muted">—</span>}</p>
          </div>
        )}
      </section>
    </div>
  )
}
