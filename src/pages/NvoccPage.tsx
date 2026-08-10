import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowRight, Ship, PackageCheck, PackageOpen, Truck, CheckCircle2, FileText } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatKpi } from '../components/ui/StatKpi'
import { CsvButton } from '../components/ui/CsvButton'
import { StatusChip } from '../components/ui/StatusChip'
import { ProgressBar } from '../components/ui/ProgressBar'
import { NewBookingWizard } from '../components/nvocc/NewBookingWizard'
import { useDataStore } from '../store/useDataStore'
import { cyclePct, deriveStatus, toChipStatus } from '../lib/milestones'

export function NvoccPage() {
  const navigate = useNavigate()
  const [wizardOpen, setWizardOpen] = useState(false)

  const { bookings, milestones, fetchBookings } = useDataStore()

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const nvoccBookings = useMemo(
    () => bookings.filter((b) => b.module === 'nvocc'),
    [bookings],
  )

  const kpis = useMemo(() => {
    const statuses = nvoccBookings.map((b) => {
      const entries = milestones.filter((m) => m.bookingId === b.id)
      return toChipStatus(deriveStatus(b.direction, entries, b.cancelled))
    })
    return {
      total: nvoccBookings.length,
      exports: nvoccBookings.filter((b) => b.direction === 'Export').length,
      imports: nvoccBookings.filter((b) => b.direction === 'Import').length,
      inTransit: statuses.filter((s) => s === 'In Transit').length,
      delivered: statuses.filter((s) => s === 'Delivered' || s === 'Arrived').length,
      blDrafts: statuses.filter((s) => s === 'BL Draft').length,
    }
  }, [nvoccBookings, milestones])

  const bookingRows = useMemo(
    () =>
      nvoccBookings.map((b) => {
        const entries = milestones.filter((m) => m.bookingId === b.id)
        return {
          'Booking Ref': b.bookingRef,
          Direction: b.direction,
          POL: b.pol,
          POD: b.pod,
          Vessel: b.vesselName,
          Voyage: b.voyageNo,
          Customer: b.bookingPartyName,
          'Cycle %': cyclePct(b.direction, entries),
          Status: deriveStatus(b.direction, entries, b.cancelled),
        }
      }),
    [nvoccBookings, milestones],
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">NVOCC</h1>
          <p className="mt-1 text-sm text-muted">
            We own the BL — carrier of record. Booking → costing (Admin approval if non-Admin) → BL → Financial closure.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus size={15} /> New booking
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatKpi label="Total Bookings" value={kpis.total} icon={<Ship size={17} />} tint="#ECFDF5" color="#10B981" />
        <StatKpi label="Exports" value={kpis.exports} icon={<PackageCheck size={17} />} tint="#EEF2FF" color="#6366F1" />
        <StatKpi label="Imports" value={kpis.imports} icon={<PackageOpen size={17} />} tint="#FDF2F8" color="#DB2777" />
        <StatKpi label="In Transit" value={kpis.inTransit} icon={<Truck size={17} />} tint="#EFF6FF" color="#3B82F6" />
        <StatKpi label="Delivered / Arrived" value={kpis.delivered} icon={<CheckCircle2 size={17} />} tint="#F5F3FF" color="#8B5CF6" />
        <StatKpi label="BL Drafts" value={kpis.blDrafts} icon={<FileText size={17} />} tint="#FEFCE8" color="#F59E0B" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-end border-b border-line px-4 py-2.5">
          <CsvButton filename="nvocc-bookings" rows={bookingRows} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Booking Ref</th>
                <th className="px-3 py-3 font-medium">Direction</th>
                <th className="px-3 py-3 font-medium">POL → POD</th>
                <th className="px-3 py-3 font-medium">Vessel / Voyage</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Cycle</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {nvoccBookings.map((b) => {
                const entries = milestones.filter((m) => m.bookingId === b.id)
                const status = deriveStatus(b.direction, entries, b.cancelled)
                const pct = cyclePct(b.direction, entries)
                return (
                  <tr
                    key={b.id}
                    onClick={() => navigate(`/nvocc/${b.id}`)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60"
                  >
                    <td className="px-5 py-3 font-mono text-xs font-medium text-link">{b.bookingRef}</td>
                    <td className="px-3 py-3 text-xs text-body">{b.direction}</td>
                    <td className="px-3 py-3 text-xs text-body">{b.pol} → {b.pod}</td>
                    <td className="px-3 py-3 text-xs text-body">{b.vesselName} / {b.voyageNo}</td>
                    <td className="px-3 py-3 text-xs text-body">{b.bookingPartyName}</td>
                    <td className="w-36 px-3 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar pct={pct} color="#10B981" />
                        <span className="w-8 font-mono text-[11px] text-muted">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3"><StatusChip status={toChipStatus(status)} /></td>
                    <td className="px-5 py-3 text-right">
                      <ArrowRight size={15} className="inline text-muted" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <NewBookingWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(id) => {
          setWizardOpen(false)
          navigate(`/nvocc/${id}`)
        }}
      />
    </div>
  )
}
