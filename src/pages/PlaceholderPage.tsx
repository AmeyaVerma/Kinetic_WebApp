import { Card } from '../components/ui/Card'

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted">
        This module is scaffolded for a later phase.
      </p>
      <Card className="mt-6 flex h-64 items-center justify-center">
        <p className="text-sm text-muted">{title} — coming soon</p>
      </Card>
    </div>
  )
}
