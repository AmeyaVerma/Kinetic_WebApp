import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, ChevronDown, LogOut, Eye, EyeOff, Settings, Building2, ArrowLeftRight } from 'lucide-react'
import { GlobalSearch } from './GlobalSearch'
import { NotificationBell } from './NotificationBell'
import { useUiStore } from '../../store/useUiStore'
import { useAuthStore } from '../../store/useAuthStore'
import { INTERNAL_ROLES, ROLE_LABELS, effectiveAccess } from '../../lib/rbac'
import type { AppUser } from '../../store/useAuthStore'
import type { Role } from '../../lib/types'

export function Topbar({ user }: { user: AppUser }) {
  const { toggleSidebar } = useUiStore()
  const { signOut, viewAsRole, setViewAs } = useAuthStore()
  const companies = useAuthStore((s) => s.companies)
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId)
  const setActiveCompany = useAuthStore((s) => s.setActiveCompany)
  const activeCompany = companies.find((c) => c.id === activeCompanyId)
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const role = viewAsRole ?? user.role
  const canSeeSettings = effectiveAccess(role, viewAsRole ? undefined : user.overrides, 'settings') !== 'none'
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

      {activeCompany && (
        <span
          title="The company everything you do belongs to"
          className="hidden shrink-0 items-center gap-1.5 rounded-badge border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary md:inline-flex"
        >
          <Building2 size={12} /> {activeCompany.name}
        </span>
      )}

      <GlobalSearch />

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

        <NotificationBell />

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
                {companies.length > 1 && (
                  <>
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      Switch company
                    </p>
                    {companies.map((c) => (
                      <button
                        key={c.id}
                        onClick={async () => {
                          setMenuOpen(false)
                          if (c.id !== activeCompanyId) await setActiveCompany(c.id)
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-surface-2 ${
                          c.id === activeCompanyId ? 'text-primary' : 'text-body'
                        }`}
                      >
                        <ArrowLeftRight size={13} />
                        <span className="flex-1">{c.name}</span>
                        <span className="text-[10px] text-muted">{ROLE_LABELS[c.role] ?? c.role}</span>
                      </button>
                    ))}
                    <div className="my-1 border-t border-line" />
                  </>
                )}
                {canSeeSettings && (
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/settings') }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-body hover:bg-surface-2"
                  >
                    <Settings size={14} /> Settings
                  </button>
                )}
                <button
                  onClick={() => { setMenuOpen(false); signOut() }}
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
