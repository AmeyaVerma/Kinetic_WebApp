import { useState } from 'react'
import { Upload, ExternalLink } from 'lucide-react'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/Field'
import { useDataStore } from '../../store/useDataStore'
import type { Party } from '../../lib/types'

/** Document Space — real Storage upload; raises a party_document Approvals
    entry so Admin is notified. Shared by AddPartyPage (post-create) and
    PartyDetailPage. */
export function PartyDocumentsSection({ party, actor }: { party: Party; actor: string }) {
  const { partyDocuments, uploadPartyDocument, getPartyDocumentUrl } = useDataStore()
  const [file, setFile] = useState<File | null>(null)
  const [docName, setDocName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rows = partyDocuments.filter((d) => d.partyId === party.id)

  const handleUpload = async () => {
    if (!file || !docName.trim()) {
      setError('Choose a file and enter a document name.')
      return
    }
    setUploading(true)
    setError(null)
    const { error: err } = await uploadPartyDocument(party.id, docName.trim(), file, actor)
    setUploading(false)
    if (err) {
      setError(err)
      return
    }
    setFile(null)
    setDocName('')
  }

  const handleOpen = async (storagePath: string) => {
    const url = await getPartyDocumentUrl(storagePath)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Card>
      <CardHeader title="Document Space" />
      <div className="grid grid-cols-1 gap-3 px-5 pb-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
        <Field label="File">
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-body file:mr-3 file:rounded-btn file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-xs file:font-medium file:text-body"
          />
        </Field>
        <Field label="Document Name *">
          <TextInput value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="e.g. GST Certificate" />
        </Field>
        <Button size="sm" onClick={handleUpload} disabled={uploading}>
          <Upload size={13} /> {uploading ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
      {error && <p className="px-5 pb-3 text-xs text-[#DC2626]">{error}</p>}
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
              <th className="px-4 py-2 font-medium">Document</th>
              <th className="px-3 py-2 font-medium">Link</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2 font-medium text-heading">{d.documentName}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => handleOpen(d.storagePath)}
                    className="inline-flex items-center gap-1 text-link hover:underline"
                  >
                    Open <ExternalLink size={11} />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={2} className="px-4 py-4 text-center text-muted">No documents uploaded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
