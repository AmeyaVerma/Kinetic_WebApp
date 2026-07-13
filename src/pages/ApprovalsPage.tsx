import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusChip } from '../components/ui/StatusChip'
import { Tabs } from '../components/ui/Tabs'
import { useDataStore } from '../store/useDataStore'
import type { Approval, ApprovalEntityType } from '../lib/types'

const CATEGORY_TABS: { key: ApprovalEntityType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'quote', label: 'Quotes' },
  { key: 'bl_edit', label: 'BL edits' },
  { key: 'invoice', label: 'Invoices' },
  { key: 'repair_estimate', label: 'Repair estimates' },
  { key: 'credit_hold', label: 'Credit holds' },
  { key: 'booking_request', label: 'Booking requests' },
]

const TYPE_LABEL: Record<ApprovalEntityType, string> = {
  quote: 'Quote',
  bl_edit: 'BL edit',
  invoice: 'Invoice',
  repair_estimate: 'Repair estimate',
  booking_request: 'Booking request',
  credit_note: 'Credit note',
  credit_hold: 'Credit hold',
}

export function ApprovalsPage() {
  const { approvals, decideApproval, bookings } = useDataStore()
  const [tab, setTab] = useState<string>('all')
  const [showDecided, setShowDecided] = useState(false)

  const filtered = useMemo(() => {
    let list = approvals
    if (tab !== 'all') list = list.filter((a) => a.entityType === tab)
    if (!showDecided) list = list.filter((a) => a.status === 'Pending')
    return list
  }, [approvals, tab, showDecided])

  const pendingCount = (key: ApprovalEntityType | 'all') =>
    approvals.filter((a) => a.status === 'Pending' && (key === 'all' || a.entityType === key)).length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Approvals</h1>
          <p className="mt-1 text-sm text-muted">
            One central queue for every gated action — same table, different entity_type.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-body">
          <input
            type="checkbox"
            checked={showDecided}
            onChange={(e) => setShowDecided(e.target.checked)}
            className="h-4 w-4 accent-[#10B981]"
          />
          Show decided
        </label>
      </div>

      <Tabs
        tabs={CATEGORY_TABS.map((t) => ({ key: t.key, label: t.label, badge: pendingCount(t.key) }))}
        active={tab}
        onChange={setTab}
      />

      <div className="space-y-3">
        {filtered.map((a) => (
          <ApprovalRow
            key={a.id}
            approval={a}
            bookingRef={bookings.find((b) => b.id === a.bookingId)?.bookingRef ?? null}
            onDecide={(d) => decideApproval(a.id, d)}
          />
        ))}
        {filtered.length === 0 && (
          <Card className="flex h-40 items-center justify-center">
            <p className="text-sm text-muted">Queue clear — nothing pending here</p>
          </Card>
        )}
      </div>
    </div>
  )
}

function ApprovalRow({
  approval: a,
  bookingRef,
  onDecide,
}: {
  approval: Approval
  bookingRef: string | null
  onDecide: (d: 'Approved' | 'Rejected') => void
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-badge bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-heading">
              {TYPE_LABEL[a.entityType]}
            </span>
            {bookingRef && (
              <Link
                to={`/nvocc/${a.bookingId}`}
                className="font-mono text-xs font-medium text-link hover:underline"
              >
                {bookingRef}
              </Link>
            )}
            <StatusChip
              status={a.status === 'Pending' ? 'Pending' : a.status === 'Approved' ? 'Delivered' : 'Cancelled'}
            />
          </div>
          <p className="mt-1.5 text-[13px] text-heading">{a.summary}</p>
          <p className="mt-0.5 text-xs text-muted">
            Requested by {a.requestedBy} · {new Date(a.requestedAt).toLocaleString()}
          </p>
          {a.payload && (
            <div className="mt-2 rounded-btn border border-line bg-surface-2/50 p-2.5">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-muted">Proposed changes</p>
              {Object.entries(a.payload).map(([k, v]) => (
                <p key={k} className="text-xs text-body">
                  <span className="font-medium text-heading">{k}:</span> {v}
                </p>
              ))}
            </div>
          )}
        </div>
        {a.status === 'Pending' && (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={() => onDecide('Approved')}>
              <Check size={14} /> Approve
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onDecide('Rejected')} className="text-accent-coral">
              <X size={14} /> Reject
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
