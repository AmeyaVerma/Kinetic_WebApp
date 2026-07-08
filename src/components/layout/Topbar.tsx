import { useState } from 'react'
import { Search, Bell, Menu, ChevronDown } from 'lucide-react'
import { useUiStore } from '../../store/useUiStore'
import type { CurrentUser, Role } from '../../lib/types'

const ROLES: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'ops', label: 'Ops' },
  { value: 'finance', label: 'Finance' },
  { value: 'sales', label: 'Sales' },
  { value: 'mnr', label: 'MNR' },
  { value: 'hr', label: 'HR' },
  { value: 'customer', label: 'Customer' },
  { value: 'agent', label: 'Agent' },
]

export function Topbar({
  user,
  notifications = 0,
}: {
  user: CurrentUser
  notifications?: number
}) {
  const { toggleSidebar } = useUiStore()
  const [roleOpen, setRoleOpen] = useState(false)
  const [role, setRole] = useState<Role>(user.role)
  const roleLabel = ROLES.find((r) => r.value === role)?.label ?? user.roleLabel

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur-md lg:px-6">
      <button
        onClick={toggleSidebar}
        className="flex h-9 w-9 items-center justify-center rounded-btn text-[var(--icon)] hover:bg-surface-2 lg:hidden"
      >
        <Menu size={20} />
      </button>

      <div className="relative flex-1 max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="text"
          placeholder="Search booking, BL, container, invoice..."
          className="w-full rounded-input border border-[#E5E7EB] dark:border-line bg-surface py-2.5 pl-10 pr-4 text-sm text-heading placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {/* Role switcher */}
        <div className="relative">
          <button
            onClick={() => setRoleOpen((v) => !v)}
            className="hidden items-center gap-1.5 rounded-badge border border-[#E5E7EB] dark:border-line bg-surface px-3 py-1.5 text-xs font-medium text-[#334155] dark:text-body hover:bg-surface-2 sm:flex"
          >
            {roleLabel}
            <ChevronDown size={13} />
          </button>
          {roleOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setRoleOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-btn border border-line bg-surface py-1 shadow-card">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => {
                      setRole(r.value)
                      setRoleOpen(false)
                    }}
                    className={`block w-full px-3 py-2 text-left text-xs font-medium hover:bg-surface-2 ${
                      role === r.value ? 'text-primary' : 'text-body'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--icon)] hover:bg-surface-2 hover:text-[var(--icon-hover)]">
          <Bell size={18} />
          {notifications > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-badge bg-accent-coral px-1 text-[10px] font-bold text-white">
              {notifications}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2.5 border-l border-line pl-2.5 sm:pl-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {user.avatarInitials}
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="text-[13px] font-semibold text-heading">{user.name}</p>
            <p className="text-[11px] text-muted">{roleLabel}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
