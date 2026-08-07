import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Contact, Truck, Ship, Container, Wallet, ChevronRight } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { useDataStore } from '../store/useDataStore'

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
  const { parties, fetchParties } = useDataStore()

  useEffect(() => {
    fetchParties()
  }, [fetchParties])

  const tiles: MasterTile[] = [
    {
      key: 'parties',
      label: 'Parties',
      description: 'Companies, individuals & BL control entries — shippers, consignees, customers, agents.',
      icon: Contact,
      live: true,
      count: parties.length,
    },
    {
      key: 'vendors',
      label: 'Vendors',
      description: 'Shipping lines, surveyors, CFS, repair shops, truckers, customs brokers.',
      icon: Truck,
      live: false,
    },
    {
      key: 'vessels',
      label: 'Vessels',
      description: 'Vessel identity and voyage schedules — carrier, IMO, POL/POD, ETD/ETA.',
      icon: Ship,
      live: false,
    },
    {
      key: 'containers',
      label: 'Containers',
      description: 'Container type catalogue and the physical fleet — ISO 6346, ownership, CSC expiry.',
      icon: Container,
      live: false,
    },
    {
      key: 'accounts',
      label: 'Accounts',
      description: 'Chart of accounts / ledger heads used for invoicing and charge posting.',
      icon: Wallet,
      live: false,
    },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Master Data</h1>
        <p className="mt-1 text-sm text-muted">
          The shared reference data every module autofills from. Five masters — built one at a time.
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
