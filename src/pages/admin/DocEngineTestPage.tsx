import { useState } from 'react'
import { PDFViewer } from '@react-pdf/renderer'
import { EngineTestDoc } from '../../lib/pdf/templates/EngineTestDoc'
import { BlDocument } from '../../lib/pdf/templates/BlFrontSheet'
import { ContainerAttachSheet } from '../../lib/pdf/templates/ContainerAttachSheet'
import { blTestSnapshot } from '../../lib/pdf/templates/blTestFixture'
import type { BlType } from '../../lib/pdf/strings/bl'

type View = 'engine' | 'bl' | 'sheet'

/**
 * Harness for the document engine, carrying the cases the acceptance checks
 * call for that no real booking covers -- chiefly a 12+ container BL.
 *
 * Admin-only and unlinked from the sidebar: it is a build check, not a
 * feature, and nothing here touches real bookings.
 */
export function DocEngineTestPage() {
  const [view, setView] = useState<View>('bl')
  const [scan, setScan] = useState(false)
  const [blType, setBlType] = useState<BlType>('Original')
  const [useSheet, setUseSheet] = useState(false)
  const [count, setCount] = useState(14)

  const snapshot = blTestSnapshot({
    blType,
    printMode: scan ? 'Scan' : 'Original',
    useContainerSheet: useSheet,
    containerCount: count,
  })

  return (
    <div className="flex h-full flex-col gap-3">
      <h1 className="font-display text-lg">Document engine test</h1>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select
          value={view}
          onChange={(e) => setView(e.target.value as View)}
          className="rounded border px-2 py-1"
        >
          <option value="bl">BL ({count} containers)</option>
          <option value="sheet">Container attach sheet</option>
          <option value="engine">Engine primitives</option>
        </select>

        {view !== 'engine' && (
          <>
            <select
              value={blType}
              onChange={(e) => setBlType(e.target.value as BlType)}
              className="rounded border px-2 py-1"
            >
              {(['Draft', 'Original', 'Surrender', 'Seaway', 'RFS'] as BlType[]).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1">
              Containers
              <input
                type="number"
                min={1}
                max={60}
                value={count}
                onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
                className="w-16 rounded border px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useSheet}
                onChange={(e) => setUseSheet(e.target.checked)}
              />
              Use container attach sheet
            </label>
          </>
        )}

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={scan} onChange={(e) => setScan(e.target.checked)} />
          Scan Copy
        </label>
      </div>

      <PDFViewer className="min-h-[70vh] w-full flex-1 rounded border" showToolbar>
        {view === 'engine' ? (
          <EngineTestDoc scan={scan} />
        ) : view === 'sheet' ? (
          <ContainerAttachSheet snapshot={snapshot} />
        ) : (
          <BlDocument snapshot={snapshot} />
        )}
      </PDFViewer>
    </div>
  )
}
