import { Link } from 'react-router-dom'
import { ArrowLeft, Ruler, Package, Coins, ChevronRight, type LucideIcon } from 'lucide-react'
import { Card } from '../../components/ui/Card'

interface Tile {
  key: string
  label: string
  description: string
  icon: LucideIcon
  live?: boolean
}

const TILES: Tile[] = [
  {
    key: 'uom',
    label: 'Units of Measurement',
    description: 'Not built yet.',
    icon: Ruler,
  },
  {
    key: 'package-types',
    label: 'Package types',
    description: 'Package type codes used across NVOCC bookings.',
    icon: Package,
    live: true,
  },
  {
    key: 'currencies',
    label: 'Currencies',
    description: 'Not built yet.',
    icon: Coins,
  },
]

/** Miscellaneous master — its own 3-tile sub-hub, mirroring the Containers
    hub pattern. Package types is live; UOM and Currencies still not
    built. */
export function MiscellaneousHubPage() {
  return (
    <div className="space-y-5">
      <div>
        <Link to="/master" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Master Data
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Miscellaneous</h1>
        <p className="mt-1 text-sm text-muted">Three subfields, built one at a time.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <MiscTile key={t.key} tile={t} />
        ))}
      </div>
    </div>
  )
}

function MiscTile({ tile }: { tile: Tile }) {
  const Icon = tile.icon
  return (
    <Link to={`/master/misc/${tile.key}`}>
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
          <h3 className="text-[15px] font-semibold text-heading">{tile.label}</h3>
          <p className="mt-1 text-xs text-muted">{tile.description}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-link">
          View <ChevronRight size={13} />
        </span>
      </Card>
    </Link>
  )
}
