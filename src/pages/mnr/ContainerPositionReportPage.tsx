import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { CsvButton } from '../../components/ui/CsvButton'
import { useDataStore } from '../../store/useDataStore'
import { CONTAINER_OP_STATUSES, CONTAINER_REPORT_LOCATIONS } from '../../lib/types'
import type { ContainerRecord } from '../../lib/types'

/** The report's two size columns — the only two combinations of
    size + containerType this report tracks, matching the reference
    layout exactly. A container outside both (e.g. a 20 FT GP) doesn't
    appear in any cell, same as the source report. */
const SIZE_COLUMNS = [
  { key: '20HD', label: '20HD', matches: (c: ContainerRecord) => c.size === '20 FT' && c.containerType === 'HD' },
  { key: '40RF', label: '40RF', matches: (c: ContainerRecord) => c.size === '40 FT' && c.containerType === 'REF' },
] as const

type Row = {
  key: string
  label: string
  counts: Record<string, number> // `${opStatus}:${sizeKey}` -> count
  total: number
}

function buildRows(containers: ContainerRecord[]): { rows: Row[]; unassigned: Row } {
  function rowFor(label: string, key: string, matchesLocation: (c: ContainerRecord) => boolean): Row {
    const counts: Record<string, number> = {}
    let total = 0
    for (const status of CONTAINER_OP_STATUSES) {
      for (const size of SIZE_COLUMNS) {
        const n = containers.filter((c) => matchesLocation(c) && c.opStatus === status.value && size.matches(c)).length
        counts[`${status.value}:${size.key}`] = n
        total += n
      }
    }
    return { key, label, counts, total }
  }

  const rows = CONTAINER_REPORT_LOCATIONS.map((loc) => rowFor(loc.label, loc.value, (c) => c.reportLocation === loc.value))
  const unassigned = rowFor('Unassigned location', 'unassigned', (c) => !c.reportLocation)
  return { rows, unassigned }
}

export function ContainerPositionReportPage() {
  const { containers, fetchContainers } = useDataStore()

  useEffect(() => {
    if (containers.length === 0) fetchContainers()
  }, [containers.length, fetchContainers])

  const { rows, unassigned } = useMemo(() => buildRows(containers), [containers])
  const allRows = unassigned.total > 0 ? [...rows, unassigned] : rows
  const noStatusYet = containers.length > 0 && containers.every((c) => !c.opStatus)

  const totalsRow = useMemo(() => {
    const counts: Record<string, number> = {}
    let total = 0
    for (const status of CONTAINER_OP_STATUSES) {
      for (const size of SIZE_COLUMNS) {
        const key = `${status.value}:${size.key}`
        const n = allRows.reduce((sum, r) => sum + (r.counts[key] ?? 0), 0)
        counts[key] = n
        total += n
      }
    }
    return { key: 'total', label: 'TOTAL', counts, total }
  }, [allRows])

  const csvRows = useMemo(
    () =>
      allRows.map((r, i) => {
        const row: Record<string, unknown> = { 'Sr No': i + 1, Location: r.label }
        for (const status of CONTAINER_OP_STATUSES) {
          for (const size of SIZE_COLUMNS) {
            row[`${status.label} ${size.label}`] = r.counts[`${status.value}:${size.key}`]
          }
        }
        row.Total = r.total
        return row
      }),
    [allRows],
  )

  return (
    <div className="space-y-5">
      <div>
        <Link to="/mnr" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> MNR
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Container Position Report</h1>
            <p className="mt-1 text-sm text-muted">
              Live count of the container fleet by location, operational status, and size.
            </p>
          </div>
          <CsvButton filename="container-position-report" rows={csvRows} />
        </div>
      </div>

      {noStatusYet && (
        <div className="rounded-card border border-accent-orange/30 bg-accent-orange/10 px-4 py-3 text-xs text-accent-orange">
          No container has an Op Status assigned yet, so every cell below reads 0. Set a container's Report Location
          and Op Status from its detail page (Master Data → Containers → a container) to have it show up here.
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 z-10 border-b border-r border-line bg-surface-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted"
                >
                  Sr
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-9 z-10 border-b border-r border-line bg-surface-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted"
                >
                  Location
                </th>
                {CONTAINER_OP_STATUSES.map((status) => (
                  <th
                    key={status.value}
                    colSpan={2}
                    className="border-b border-l border-line bg-primary/10 px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-primary"
                  >
                    {status.label}
                  </th>
                ))}
                <th
                  rowSpan={2}
                  className="border-b border-l border-line bg-[#ECFDF5] px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[#047857]"
                >
                  Total
                </th>
              </tr>
              <tr>
                {CONTAINER_OP_STATUSES.map((status) =>
                  SIZE_COLUMNS.map((size) => (
                    <th
                      key={`${status.value}-${size.key}`}
                      className="border-b border-l border-line bg-surface-2/60 px-3 py-1.5 text-center font-mono text-[10px] font-semibold text-muted"
                    >
                      {size.label}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {allRows.map((r, i) => (
                <tr key={r.key} className={r.key === 'unassigned' ? 'bg-accent-orange/5' : undefined}>
                  <td className="sticky left-0 z-10 border-b border-r border-line bg-surface px-3 py-2 font-mono text-xs text-muted">
                    {i + 1}
                  </td>
                  <td className="sticky left-9 z-10 border-b border-r border-line bg-surface px-4 py-2 text-xs font-medium text-body">
                    {r.label}
                  </td>
                  {CONTAINER_OP_STATUSES.map((status) =>
                    SIZE_COLUMNS.map((size) => (
                      <td
                        key={`${status.value}-${size.key}`}
                        className="border-b border-l border-line px-3 py-2 text-center font-mono text-xs text-body"
                      >
                        {r.counts[`${status.value}:${size.key}`] || <span className="text-muted">—</span>}
                      </td>
                    )),
                  )}
                  <td className="border-b border-l border-line bg-[#ECFDF5]/40 px-4 py-2 text-center font-mono text-xs font-semibold text-[#047857]">
                    {r.total}
                  </td>
                </tr>
              ))}
              <tr>
                <td
                  colSpan={2}
                  className="sticky left-0 z-10 border-r border-line bg-surface-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-heading"
                >
                  Total
                </td>
                {CONTAINER_OP_STATUSES.map((status) =>
                  SIZE_COLUMNS.map((size) => (
                    <td
                      key={`${status.value}-${size.key}`}
                      className="border-l border-line bg-surface-2 px-3 py-2 text-center font-mono text-xs font-semibold text-heading"
                    >
                      {totalsRow.counts[`${status.value}:${size.key}`]}
                    </td>
                  )),
                )}
                <td className="border-l border-line bg-[#10B981] px-4 py-2 text-center font-mono text-xs font-bold text-white">
                  {totalsRow.total}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
