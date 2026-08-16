import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, TextInput } from '../../components/ui/Field'
import { supabase } from '../../lib/supabaseClient'

/** Add Empty Depot — a single-phase form (no nested children). */
export function AddEmptyDepotPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Depot name is required.')
      return
    }
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('empty_depots')
      .insert({
        name: name.trim(),
        code: code.trim() || null,
        city: city.trim() || null,
        country: country.trim() || null,
      })
      .select()
      .single()
    setSaving(false)
    if (err || !data) {
      setError(err?.message ?? 'Could not create empty depot.')
      return
    }
    navigate(`/master/containers/empty-depots/${data.id}`)
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/containers/empty-depots" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Empty Depots
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Add Empty Depot</h1>
      </div>

      <Card>
        <CardHeader title="Depot details" />
        <div className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Depot Name *">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Code">
            <TextInput value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label="City">
            <TextInput value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="Country">
            <TextInput value={country} onChange={(e) => setCountry(e.target.value)} />
          </Field>
        </div>
      </Card>

      {error && <p className="text-sm text-[#DC2626]">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate('/master/containers/empty-depots')}>Cancel</Button>
        <Button onClick={handleCreate} disabled={saving}>{saving ? 'Saving…' : 'Create Empty Depot'}</Button>
      </div>
    </div>
  )
}
