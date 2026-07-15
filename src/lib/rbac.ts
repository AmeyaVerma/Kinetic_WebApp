/* ── Role-Based Access Control (RBAC) ────────────────────────────
   Single source of truth for who-can-see-what. The UI reads this to
   filter the sidebar, guard routes and disable actions. When the
   Supabase backend lands, this same matrix becomes the RLS policy —
   UI hiding is convenience, RLS is the real fence.                 */

import type { Role } from './types'

export type ModuleKey =
  | 'dashboard'
  | 'nvocc'
  | 'freight'
  | 'mnr'
  | 'accounts'
  | 'master'
  | 'approvals'
  | 'customers'
  | 'agents'
  | 'reports'
  | 'hr'
  | 'settings'
  | 'users'

/** full = create/edit/act · view = read-only · none = hidden */
export type Access = 'full' | 'view' | 'none'

export interface ModuleDef {
  key: ModuleKey
  label: string
  path: string
}

/** Module registry — path ties each module to its route + nav item. */
export const MODULES: ModuleDef[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { key: 'nvocc', label: 'NVOCC', path: '/nvocc' },
  { key: 'freight', label: 'Freight FWD', path: '/freight' },
  { key: 'mnr', label: 'MNR (Container)', path: '/mnr' },
  { key: 'accounts', label: 'Accounts', path: '/accounts' },
  { key: 'master', label: 'Master Data', path: '/master' },
  { key: 'approvals', label: 'Approvals', path: '/approvals' },
  { key: 'customers', label: 'Customer Portal', path: '/portal/customer' },
  { key: 'agents', label: 'Agent Portal', path: '/portal/agent' },
  { key: 'reports', label: 'Reports', path: '/reports' },
  { key: 'hr', label: 'HR', path: '/hr' },
  { key: 'settings', label: 'Settings', path: '/settings' },
  { key: 'users', label: 'Users & Roles', path: '/admin/users' },
]

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  ops: 'Operations',
  finance: 'Finance',
  sales: 'Sales / BD',
  mnr: 'MNR',
  hr: 'HR',
  customer: 'Customer',
  agent: 'Agent',
}

export const INTERNAL_ROLES: Role[] = ['admin', 'ops', 'finance', 'sales', 'mnr', 'hr']
export const EXTERNAL_ROLES: Role[] = ['customer', 'agent']

export function isExternal(role: Role): boolean {
  return EXTERNAL_ROLES.includes(role)
}

const F: Access = 'full'
const V: Access = 'view'
const N: Access = 'none'

/** The access matrix (design §2). External roles get no shell modules
    — they land in the scoped portal instead. */
export const ROLE_MATRIX: Record<Role, Record<ModuleKey, Access>> = {
  admin: {
    dashboard: F, nvocc: F, freight: F, mnr: F, accounts: F, master: F,
    approvals: F, customers: F, agents: F, reports: F, hr: F, settings: F, users: F,
  },
  ops: {
    dashboard: F, nvocc: F, freight: F, mnr: V, accounts: N, master: F,
    approvals: F, customers: V, agents: V, reports: F, hr: N, settings: F, users: N,
  },
  finance: {
    dashboard: F, nvocc: V, freight: V, mnr: V, accounts: F, master: V,
    approvals: F, customers: V, agents: V, reports: F, hr: V, settings: F, users: N,
  },
  sales: {
    dashboard: F, nvocc: F, freight: F, mnr: N, accounts: N, master: V,
    approvals: N, customers: F, agents: N, reports: F, hr: N, settings: F, users: N,
  },
  mnr: {
    dashboard: V, nvocc: V, freight: N, mnr: F, accounts: N, master: V,
    approvals: F, customers: N, agents: N, reports: F, hr: N, settings: F, users: N,
  },
  hr: {
    dashboard: V, nvocc: N, freight: N, mnr: N, accounts: N, master: N,
    approvals: F, customers: N, agents: N, reports: F, hr: F, settings: F, users: N,
  },
  // External — shell modules all hidden; scoped portal handled separately.
  customer: {
    dashboard: N, nvocc: N, freight: N, mnr: N, accounts: N, master: N,
    approvals: N, customers: N, agents: N, reports: N, hr: N, settings: N, users: N,
  },
  agent: {
    dashboard: N, nvocc: N, freight: N, mnr: N, accounts: N, master: N,
    approvals: N, customers: N, agents: N, reports: N, hr: N, settings: N, users: N,
  },
}

/** Where each role lands after login. */
export const LANDING: Record<Role, string> = {
  admin: '/dashboard',
  ops: '/dashboard',
  finance: '/accounts',
  sales: '/nvocc',
  mnr: '/mnr',
  hr: '/hr',
  customer: '/portal',
  agent: '/portal',
}

export type Override = Partial<Record<ModuleKey, Access>>

/** Effective access = per-user override (if set) else the role default. */
export function effectiveAccess(role: Role, overrides: Override | undefined, key: ModuleKey): Access {
  const ov = overrides?.[key]
  if (ov) return ov
  return ROLE_MATRIX[role][key]
}

export function moduleForPath(path: string): ModuleKey | null {
  // longest-prefix match so /nvocc/:id maps to nvocc
  const hit = MODULES.filter((m) => path === m.path || path.startsWith(m.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0]
  return hit?.key ?? null
}

export const ACCESS_LABEL: Record<Access, string> = { full: 'Full', view: 'View', none: '—' }
