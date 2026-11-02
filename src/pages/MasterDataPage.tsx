import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Briefcase, UserCheck, Contact, Truck, Ship, Container, Wallet, Anchor, LayoutGrid, ChevronRight, Globe2, Barcode } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { useDataStore } from '../store/useDataStore'
import { supabase } from '../lib/supabaseClient'

interface MasterTile {
  key: string
  label: string
  description: string
  icon: typeof Contact
  live: boolean
  count?: number
}

/** Master Data hub — one card per master, click through to browse/search it.
    Parties is the only one built so far (Pass 1); the rest are scaffolded
    placeholders following the same data-in → add-format → autofill sequence. */
export function MasterDataPage() {
  const { parties, fetchParties, containers, fetchContainers } = useDataStore()
  // Vessels (3,794 rows) is never fully loaded client-side — see
  // VesselsMasterPage — so the tile count here is a lightweight
  // head-only count query, not a full fetch.
  const [vesselsCount, setVesselsCount] = useState<number | null>(null)
  const [agentCount, setAgentCount] = useState<number | null>(null)
  const [hsCount, setHsCount] = useState<number | null>(null)

  useEffect(() => {
    fetchParties()
    fetchContainers()
    supabase
      .from('vessels')
      .select('*', { count: 'exact', head: true })
      .then(({ count }) => setVesselsCount(count ?? 0))
    supabase
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .then(({ count }) => setAgentCount(count ?? 0))
    supabase
      .from('hs_codes')
      .select('*', { count: 'exact', head: true })
      .then(({ count }) => setHsCount(count ?? 0))
  }, [fetchParties, fetchContainers])

  const tiles: MasterTile[] = [
    {
      key: 'parties',
      label: 'Parties',
      description: 'Companies, individuals & BL control entries — shippers, consignees, customers. Agents have their own master.',
      icon: Contact,
      live: true,
      count: parties.length,
    },
    {
      key: 'agents',
      label: 'Agents',
      description:
        'Overseas and origin agents. Every agent picker, the BL Overseas Agent box and the Agent portal read this master and nothing else.',
      icon: Globe2,
      live: true,
      count: agentCount ?? undefined,
    },
    {
      key: 'vendors',
      label: 'Vendors',
      description: 'A master per kind of vendor — CFS, empty container yards, surveyors. Shipping lines, repair shops and truckers to follow.',
      icon: Truck,
      live: true,
    },
    {
      key: 'vessels',
      label: 'Vessels',
      description: 'Vessel identity and voyage schedules — carrier, IMO, POL/POD, ETD/ETA.',
      icon: Ship,
      live: true,
      count: vesselsCount ?? undefined,
    },
    {
      key: 'containers',
      label: 'Containers',
      description: 'The physical container fleet. CMC and Damage Codes subfields not built yet.',
      icon: Container,
      live: true,
      count: containers.length,
    },
    {
      key: 'accounts',
      label: 'Accounts',
      description: 'Chart of accounts / ledger heads used for invoicing and charge posting.',
      icon: Wallet,
      live: false,
    },
    {
      key: 'hs-codes',
      label: 'HS codes',
      description:
        'The universal six-digit WCO nomenclature, plus each country’s own extension. A booking or BL can carry several codes.',
      icon: Barcode,
      live: true,
      count: hsCount ?? undefined,
    },
    {
      key: 'ports',
      label: 'Ports / ICDs / Terminals',
      description: 'Sea ports with terminals, ICDs, and air ports.',
      icon: Anchor,
      live: true,
    },
    {
      key: 'misc',
      label: 'Miscellaneous',
      description: 'Units of measurement, package types, and currencies.',
      icon: LayoutGrid,
      live: true,
    },
    {
      key: 'company',
      label: 'Company settings',
      description: 'The text and artwork every generated document prints — logo, stamps, BL backside.',
      icon: Building2,
      live: true,
    },
    {
      key: 'surveyors',
      label: 'Surveyors',
      description: 'Container surveyors printed on the Container Release Order. Also reachable inside the Vendors group.',
      icon: UserCheck,
      live: true,
    },
    {
      key: 'chas',
      label: 'CHAs',
      description: 'Customs House Agents printed on the Delivery Order and Off Loading Letter.',
      icon: Briefcase,
      live: true,
    },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Master Data</h1>
        <p className="mt-1 text-sm text-muted">
          The shared reference data every module autofills from. Identity is shared by both
          companies; terms, credit and bookings stay inside each one.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <MasterCard key={t.key} tile={t} />
        ))}
      </div>
    </div>
  )
}

function MasterCard({ tile }: { tile: MasterTile }) {
  const Icon = tile.icon
  return (
    <Link to={`/master/${tile.key}`}>
      <Card className="flex h-full flex-col justify-between gap-4 p-5 transition hover:border-primary/40 hover:shadow-md">
        <div className="flex items-start justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-btn bg-primary/10 text-primary">
            <Icon size={18} />
          </span>
          {tile.live ? (
            <span className="rounded-badge bg-[#ECFDF5] px-1.5 py-0.5 text-[10px] font-semibold text-[#059669]">
              Live
            </span>
          ) : (
            <span className="rounded-badge bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
              Coming soon
            </span>
          )}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-[15px] font-semibold text-heading">{tile.label}</h3>
            {tile.count !== undefined && (
              <span className="font-mono text-xs text-muted">({tile.count})</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted">{tile.description}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-link">
          View <ChevronRight size={13} />
        </span>
      </Card>
    </Link>
  )
}
