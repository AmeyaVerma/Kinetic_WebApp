import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { FieldPill } from '../../components/ui/Field'
import { EditableTextPill } from '../../components/ui/EditableTextPill'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabaseClient'
import type { IcdRecord } from '../../lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToIcd(row: any): IcdRecord {
  return { id: row.id, name: row.name, code: row.code, city: row.city, country: row.country, createdAt: row.created_at }
}

export function IcdDetailPage() {
  const { id } = useParams<{ id: string }>()
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? user?.role) === 'admin'

  const [icd, setIcd] = useState<IcdRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    supabase
      .from('icds')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setIcd(rowToIcd(data))
        setLoading(false)
      })
  }, [id])

  function updateField(field: keyof IcdRecord, value: string) {
    if (!icd) return
    const parsed = value === '' ? null : value
    supabase
      .from('icds')
      .update({ [field]: parsed })
      .eq('id', icd.id)
      .then(({ error }) => {
        if (error) console.error('updateIcd failed', error)
      })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setIcd((i) => (i ? ({ ...i, [field]: parsed } as any) : i))
  }

  const text = (label: string, field: keyof IcdRecord, value: string | null) =>
    isAdmin ? (
      <EditableTextPill label={label} value={value ?? ''} onChange={(v) => updateField(field, v)} />
    ) : (
      <FieldPill label={label} value={value ?? ''} />
    )

  if (loading || !icd) {
    return (
      <div className="space-y-5">
        <Link to="/master/ports/icds" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> ICDs
        </Link>
        <Card className="flex h-40 items-center justify-center">
          <p className="text-sm text-muted">{loading ? 'Loading…' : 'ICD not found.'}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/ports/icds" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> ICDs
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{icd.name}</h1>
        {!isAdmin && (
          <p className="mt-1 text-xs text-muted">Fields are read-only here — only an Admin can edit ICD details.</p>
        )}
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {text('Code', 'code', icd.code)}
          {text('City', 'city', icd.city)}
          {text('Country', 'country', icd.country)}
        </div>
      </Card>
    </div>
  )
}
