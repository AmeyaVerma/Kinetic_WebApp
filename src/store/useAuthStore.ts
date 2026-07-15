/* ── Auth + user directory store ─────────────────────────────────
   Holds the login session and the STAFF user directory the Admin
   manages in Users & Roles. External customer/agent logins are
   governed inside their own records, not here (design §4).        */

import { create } from 'zustand'
import type { Role } from '../lib/types'
import type { Access, ModuleKey, Override } from '../lib/rbac'

export type UserStatus = 'Active' | 'Invited' | 'Suspended'

export interface AppUser {
  id: string
  name: string
  email: string
  role: Role
  status: UserStatus
  mfaEnabled: boolean
  lastLogin: string | null
  overrides: Override
  employeeId?: string // ties to HR record for internal staff
  scopeName?: string // for external users — the customer/agent they belong to
}

export interface AuditEntry {
  id: string
  at: string
  actor: string
  action: string
}

let seq = 0
const uid = () => `au${++seq}`
const now = () => new Date().toISOString()

const seedUsers: AppUser[] = [
  { id: 'u1', name: 'Siddharth Singh', email: 'siddharth@kintlog.com', role: 'admin', status: 'Active', mfaEnabled: true, lastLogin: '2026-07-15T08:30:00Z', overrides: {}, employeeId: 'e1' },
  { id: 'u2', name: 'Kavita Mehta', email: 'kavita@kintlog.com', role: 'ops', status: 'Active', mfaEnabled: true, lastLogin: '2026-07-14T17:10:00Z', overrides: {}, employeeId: 'e2' },
  { id: 'u3', name: 'Rohan Kulkarni', email: 'rohan@kintlog.com', role: 'ops', status: 'Active', mfaEnabled: false, lastLogin: '2026-07-13T09:45:00Z', overrides: {}, employeeId: 'e3' },
  { id: 'u4', name: 'Neha Sharma', email: 'neha@kintlog.com', role: 'finance', status: 'Active', mfaEnabled: true, lastLogin: '2026-07-15T07:55:00Z', overrides: {}, employeeId: 'e4' },
  { id: 'u5', name: 'Imtiaz Shaikh', email: 'imtiaz@kintlog.com', role: 'mnr', status: 'Active', mfaEnabled: false, lastLogin: '2026-07-12T14:20:00Z', overrides: {}, employeeId: 'e5' },
  { id: 'u6', name: 'Arjun Rao', email: 'arjun.rao@kintlog.com', role: 'sales', status: 'Active', mfaEnabled: false, lastLogin: '2026-07-11T11:00:00Z', overrides: {} },
  { id: 'u7', name: 'Priya Desai', email: 'priya@kintlog.com', role: 'hr', status: 'Active', mfaEnabled: false, lastLogin: '2026-07-10T10:30:00Z', overrides: {} },
  { id: 'u8', name: 'Deepak Nair', email: 'deepak@kintlog.com', role: 'ops', status: 'Suspended', mfaEnabled: false, lastLogin: '2026-06-28T16:00:00Z', overrides: { accounts: 'view' }, employeeId: 'e7' },
  // External demo logins (managed in their own records; shown here for the demo picker only)
  { id: 'u9', name: 'Rajesh Nair (ABC Exports)', email: 'rajesh@abcexports.in', role: 'customer', status: 'Active', mfaEnabled: false, lastLogin: '2026-07-14T08:40:00Z', overrides: {}, scopeName: 'ABC Exports Pvt. Ltd.' },
  { id: 'u10', name: 'Khalid Mansoor (Gulf Star)', email: 'ops@gulfstar.ae', role: 'agent', status: 'Active', mfaEnabled: true, lastLogin: '2026-07-13T07:55:00Z', overrides: {}, scopeName: 'Gulf Star Shipping LLC' },
]

interface AuthState {
  users: AppUser[]
  currentUserId: string | null
  viewAsRole: Role | null // admin-only "preview as" — never escalates
  audit: AuditEntry[]

  login: (userId: string) => void
  logout: () => void
  setViewAs: (role: Role | null) => void

  // Admin actions
  assignRole: (userId: string, role: Role) => void
  setOverride: (userId: string, key: ModuleKey, access: Access | 'inherit') => void
  setStatus: (userId: string, status: UserStatus) => void
  inviteUser: (input: { name: string; email: string; role: Role }) => void
  removeUser: (userId: string) => void
}

function logAudit(list: AuditEntry[], actor: string, action: string): AuditEntry[] {
  return [{ id: uid(), at: now(), actor, action }, ...list]
}

export const useAuthStore = create<AuthState>((set) => ({
  users: seedUsers,
  currentUserId: null,
  viewAsRole: null,
  audit: [
    { id: 'a0', at: '2026-07-01T09:00:00Z', actor: 'System', action: 'RBAC initialised — 8 roles, 10 staff/external logins seeded' },
  ],

  login: (userId) =>
    set((s) => {
      const u = s.users.find((x) => x.id === userId)
      if (!u) return s
      return {
        currentUserId: userId,
        viewAsRole: null,
        users: s.users.map((x) => (x.id === userId ? { ...x, lastLogin: now() } : x)),
      }
    }),

  logout: () => set({ currentUserId: null, viewAsRole: null }),

  setViewAs: (role) => set({ viewAsRole: role }),

  assignRole: (userId, role) =>
    set((s) => {
      const u = s.users.find((x) => x.id === userId)
      const actor = s.users.find((x) => x.id === s.currentUserId)?.name ?? 'Admin'
      if (!u || u.role === role) return s
      return {
        users: s.users.map((x) => (x.id === userId ? { ...x, role } : x)),
        audit: logAudit(s.audit, actor, `Role changed for ${u.name}: ${u.role} → ${role}`),
      }
    }),

  setOverride: (userId, key, access) =>
    set((s) => {
      const u = s.users.find((x) => x.id === userId)
      const actor = s.users.find((x) => x.id === s.currentUserId)?.name ?? 'Admin'
      if (!u) return s
      const overrides = { ...u.overrides }
      if (access === 'inherit') delete overrides[key]
      else overrides[key] = access
      return {
        users: s.users.map((x) => (x.id === userId ? { ...x, overrides } : x)),
        audit: logAudit(s.audit, actor, `Access override for ${u.name}: ${key} → ${access}`),
      }
    }),

  setStatus: (userId, status) =>
    set((s) => {
      const u = s.users.find((x) => x.id === userId)
      const actor = s.users.find((x) => x.id === s.currentUserId)?.name ?? 'Admin'
      if (!u) return s
      return {
        users: s.users.map((x) => (x.id === userId ? { ...x, status } : x)),
        audit: logAudit(s.audit, actor, `${u.name} set to ${status}`),
      }
    }),

  inviteUser: (input) =>
    set((s) => {
      const actor = s.users.find((x) => x.id === s.currentUserId)?.name ?? 'Admin'
      const user: AppUser = {
        id: uid(),
        name: input.name,
        email: input.email,
        role: input.role,
        status: 'Invited',
        mfaEnabled: false,
        lastLogin: null,
        overrides: {},
      }
      return {
        users: [...s.users, user],
        audit: logAudit(s.audit, actor, `Invited ${input.name} (${input.email}) as ${input.role}`),
      }
    }),

  removeUser: (userId) =>
    set((s) => {
      const u = s.users.find((x) => x.id === userId)
      const actor = s.users.find((x) => x.id === s.currentUserId)?.name ?? 'Admin'
      if (!u) return s
      return {
        users: s.users.filter((x) => x.id !== userId),
        audit: logAudit(s.audit, actor, `Removed login for ${u.name} — access revoked, history retained`),
      }
    }),
}))

/** The user actually logged in. */
export function useCurrentUser(): AppUser | null {
  return useAuthStore((s) => s.users.find((u) => u.id === s.currentUserId) ?? null)
}
