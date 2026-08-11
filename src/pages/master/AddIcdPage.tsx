import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, TextInput } from '../../components/ui/Field'
import { supabase } from '../../lib/supabaseClient'

/** Add ICD — a single-phase form (no nested children, unlike Sea Ports). */
export function AddIcdPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('ICD name is required.')
      return
    }
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('icds')
      .insert({ name: name.trim(), code: code.trim() || null, city: city.trim() || null, country: country.trim() || null })
      .select()
      .single()
    setSaving(false)
    if (err || !data) {
      setError(err?.message ?? 'Could not create ICD.')
      return
    }
    navigate(`/master/ports/icds/${data.id}`)
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/ports/icds" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> ICDs
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Add ICD</h1>
      </div>

      <Card>
        <CardHeader title="ICD details" />
        <div className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="ICD Name *">
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
        <Button variant="secondary" onClick={() => navigate('/master/ports/icds')}>Cancel</Button>
        <Button onClick={handleCreate} disabled={saving}>{saving ? 'Saving…' : 'Create ICD'}</Button>
      </div>
    </div>
  )
}
