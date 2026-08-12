import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { FieldPill } from '../../components/ui/Field'
import { EditableTextPill } from '../../components/ui/EditableTextPill'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabaseClient'
import type { AirPortRecord } from '../../lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAirPort(row: any): AirPortRecord {
  return { id: row.id, name: row.name, code: row.code, locode: row.locode, city: row.city, country: row.country, createdAt: row.created_at }
}

export function AirPortDetailPage() {
  const { id } = useParams<{ id: string }>()
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? user?.role) === 'admin'

  const [airPort, setAirPort] = useState<AirPortRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    supabase
      .from('air_ports')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setAirPort(rowToAirPort(data))
        setLoading(false)
      })
  }, [id])

  function updateField(field: keyof AirPortRecord, value: string) {
    if (!airPort) return
    const parsed = value === '' ? null : value
    supabase
      .from('air_ports')
      .update({ [field]: parsed })
      .eq('id', airPort.id)
      .then(({ error }) => {
        if (error) console.error('updateAirPort failed', error)
      })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setAirPort((a) => (a ? ({ ...a, [field]: parsed } as any) : a))
  }

  const text = (label: string, field: keyof AirPortRecord, value: string | null) =>
    isAdmin ? (
      <EditableTextPill label={label} value={value ?? ''} onChange={(v) => updateField(field, v)} />
    ) : (
      <FieldPill label={label} value={value ?? ''} />
    )

  if (loading || !airPort) {
    return (
      <div className="space-y-5">
        <Link to="/master/ports/air-ports" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Air Ports
        </Link>
        <Card className="flex h-40 items-center justify-center">
          <p className="text-sm text-muted">{loading ? 'Loading…' : 'Air port not found.'}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/ports/air-ports" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Air Ports
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{airPort.name}</h1>
        {!isAdmin && (
          <p className="mt-1 text-xs text-muted">Fields are read-only here — only an Admin can edit air port details.</p>
        )}
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {text('Code', 'code', airPort.code)}
          {text('LOCODE', 'locode', airPort.locode)}
          {text('City', 'city', airPort.city)}
          {text('Country', 'country', airPort.country)}
        </div>
      </Card>
    </div>
  )
}
