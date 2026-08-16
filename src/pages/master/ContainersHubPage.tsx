import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Container as ContainerIcon, Wrench, FileWarning, Warehouse, ChevronRight } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { useDataStore } from '../../store/useDataStore'

interface Tile {
  key: string
  label: string
  description: string
  icon: typeof ContainerIcon
  live: boolean
  count?: number
}

/** Containers master — its own sub-hub, mirroring the top-level Master
    Data hub: click through to Container (the physical fleet, live), CMC or
    Container Items/Damage Codes (not built yet), or Empty Depots (live,
    just no data imported yet). */
export function ContainersHubPage() {
  const { containers, fetchContainers } = useDataStore()

  useEffect(() => {
    fetchContainers()
  }, [fetchContainers])

  const tiles: Tile[] = [
    {
      key: 'fleet',
      label: 'Container',
      description: 'The physical container fleet — status, location, hire, weights.',
      icon: ContainerIcon,
      live: true,
      count: containers.length,
    },
    {
      key: 'cmc',
      label: 'CMC',
      description: 'Not built yet.',
      icon: Wrench,
      live: false,
    },
    {
      key: 'damage-codes',
      label: 'Container Items / Damage Codes',
      description: 'Not built yet.',
      icon: FileWarning,
      live: false,
    },
    {
      key: 'empty-depots',
      label: 'Empty Depots',
      description: 'Empty container return / pickup yards.',
      icon: Warehouse,
      live: true,
    },
  ]

  return (
    <div className="space-y-5">
      <div>
        <Link to="/master" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline">
          <ArrowLeft size={13} /> Master Data
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Containers</h1>
        <p className="mt-1 text-sm text-muted">Four subfields, built one at a time.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <ContainerTile key={t.key} tile={t} />
        ))}
      </div>
    </div>
  )
}

function ContainerTile({ tile }: { tile: Tile }) {
  const Icon = tile.icon
  return (
    <Link to={`/master/containers/${tile.key}`}>
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
            {tile.count !== undefined && <span className="font-mono text-xs text-muted">({tile.count})</span>}
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
