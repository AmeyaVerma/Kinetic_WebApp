import { NavLink } from 'react-router-dom'
import { Ship, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { NAV_ITEMS } from './nav'
import { useUiStore } from '../../store/useUiStore'
import { useDataStore } from '../../store/useDataStore'

function BrandMark({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-5 pb-6 pt-6">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Ship size={20} strokeWidth={2.2} />
      </div>
      {!collapsed && (
        <div className="leading-tight">
          <p className="font-display text-[15px] font-bold tracking-wide text-heading">
            KINETIC LINE
          </p>
          <p className="text-[10px] font-medium tracking-[0.14em] text-muted">
            LOGISTICS ERP
          </p>
        </div>
      )}
    </div>
  )
}

export function SidebarContent({ collapsed = false }: { collapsed?: boolean }) {
  const approvalsPending = useDataStore(
    (s) => s.approvals.filter((a) => a.status === 'Pending').length,
  )
  const { theme, setTheme, toggleCollapsed } = useUiStore()

  return (
    <div className="flex h-full flex-col bg-surface">
      <BrandMark collapsed={collapsed} />

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-btn px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-[#475569] dark:text-body hover:bg-[var(--sidebar-hover)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    strokeWidth={2}
                    className={
                      isActive
                        ? 'text-white'
                        : 'text-[#334155] dark:text-muted group-hover:text-[var(--icon-hover)]'
                    }
                  />
                  {!collapsed && <span className="flex-1">{item.label}</span>}
                  {!collapsed && item.badgeKey === 'approvals' && (
                    <span className="rounded-badge bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">
                      {approvalsPending}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Theme toggle + collapse */}
      <div className="space-y-3 px-4 pb-5 pt-3">
        {!collapsed && (
          <div className="flex rounded-badge border border-line bg-surface p-1">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex-1 rounded-badge py-1.5 text-xs font-medium capitalize transition-colors ${
                  theme === t
                    ? 'bg-primary text-white'
                    : 'text-body hover:bg-surface-2'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          className="hidden h-9 w-9 items-center justify-center rounded-full border border-line text-[var(--icon)] transition-colors hover:bg-surface-2 hover:text-[var(--icon-hover)] lg:flex"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>
    </div>
  )
}

export function Sidebar() {
  const { sidebarOpen, closeSidebar, sidebarCollapsed } = useUiStore()

  return (
    <>
      {/* Desktop */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 border-r border-line lg:block ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[226px]'
        } transition-[width] duration-200`}
      >
        <SidebarContent collapsed={sidebarCollapsed} />
      </aside>

      {/* Mobile slide-in drawer (no bottom nav, per spec) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={closeSidebar}
          />
          <aside className="absolute left-0 top-0 h-full w-[260px] border-r border-line shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}
