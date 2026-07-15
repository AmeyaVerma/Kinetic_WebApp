import { useState } from 'react'
import { Search, Bell, Menu, ChevronDown, LogOut, Eye, EyeOff } from 'lucide-react'
import { useUiStore } from '../../store/useUiStore'
import { useAuthStore } from '../../store/useAuthStore'
import { INTERNAL_ROLES, ROLE_LABELS } from '../../lib/rbac'
import type { AppUser } from '../../store/useAuthStore'
import type { Role } from '../../lib/types'

export function Topbar({ user, notifications = 0 }: { user: AppUser; notifications?: number }) {
  const { toggleSidebar } = useUiStore()
  const { logout, viewAsRole, setViewAs } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const isAdmin = user.role === 'admin'
  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur-md lg:px-6">
      <button
        onClick={toggleSidebar}
        className="flex h-9 w-9 items-center justify-center rounded-btn text-[var(--icon)] hover:bg-surface-2 lg:hidden"
      >
        <Menu size={20} />
      </button>

      <div className="relative flex-1 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search booking, BL, container, invoice..."
          className="w-full rounded-input border border-[#E5E7EB] dark:border-line bg-surface py-2.5 pl-10 pr-4 text-sm text-heading placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {/* Admin-only: preview the app as another role (never escalates) */}
        {isAdmin && (
          <div className="relative">
            <button
              onClick={() => setViewOpen((v) => !v)}
              className={`hidden items-center gap-1.5 rounded-badge border px-3 py-1.5 text-xs font-medium sm:flex ${
                viewAsRole
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-[#E5E7EB] dark:border-line bg-surface text-[#334155] dark:text-body hover:bg-surface-2'
              }`}
            >
              {viewAsRole ? <EyeOff size={13} /> : <Eye size={13} />}
              {viewAsRole ? `Viewing as ${ROLE_LABELS[viewAsRole]}` : 'View as'}
              <ChevronDown size={13} />
            </button>
            {viewOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setViewOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-btn border border-line bg-surface py-1 shadow-card">
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Preview access as</p>
                  {viewAsRole && (
                    <button
                      onClick={() => { setViewAs(null); setViewOpen(false) }}
                      className="block w-full px-3 py-2 text-left text-xs font-medium text-primary hover:bg-surface-2"
                    >
                      ← Back to Admin
                    </button>
                  )}
                  {INTERNAL_ROLES.filter((r) => r !== 'admin').map((r) => (
                    <button
                      key={r}
                      onClick={() => { setViewAs(r as Role); setViewOpen(false) }}
                      className={`block w-full px-3 py-2 text-left text-xs font-medium hover:bg-surface-2 ${
                        viewAsRole === r ? 'text-primary' : 'text-body'
                      }`}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--icon)] hover:bg-surface-2 hover:text-[var(--icon-hover)]">
          <Bell size={18} />
          {notifications > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-badge bg-accent-coral px-1 text-[10px] font-bold text-white">
              {notifications}
            </span>
          )}
        </button>

        {/* User menu */}
        <div className="relative border-l border-line pl-2.5 sm:pl-3">
          <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {initials}
            </div>
            <div className="hidden leading-tight text-left sm:block">
              <p className="text-[13px] font-semibold text-heading">{user.name}</p>
              <p className="text-[11px] text-muted">{ROLE_LABELS[user.role]}</p>
            </div>
            <ChevronDown size={14} className="hidden text-muted sm:block" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-btn border border-line bg-surface py-1 shadow-card">
                <div className="border-b border-line px-3 py-2">
                  <p className="text-[13px] font-semibold text-heading">{user.name}</p>
                  <p className="font-mono text-[11px] text-muted">{user.email}</p>
                  <p className="mt-1 text-[11px] text-muted">Role: {ROLE_LABELS[user.role]}</p>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); logout() }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-body hover:bg-surface-2"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
