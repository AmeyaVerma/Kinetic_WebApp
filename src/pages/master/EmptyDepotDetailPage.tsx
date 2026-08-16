import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { FieldPill } from '../../components/ui/Field'
import { EditableTextPill } from '../../components/ui/EditableTextPill'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabaseClient'
import type { EmptyDepotRecord } from '../../lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEmptyDepot(row: any): EmptyDepotRecord {
  return { id: row.id, name: row.name, code: row.code, city: row.city, country: row.country, createdAt: row.created_at }
}

export function EmptyDepotDetailPage() {
  const { id } = useParams<{ id: string }>()
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? user?.role) === 'admin'

  const [depot, setDepot] = useState<EmptyDepotRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    supabase
      .from('empty_depots')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setDepot(rowToEmptyDepot(data))
        setLoading(false)
      })
  }, [id])

  function updateField(field: keyof EmptyDepotRecord, value: string) {
    if (!depot) return
    const parsed = value === '' ? null : value
    supabase
      .from('empty_depots')
      .update({ [field]: parsed })
      .eq('id', depot.id)
      .then(({ error }) => {
        if (error) console.error('updateEmptyDepot failed', error)
      })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setDepot((d) => (d ? ({ ...d, [field]: parsed } as any) : d))
  }

  const text = (label: string, field: keyof EmptyDepotRecord, value: string | null) =>
    isAdmin ? (
      <EditableTextPill label={label} value={value ?? ''} onChange={(v) => updateField(field, v)} />
    ) : (
      <FieldPill label={label} value={value ?? ''} />
    )

  if (loading || !depot) {
    return (
      <div className="space-y-5">
        <Link to="/master/containers/empty-depots" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Empty Depots
        </Link>
        <Card className="flex h-40 items-center justify-center">
          <p className="text-sm text-muted">{loading ? 'Loading…' : 'Empty depot not found.'}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/containers/empty-depots" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Empty Depots
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{depot.name}</h1>
        {!isAdmin && (
          <p className="mt-1 text-xs text-muted">Fields are read-only here — only an Admin can edit depot details.</p>
        )}
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {text('Code', 'code', depot.code)}
          {text('City', 'city', depot.city)}
          {text('Country', 'country', depot.country)}
        </div>
      </Card>
    </div>
  )
}
