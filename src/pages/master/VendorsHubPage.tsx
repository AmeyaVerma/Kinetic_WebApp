import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Warehouse, Container, UserCheck, Truck, Ship, Wrench } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { supabase } from '../../lib/supabaseClient'

/**
 * Master Data → Vendors (spec v2).
 *
 * The Vendors card used to read "coming soon". v2 turns it into a group where
 * each kind of vendor is its own master with its own list: CFS, Empty
 * Container Yard and Surveyor now, with shipping lines, repair shops and
 * truckers to follow on the same pattern. CHAs and Agents keep their own
 * cards outside this group.
 *
 * All of them are shared by Kinetic and RKS and hold identity data only.
 * Terms, rates and credit stay inside each company and are never visible to
 * the other — the same split migration 0060 already applies to Parties and
 * ports.
 */

interface Tile {
  key: string
  label: string
  description: string
  icon: typeof Truck
  to?: string
  table?: 'cfs' | 'empty_depots' | 'surveyors'
}

const TILES: Tile[] = [
  {
    key: 'cfs',
    label: 'CFS',
    description:
      'Container freight stations, with gate timings and the port or ICD location code on each branch.',
    icon: Warehouse,
    to: '/master/vendors/cfs',
    table: 'cfs',
  },
  {
    key: 'yards',
    label: 'Empty Container Yards',
    description:
      'The depot master. Read by the Empty Pickup and Empty Drop-off Depot fields and printed on the CRO.',
    icon: Container,
    to: '/master/vendors/empty-yards',
    table: 'empty_depots',
  },
  {
    key: 'surveyors',
    label: 'Surveyors',
    description: 'Container surveyors printed on the Container Release Order.',
    icon: UserCheck,
    to: '/master/surveyors',
    table: 'surveyors',
  },
  {
    key: 'lines',
    label: 'Shipping lines',
    description: 'Carriers, their booking numbers and master BL numbers. Not built yet.',
    icon: Ship,
  },
  {
    key: 'repair',
    label: 'Repair shops',
    description: 'MNR workshops and their rates. Not built yet.',
    icon: Wrench,
  },
  {
    key: 'truckers',
    label: 'Truckers',
    description: 'Hauliers for pickup and delivery legs. Not built yet.',
    icon: Truck,
  },
]

export function VendorsHubPage() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [review, setReview] = useState<Record<string, number>>({})

  useEffect(() => {
    void (async () => {
      const live = TILES.filter((t) => t.table)
      const results = await Promise.all(
        live.map(async (t) => {
          const total = await supabase
            .from(t.table!)
            .select('*', { count: 'exact', head: true })
          // Surveyors predate the review columns on some rows, so a missing
          // count is shown as none rather than as an error.
          const flagged = await supabase
            .from(t.table!)
            .select('*', { count: 'exact', head: true })
            .eq('review_status', 'Needs review')
          return [t.key, total.count ?? 0, flagged.count ?? 0] as const
        }),
      )
      setCounts(Object.fromEntries(results.map((r) => [r[0], r[1]])))
      setReview(Object.fromEntries(results.map((r) => [r[0], r[2]])))
    })()
  }, [])

  const totalFlagged = Object.values(review).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-5">
      <Link to="/master" className="inline-flex items-center gap-1.5 text-sm text-link hover:underline">
        <ArrowLeft size={14} /> Back to Master Data
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Vendors</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          One master per kind of vendor. All are shared by Kinetic and RKS and hold identity data
          only — terms, rates and credit stay inside each company and are never visible to the
          other.
        </p>
      </div>

      {totalFlagged > 0 && (
        <div className="rounded-card border border-line bg-surface-2 px-4 py-3 text-xs text-muted">
          <span className="font-semibold text-heading">{totalFlagged} records need review</span>{' '}
          across these masters. They were imported exactly as supplied on 30 October and each
          carries the reviewer&rsquo;s note. A record stays Inactive, and out of every picker,
          until somebody clears it.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => {
          const Icon = t.icon
          const body = (
            <Card
              className={`flex h-full flex-col justify-between gap-4 p-5 transition ${
                t.to ? 'hover:border-primary/40 hover:shadow-md' : 'opacity-70'
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-btn bg-primary/10 text-primary">
                  <Icon size={18} />
                </span>
                {t.to ? (
                  <span className="rounded-badge bg-[#ECFDF5] px-1.5 py-0.5 text-[10px] font-semibold text-[#059669]">
                    Live
                  </span>
                ) : (
                  <span className="rounded-badge bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                    Not built
                  </span>
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-[15px] font-semibold text-heading">{t.label}</h3>
                  {counts[t.key] !== undefined && (
                    <span className="font-mono text-xs text-muted">({counts[t.key]})</span>
                  )}
                  {review[t.key] > 0 && (
                    <span className="rounded-badge bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-semibold text-[#B45309]">
                      {review[t.key]} to review
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted">{t.description}</p>
              </div>
              {t.to && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-link">
                  View <ChevronRight size={13} />
                </span>
              )}
            </Card>
          )
          return t.to ? (
            <Link key={t.key} to={t.to}>
              {body}
            </Link>
          ) : (
            <div key={t.key}>{body}</div>
          )
        })}
      </div>
    </div>
  )
}
