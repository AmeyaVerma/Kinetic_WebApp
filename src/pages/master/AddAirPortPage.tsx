import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, TextInput } from '../../components/ui/Field'
import { supabase } from '../../lib/supabaseClient'

export function AddAirPortPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Air port name is required.')
      return
    }
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('air_ports')
      .insert({ name: name.trim(), code: code.trim() || null, city: city.trim() || null, country: country.trim() || null })
      .select()
      .single()
    setSaving(false)
    if (err || !data) {
      setError(err?.message ?? 'Could not create air port.')
      return
    }
    navigate(`/master/ports/air-ports/${data.id}`)
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master/ports/air-ports" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Air Ports
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Add Air Port</h1>
      </div>

      <Card>
        <CardHeader title="Air port details" />
        <div className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Air Port Name *">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Code (IATA)">
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
        <Button variant="secondary" onClick={() => navigate('/master/ports/air-ports')}>Cancel</Button>
        <Button onClick={handleCreate} disabled={saving}>{saving ? 'Saving…' : 'Create Air Port'}</Button>
      </div>
    </div>
  )
}
