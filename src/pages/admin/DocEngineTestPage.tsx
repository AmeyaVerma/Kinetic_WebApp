import { useState } from 'react'
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer'
import { EngineTestDoc } from '../../lib/pdf/templates/EngineTestDoc'

/**
 * Phase 1 harness for the document engine. Renders the engine test document
 * through the same renderer the real documents use, so what is previewed here
 * is byte-identical to what downloads.
 *
 * Admin-only and not linked from the sidebar -- it is a build check, not a
 * feature. Remove once the BL templates have their own preview.
 */
export function DocEngineTestPage() {
  const [scan, setScan] = useState(false)

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-lg">Document engine test</h1>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={scan}
            onChange={(e) => setScan(e.target.checked)}
          />
          Scan Copy (black and white)
        </label>
        <PDFDownloadLink
          document={<EngineTestDoc scan={scan} />}
          fileName={scan ? 'engine-test_SCAN.pdf' : 'engine-test.pdf'}
          className="rounded border px-3 py-1 text-sm"
        >
          {({ loading }) => (loading ? 'Preparing…' : 'Download PDF')}
        </PDFDownloadLink>
      </div>

      <PDFViewer className="min-h-[70vh] w-full flex-1 rounded border" showToolbar>
        <EngineTestDoc scan={scan} />
      </PDFViewer>
    </div>
  )
}
