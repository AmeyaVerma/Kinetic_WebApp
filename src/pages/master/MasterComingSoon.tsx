import { Link } from 'react-router-dom'
import { ArrowLeft, type LucideIcon } from 'lucide-react'
import { Card } from '../../components/ui/Card'

/** Placeholder detail page for a master not yet built — same one-at-a-time
    pattern used for Parties: data in → add-format → where autofill surfaces. */
export function MasterComingSoon({
  title,
  description,
  icon: Icon,
  backTo = '/master',
  backLabel = 'Master Data',
}: {
  title: string
  description: string
  icon: LucideIcon
  backTo?: string
  backLabel?: string
}) {
  return (
    <div className="space-y-5">
      <div>
        <Link to={backTo} className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> {backLabel}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <Card className="flex h-64 flex-col items-center justify-center gap-2 text-center">
        <Icon size={28} className="text-muted" />
        <p className="text-sm font-medium text-body">Not built yet</p>
        <p className="max-w-sm text-xs text-muted">
          Built the same way Parties was — real data imported, then an add-format, then wired into module dropdowns.
        </p>
      </Card>
    </div>
  )
}
