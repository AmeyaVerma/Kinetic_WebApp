import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Info, Search } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { TextInput, Select } from '../../components/ui/Field'
import { Tabs } from '../../components/ui/Tabs'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabaseClient'

/**
 * Master Data → HS codes (spec v2).
 *
 * 5,612 six-digit WCO HS 2022 codes, shared by both companies like ports.
 * Too many to hold in the browser, so this searches Postgres rather than
 * filtering an array -- the description index added in migration 0086 is what
 * makes that fast.
 *
 * The import reads public/reference/hs-2022.json, which is the supplied
 * spreadsheet converted once and kept in the repository so the master can be
 * rebuilt from source rather than from whatever happens to be in a database.
 * It is idempotent: every row is upserted on its code, so running it twice
 * changes nothing.
 */

interface CodeRow {
  code: string
  code_dotted: string | null
  description: string
  heading_code: string
  hs_headings?: { description: string; chapter_code: string } | null
}

interface CountryRow {
  country_code: string
  country_name: string
  national_system: string | null
  national_digits: number | null
  official_source: string | null
  note: string | null
  verify_before_use: boolean
}

const PAGE = 50

export function HsCodesMasterPage() {
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? user?.role) === 'admin'

  const [tab, setTab] = useState('codes')
  const [query, setQuery] = useState('')
  const [chapter, setChapter] = useState('')
  const [chapters, setChapters] = useState<{ code: string; description: string }[]>([])
  const [rows, setRows] = useState<CodeRow[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [countries, setCountries] = useState<CountryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadCounts = useCallback(async () => {
    const [{ count }, chs, cos] = await Promise.all([
      supabase.from('hs_codes').select('*', { count: 'exact', head: true }),
      supabase.from('hs_chapters').select('code, description').order('code'),
      supabase.from('hs_countries').select('*').order('country_name'),
    ])
    setTotal(count ?? 0)
    setChapters((chs.data as { code: string; description: string }[]) ?? [])
    setCountries((cos.data as CountryRow[]) ?? [])
  }, [])

  useEffect(() => {
    void loadCounts()
  }, [loadCounts])

  // Search runs in Postgres. 5,612 rows is small for a database and large for
  // a browser, and the portal will search this master too.
  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      void (async () => {
        setLoading(true)
        let q = supabase
          .from('hs_codes')
          .select('code, code_dotted, description, heading_code, hs_headings(description, chapter_code)')
          .order('code')
          .limit(PAGE)
        const needle = query.trim().replace(/[,%]/g, ' ')
        if (needle) {
          q = /^\d+$/.test(needle)
            ? q.like('code', `${needle}%`)
            : q.ilike('description', `%${needle}%`)
        }
        if (chapter) q = q.eq('hs_headings.chapter_code', chapter)
        const { data, error: err } = await q
        if (cancelled) return
        if (err) setError(err.message)
        setRows((data as unknown as CodeRow[]) ?? [])
        setLoading(false)
      })()
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query, chapter])

  /** Loads the master from the reference file. Idempotent by design. */
  const runImport = async () => {
    setError(null)
    setImporting('Reading the reference file…')
    try {
      const res = await fetch('/reference/hs-2022.json')
      if (!res.ok) throw new Error(`Reference file not found (${res.status})`)
      const payload = (await res.json()) as {
        chapters: [string, string, string][]
        headings: [string, string, string][]
        codes: [string, string, string, string][]
      }

      // Order matters: a heading points at a chapter and a code at a heading,
      // so the parents go first or the foreign keys refuse the children.
      setImporting(`Chapters (${payload.chapters.length})…`)
      const chRows = payload.chapters.map(([code, description, section]) => ({
        code,
        description,
        section,
      }))
      const chErr = (await supabase.from('hs_chapters').upsert(chRows, { onConflict: 'code' })).error
      if (chErr) throw new Error(chErr.message)

      setImporting(`Headings (${payload.headings.length})…`)
      const hdRows = payload.headings.map(([code, description, chapter_code]) => ({
        code,
        description,
        chapter_code,
      }))
      for (let i = 0; i < hdRows.length; i += 500) {
        const slice = hdRows.slice(i, i + 500)
        const e = (await supabase.from('hs_headings').upsert(slice, { onConflict: 'code' })).error
        if (e) throw new Error(e.message)
      }

      const cdRows = payload.codes.map(([code, code_dotted, description, heading_code]) => ({
        code,
        code_dotted,
        description,
        heading_code,
      }))
      for (let i = 0; i < cdRows.length; i += 500) {
        setImporting(`Codes ${i + 1}–${Math.min(i + 500, cdRows.length)} of ${cdRows.length}…`)
        const slice = cdRows.slice(i, i + 500)
        const e = (await supabase.from('hs_codes').upsert(slice, { onConflict: 'code' })).error
        if (e) throw new Error(e.message)
      }

      setImporting(null)
      await loadCounts()
    } catch (e) {
      setImporting(null)
      setError(e instanceof Error ? e.message : 'Import failed')
    }
  }

  const empty = total === 0

  const chapterName = useMemo(
    () => new Map(chapters.map((c) => [c.code, c.description])),
    [chapters],
  )

  return (
    <div className="space-y-5">
      <Link to="/master" className="inline-flex items-center gap-1.5 text-sm text-link hover:underline">
        <ArrowLeft size={14} /> Back to Master Data
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">HS codes</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            The universal six-digit WCO nomenclature, shared by both companies like ports. A
            booking or BL can carry several codes, each with its own cargo line.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" variant="secondary" onClick={() => void runImport()} disabled={!!importing}>
            <Download size={14} /> {empty ? 'Load from reference file' : 'Re-sync from reference file'}
          </Button>
        )}
      </div>

      {importing && (
        <div className="rounded-card border border-line bg-surface-2 px-4 py-3 text-sm">
          <span className="font-semibold text-heading">Importing.</span> {importing}
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {empty && !importing && (
        <div className="flex items-start gap-2 rounded-card border border-line bg-surface-2 px-4 py-3 text-xs text-muted">
          <Info size={14} className="mt-0.5 shrink-0" />
          <p>
            The master is empty. The 5,612 codes Siddharth supplied are kept in the repository
            at <code>public/reference/hs-2022.json</code>, converted once from the spreadsheet,
            so the master can be rebuilt from source rather than from whatever happens to be in
            a database. Loading it is safe to repeat — every row is matched on its code.
          </p>
        </div>
      )}

      <Tabs
        tabs={[
          { key: 'codes', label: 'Codes', badge: total ?? undefined },
          { key: 'countries', label: 'National systems', badge: countries.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'codes' && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <label className="text-xs text-muted">Search</label>
              <TextInput
                className="mt-1"
                placeholder="Code (0101) or words in the description (live horses)…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <label className="text-xs text-muted">
              Chapter
              <Select className="mt-1" value={chapter} onChange={(e) => setChapter(e.target.value)}>
                <option value="">All chapters</option>
                {chapters.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.description}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-3 py-3 font-medium">Description</th>
                    <th className="px-3 py-3 font-medium">Heading</th>
                    <th className="px-3 py-3 font-medium">Chapter</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.code} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-mono text-xs font-medium">
                        {r.code_dotted || r.code}
                      </td>
                      <td className="px-3 py-3">{r.description}</td>
                      <td className="px-3 py-3 text-xs text-muted">
                        {r.heading_code} · {r.hs_headings?.description ?? ''}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted">
                        {r.hs_headings?.chapter_code
                          ? `${r.hs_headings.chapter_code} — ${chapterName.get(r.hs_headings.chapter_code) ?? ''}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-sm text-muted">
                        {empty ? 'Nothing loaded yet.' : `Nothing matches “${query}”.`}
                      </td>
                    </tr>
                  )}
                  {loading && (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-sm text-muted">
                        <Search size={14} className="mr-1 inline" /> Searching…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {!loading && rows.length === PAGE && (
              <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
                Showing the first {PAGE} matches. Narrow the search to see more.
              </p>
            )}
          </Card>
        </>
      )}

      {tab === 'countries' && (
        <>
          <div className="flex items-start gap-2 rounded-card border border-line bg-surface-2 px-4 py-3 text-xs text-muted">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>
              The six digits above are international. Each country extends them, and by a
              different number of digits — India uses 8 (ITC-HS), the US 10, Saudi Arabia 12.
              The same cargo therefore carries different codes at each end of a shipment, which
              is why the master is built to hold a national code beneath each international one
              and to pair an Indian code with its overseas counterpart. Both of those arrived
              empty and are filled as the business needs them.
            </p>
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-4 py-3 font-medium">Country</th>
                    <th className="px-3 py-3 font-medium">System</th>
                    <th className="px-3 py-3 font-medium">Digits</th>
                    <th className="px-3 py-3 font-medium">Authority</th>
                    <th className="px-3 py-3 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {countries.map((c) => (
                    <tr key={c.country_code} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-muted">{c.country_code}</span>{' '}
                        <span className="font-medium">{c.country_name}</span>
                        {c.country_code === 'IN' && (
                          <Badge tone="success" label="Default" />
                        )}
                      </td>
                      <td className="px-3 py-3">{c.national_system ?? '—'}</td>
                      <td className="px-3 py-3 font-mono text-xs">{c.national_digits ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-muted">{c.official_source ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-muted">
                        {c.note ?? (c.verify_before_use ? 'Confirm the current length with the authority.' : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
