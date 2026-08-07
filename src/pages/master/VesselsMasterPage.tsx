import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ship } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { TextInput } from '../../components/ui/Field'
import { supabase } from '../../lib/supabaseClient'
import type { VesselRecord } from '../../lib/types'

const PAGE_SIZE = 50

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToVessel(row: any): VesselRecord {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    name: row.name,
    code: row.code,
    vesselType: row.vessel_type,
    nationality: row.nationality,
    buildYear: row.build_year,
    grt: row.grt === null ? null : Number(row.grt),
    nrt: row.nrt === null ? null : Number(row.nrt),
    deadWeight: row.dead_weight === null ? null : Number(row.dead_weight),
    lengthOverall: row.length_overall === null ? null : Number(row.length_overall),
    beam: row.beam === null ? null : Number(row.beam),
    summerDraft: row.summer_draft === null ? null : Number(row.summer_draft),
    winterDraft: row.winter_draft === null ? null : Number(row.winter_draft),
    noOfTanks: row.no_of_tanks,
    imoCode: row.imo_code,
    owner: row.owner,
    masterName: row.master_name,
    serviceName: row.service_name,
    createdAt: row.created_at,
  }
}

/** Master Data → Vessels. 3,794 rows is too many to load into memory at
    once, so unlike the other masters (which fetch everything into the
    Zustand store) this page queries Supabase directly with server-side
    search + range-based pagination — 50 rows per page, "Load more" to
    fetch the next 50 rather than a full local dataset. */
export function VesselsMasterPage() {
  const navigate = useNavigate()
  const [vessels, setVessels] = useState<VesselRecord[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  // Most of the 3,794 legacy rows are near-empty duplicate stub entries
  // (a name and nothing else) — hidden by default so the list is usable,
  // but purely a view filter: nothing is deleted from Supabase, and
  // toggling this back on reveals every row again.
  const [showBlankStubs, setShowBlankStubs] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  async function fetchPage(offset: number, replace: boolean) {
    if (replace) setLoading(true)
    else setLoadingMore(true)

    let q = supabase
      .from('vessels')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (debouncedQuery) {
      const safe = debouncedQuery.replace(/[,%]/g, ' ').trim()
      q = q.or(`name.ilike.%${safe}%,code.ilike.%${safe}%,imo_code.ilike.%${safe}%,owner.ilike.%${safe}%`)
    }

    if (!showBlankStubs) {
      q = q.or('code.not.is.null,imo_code.not.is.null,vessel_type.not.is.null,nationality.not.is.null')
    }

    const { data, error, count } = await q
    if (!error && data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (data as any[]).map(rowToVessel)
      setVessels((prev) => (replace ? mapped : [...prev, ...mapped]))
      setTotalCount(count ?? 0)
    }
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => {
    fetchPage(0, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, showBlankStubs])

  const hasMore = vessels.length < totalCount

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Vessels</h1>
        <p className="mt-1 text-sm text-muted">Vessel identity and voyage schedules — carrier, IMO, POL/POD, ETD/ETA.</p>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full max-w-xs">
              <TextInput
                placeholder="Search vessel name, code, IMO, owner…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              variant={showBlankStubs ? 'primary' : 'secondary'}
              onClick={() => setShowBlankStubs((v) => !v)}
              title="Most legacy rows are near-empty duplicate stub entries (name only) — hidden by default. Nothing is deleted; toggle to see them."
            >
              {showBlankStubs ? 'Showing blank stubs' : 'Blank stubs hidden'}
            </Button>
          </div>
          <p className="text-xs text-muted">
            Showing <span className="font-medium text-body">{vessels.length}</span> of{' '}
            <span className="font-medium text-body">{totalCount}</span> vessels
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Code</th>
                <th className="px-3 py-3 font-medium">IMO</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Nationality</th>
                <th className="px-5 py-3 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody>
              {vessels.map((v) => (
                <VesselRow key={v.id} vessel={v} onClick={() => navigate(`/master/vessels/${v.id}`)} />
              ))}
            </tbody>
          </table>
          {vessels.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted">
              {loading ? 'Loading…' : 'No vessels match that search.'}
            </p>
          )}
        </div>
        {hasMore && (
          <div className="flex justify-center border-t border-line px-4 py-3">
            <Button size="sm" variant="secondary" disabled={loadingMore} onClick={() => fetchPage(vessels.length, false)}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

function VesselRow({ vessel: v, onClick }: { vessel: VesselRecord; onClick: () => void }) {
  return (
    <tr onClick={onClick} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60">
      <td className="px-5 py-3 text-xs font-medium text-link">
        <span className="inline-flex items-center gap-1.5">
          <Ship size={12} className="shrink-0 text-muted" /> {v.name}
        </span>
      </td>
      <td className="px-3 py-3 font-mono text-xs text-body">{v.code || <span className="text-muted">—</span>}</td>
      <td className="px-3 py-3 font-mono text-xs text-body">{v.imoCode || <span className="text-muted">—</span>}</td>
      <td className="px-3 py-3 text-xs text-body">{v.vesselType || <span className="text-muted">—</span>}</td>
      <td className="px-3 py-3 text-xs text-body">{v.nationality || <span className="text-muted">—</span>}</td>
      <td className="px-5 py-3 text-xs text-body">{v.owner || <span className="text-muted">—</span>}</td>
    </tr>
  )
}
