import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Lock, Upload } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { TextInput, Textarea } from '../../components/ui/Field'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'

/**
 * Company settings: the static text and artwork every generated document
 * prints.
 *
 * The artwork goes into the `company-assets` bucket, which is write-only
 * from the browser: an admin can upload a stamp but cannot read one back,
 * and neither can anyone else. Only the server-side signing function fetches
 * them, after a PIN. The BL backside is the one exception — it is DG
 * Shipping's published standard conditions, printed on every BL, so it is
 * readable and the preview can show it.
 */

type Settings = Record<string, string | null>

interface AssetSlot {
  key: string
  label: string
  hint: string
  accept: string
  /** False for the stamps: uploaded, never readable back. */
  readable: boolean
  /**
   * Column holding the black-and-white variant. When set, uploading a
   * colour file also generates and stores the greyscale copy Scan Copy
   * prints, so nobody has to make two versions of the same stamp by hand.
   */
  greyKey?: string
}

const ASSETS: AssetSlot[] = [
  {
    key: 'bl_backside_path',
    label: 'BL backside (terms)',
    hint: 'Printed as the last page of every BL except a Draft.',
    accept: 'image/png,image/jpeg',
    readable: true,
  },
  {
    key: 'logo_path',
    label: 'Company logo',
    hint: 'Printed in the BL header. Without it the name prints in type.',
    accept: 'image/png',
    readable: false,
  },
  {
    key: 'signature_path',
    greyKey: 'signature_grey_path',
    label: 'Authorised signature (with company stamp)',
    hint: 'May be one combined image. Composited server-side after a signing PIN; never sent to a browser.',
    accept: 'image/png',
    readable: false,
  },
  {
    key: 'stamp_path',
    greyKey: 'stamp_grey_path',
    label: 'Company stamp (separate)',
    hint: 'Only needed if the stamp is not already part of the signature image.',
    accept: 'image/png',
    readable: false,
  },
  {
    key: 'surrender_stamp_path',
    greyKey: 'surrender_stamp_grey_path',
    label: 'Surrender stamp',
    hint: 'Only for a Surrender BL.',
    accept: 'image/png',
    readable: false,
  },
]

const ADDRESS_FIELDS: { key: string; label: string }[] = [
  { key: 'corporate_address', label: 'Corporate address' },
  { key: 'gst_address', label: 'GST address' },
]

const TEXT_FIELDS: { key: string; label: string }[] = [
  { key: 'legal_name', label: 'Legal name' },
  { key: 'principal_name', label: 'Principal name (CRO, Off Loading)' },
  { key: 'tagline', label: 'Tagline' },
  { key: 'mto_registration', label: 'MTO registration' },
  { key: 'tel', label: 'Telephone' },
  { key: 'email', label: 'Email' },
  { key: 'website', label: 'Website' },
  { key: 'place_of_issue', label: 'Place of issue' },
]

/**
 * Black-and-white copy of an uploaded stamp, for Scan Copy mode.
 *
 * Done here rather than at render time because desaturating a signature on
 * the fly produces a muddy grey that reproduces badly on a scan or fax --
 * which is exactly what Scan Copy exists for. Alpha is carried through
 * untouched so the stamp overlays the form.
 */
/**
 * Writes an asset under a fresh, unique name and returns the path.
 *
 * Not upsert, and not delete-then-write either. Supabase Storage has to look
 * an object up before it can overwrite OR delete it, and the stamps have no
 * read policy at all -- that is precisely what makes them write-only. So an
 * upsert is refused as an RLS violation, and a remove() silently matches
 * nothing and reports success, which would have made "Replace" fail on the
 * second upload while appearing to work.
 *
 * Writing a new object each time sidesteps the lookup entirely: the settings
 * row points at the newest file and the previous one is simply unreferenced.
 * Superseded files are left in the bucket rather than granting read access
 * to a signature in order to tidy up.
 */
async function putAsset(prefix: string, body: Blob, contentType: string): Promise<string> {
  const path = prefix + '-' + Date.now() + '.png'
  const { error } = await supabase.storage
    .from('company-assets')
    .upload(path, body, { contentType, upsert: false })
  if (error) throw new Error(error.message)
  return path
}

async function toGreyscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process the image')
  ctx.drawImage(bitmap, 0, 0)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    // Rec. 601 luma, which keeps ink dark rather than washing it out.
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = d[i + 1] = d[i + 2] = y
  }
  ctx.putImageData(img, 0, 0)
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Greyscale failed'))), 'image/png'),
  )
}

export function CompanySettingsPage() {
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? user?.role) === 'admin'

  const [settings, setSettings] = useState<Settings | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})

  const load = useCallback(async () => {
    const { data } = await supabase.from('company_settings').select('*').limit(1).maybeSingle()
    setSettings((data as Settings) ?? null)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const upload = async (slot: AssetSlot, file: File) => {
    if (!settings) return
    setBusyKey(slot.key)
    setError(null)
    setNote(null)
    try {
      const tenantId = String(settings.tenant_id)
      // The name keeps its slot prefix so the backside read policy
      // (bl-backside*) still matches, with a timestamp making each upload a
      // distinct object -- see putAsset.
      const prefix = tenantId + '/' + slot.key.replace('_path', '').replace(/_/g, '-')
      const path = await putAsset(prefix, file, file.type)

      const patch: Record<string, string> = { [slot.key]: path }

      if (slot.greyKey) {
        // Desaturate the colour channels and keep the alpha, so the stamp
        // still sits over the form instead of printing on a white box.
        const grey = await toGreyscale(file)
        patch[slot.greyKey] = await putAsset(prefix + '-grey', grey, 'image/png')
      }

      const { error: setErr } = await supabase
        .from('company_settings')
        .update(patch)
        .eq('tenant_id', tenantId)
      if (setErr) throw new Error(setErr.message)

      setNote(slot.label + ' uploaded.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    }
    setBusyKey(null)
  }

  const saveText = async (key: string, value: string) => {
    if (!settings) return
    const { error: err } = await supabase
      .from('company_settings')
      .update({ [key]: value })
      .eq('tenant_id', String(settings.tenant_id))
    if (err) setError(err.message)
    else load()
  }

  if (!settings) {
    return <Card className="p-4 text-sm text-muted">Loading company settings…</Card>
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/master"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
        >
          <ArrowLeft size={14} /> Master Data
        </Link>
        <h1 className="mt-1 font-display text-xl">Company settings</h1>
        <p className="text-sm text-muted">
          The text and artwork every generated document prints. Admin only.
        </p>
      </div>

      {error && (
        <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</p>
      )}
      {note && (
        <p className="rounded border border-emerald-300 bg-emerald-50 p-2 text-sm text-emerald-800">
          {note}
        </p>
      )}

      <Card className="space-y-4 p-4">
        <h2 className="font-display text-sm">Document artwork</h2>
        <div className="space-y-3">
          {ASSETS.map((slot) => {
            const current = settings[slot.key]
            return (
              <div
                key={slot.key}
                className="flex flex-wrap items-center gap-3 border-b border-line pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    {slot.label}
                    {current ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                        <Check size={13} /> uploaded
                      </span>
                    ) : (
                      <span className="text-xs text-amber-700">not uploaded</span>
                    )}
                    {!slot.readable && (
                      <span
                        className="inline-flex items-center gap-1 text-xs text-muted"
                        title="Write-only: can be uploaded, never read back by any browser"
                      >
                        <Lock size={12} /> write-only
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted">{slot.hint}</p>
                </div>

                <input
                  id={'file-' + slot.key}
                  ref={(el) => {
                    inputs.current[slot.key] = el
                  }}
                  type="file"
                  accept={slot.accept}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) upload(slot, file)
                    e.target.value = ''
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!isAdmin || busyKey === slot.key}
                  onClick={() => inputs.current[slot.key]?.click()}
                >
                  <Upload size={14} />
                  {busyKey === slot.key ? 'Uploading…' : current ? 'Replace' : 'Upload'}
                </Button>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted">
          PNG or JPEG, up to 5 MB. A multi-page or vector original should be
          exported to a single image first — documents embed images, not PDFs.
        </p>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-display text-sm">Printed addresses</h2>
        <p className="text-xs text-muted">
          Shared by every document — the BL and all five letters — so a change
          here lands on all of them. The same shipment printing two different
          company addresses would read as an error.
        </p>
        <div className="space-y-3">
          {ADDRESS_FIELDS.map((f) => (
            <label key={f.key} className="block space-y-1">
              <span className="block font-mono text-[10px] uppercase tracking-wide text-muted">
                {f.label}
              </span>
              <Textarea
                rows={2}
                defaultValue={String(settings[f.key] ?? '')}
                disabled={!isAdmin}
                onBlur={(e) => saveText(f.key, e.target.value)}
              />
            </label>
          ))}
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-display text-sm">Printed company details</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEXT_FIELDS.map((f) => (
            <label key={f.key} className="space-y-1">
              <span className="block font-mono text-[10px] uppercase tracking-wide text-muted">
                {f.label}
              </span>
              <TextInput
                defaultValue={String(settings[f.key] ?? '')}
                disabled={!isAdmin}
                onBlur={(e) => saveText(f.key, e.target.value)}
              />
            </label>
          ))}
        </div>
      </Card>
    </div>
  )
}
