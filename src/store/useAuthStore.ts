/* ── Auth + user directory store ─────────────────────────────────
   Real session/identity (Phase 1 — Supabase Auth): `session`/`profile`
   below are the actual signed-in user, persisted by Supabase across
   navigation and reloads. The `users` directory + admin actions
   (assignRole, inviteUser, etc.) still run on the in-memory mock list —
   the Users & Roles admin page hasn't been migrated to Supabase yet
   (that's a later phase). External customer/agent logins are governed
   inside their own records, not here (design §4).                  */

import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import type { Role } from '../lib/types'
import type { Access, ModuleKey, Override } from '../lib/rbac'

export type UserStatus = 'Active' | 'Pending' | 'Invited' | 'Suspended'

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

interface ProfileRow {
  id: string
  name: string
  email: string
  role: Role | null // null while Pending — no access until an Admin assigns one
  status: UserStatus
  mfa_enabled: boolean
  created_at: string
}

/** A real signed-in AppUser only exists once an Admin has approved the
    account and assigned a role — otherwise the caller should be shown the
    pending/suspended screen instead (see `profileStatus` in the store). */
function rowToAppUser(row: ProfileRow): AppUser | null {
  if (row.status !== 'Active' || !row.role) return null
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    mfaEnabled: row.mfa_enabled,
    lastLogin: null,
    overrides: {},
  }
}

export interface PendingSignup {
  id: string
  name: string
  email: string
  createdAt: string
}

interface AuthState {
  users: AppUser[]
  viewAsRole: Role | null // admin-only "preview as" — never escalates
  audit: AuditEntry[]

  // Real session (Supabase Auth) — persisted across navigation/reload
  session: Session | null
  profile: AppUser | null
  /** Raw status of the signed-in row even when `profile` is null (Pending/Suspended) —
      lets the UI show "waiting for approval" instead of bouncing back to sign-in. */
  profileStatus: UserStatus | null
  authLoading: boolean
  authError: string | null
  /** True after the user clicks a password-reset email link (Supabase fires a
      PASSWORD_RECOVERY event). While true the app shows the "set new password"
      screen instead of the normal shell, even though a session now exists. */
  recoveryMode: boolean

  initAuth: () => void
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  setViewAs: (role: Role | null) => void

  // Password reset / change (Supabase Auth)
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
  clearRecoveryMode: () => void

  // Real Admin approval queue (Supabase-backed) — every other admin action
  // below this still runs on the in-memory mock directory, see note above.
  pendingSignups: PendingSignup[]
  fetchPendingSignups: () => Promise<void>
  approveSignup: (userId: string, role: Role) => Promise<void>
  rejectSignup: (userId: string) => Promise<void>

  // Admin actions — still on the in-memory mock directory (Users & Roles
  // page migration is a later phase); real signed-in users aren't in `users`.
  assignRole: (userId: string, role: Role) => void
  setOverride: (userId: string, key: ModuleKey, access: Access | 'inherit') => void
  setStatus: (userId: string, status: UserStatus) => void
  inviteUser: (input: { name: string; email: string; role: Role }) => void
  removeUser: (userId: string) => void
}

function logAudit(list: AuditEntry[], actor: string, action: string): AuditEntry[] {
  return [{ id: uid(), at: now(), actor, action }, ...list]
}

async function fetchProfileRow(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error || !data) return null
  return data as ProfileRow
}

export const useAuthStore = create<AuthState>((set, get) => ({
  users: seedUsers,
  viewAsRole: null,
  audit: [
    { id: 'a0', at: '2026-07-01T09:00:00Z', actor: 'System', action: 'RBAC initialised — 8 roles, 10 staff/external logins seeded' },
  ],

  session: null,
  profile: null,
  profileStatus: null,
  authLoading: true,
  authError: null,
  recoveryMode: false,
  pendingSignups: [],

  initAuth: () => {
    const applyRow = (row: ProfileRow | null) =>
      set({ profile: row ? rowToAppUser(row) : null, profileStatus: row?.status ?? null })

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const row = session ? await fetchProfileRow(session.user.id) : null
      applyRow(row)
      set({ session, authLoading: false })
    })

    supabase.auth.onAuthStateChange((event, session) => {
      // Arriving via a reset-email link: show the set-new-password screen
      // rather than dropping the user straight into the app.
      if (event === 'PASSWORD_RECOVERY') set({ recoveryMode: true })
      set({ session, authLoading: false })
      if (session) {
        fetchProfileRow(session.user.id).then(applyRow)
      } else {
        set({ profile: null, profileStatus: null, viewAsRole: null })
      }
    })
  },

  signIn: async (email, password) => {
    set({ authError: null })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      set({ authError: error.message })
      return { error: error.message }
    }
    return { error: null }
  },

  signUp: async (email, password, name) => {
    set({ authError: null })
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) {
      // The 10-account cap is enforced in the `handle_new_user` DB trigger
      // (supabase/migrations/0003_account_limit.sql); Supabase Auth wraps
      // trigger failures in a generic message rather than passing ours through.
      const msg = /account_limit_reached|database error saving new user/i.test(error.message)
        ? 'Account limit reached — this workspace allows a maximum of 10 accounts.'
        : error.message
      set({ authError: msg })
      return { error: msg }
    }
    return { error: null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, profile: null, profileStatus: null, viewAsRole: null, recoveryMode: false })
  },

  setViewAs: (role) => set({ viewAsRole: role }),

  // Emails a reset link. `redirectTo` must be an allowed URL in
  // Supabase → Authentication → URL Configuration (add localhost + the
  // deployed origin). Clicking the link returns here and fires
  // PASSWORD_RECOVERY, which flips `recoveryMode` on.
  sendPasswordReset: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    return { error: error ? error.message : null }
  },

  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error ? error.message : null }
  },

  clearRecoveryMode: () => set({ recoveryMode: false }),

  fetchPendingSignups: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'Pending')
      .order('created_at', { ascending: true })
    if (error || !data) return
    set({
      pendingSignups: (data as ProfileRow[]).map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        createdAt: r.created_at,
      })),
    })
  },

  approveSignup: async (userId, role) => {
    const pending = get().pendingSignups.find((p) => p.id === userId)
    const { error } = await supabase
      .from('profiles')
      .update({ role, status: 'Active' })
      .eq('id', userId)
    if (error) return
    const actor = get().profile?.name ?? 'Admin'
    set((s) => ({
      pendingSignups: s.pendingSignups.filter((p) => p.id !== userId),
      audit: pending
        ? logAudit(s.audit, actor, `Approved ${pending.name} (${pending.email}) as ${role}`)
        : s.audit,
    }))
  },

  rejectSignup: async (userId) => {
    const pending = get().pendingSignups.find((p) => p.id === userId)
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'Suspended' })
      .eq('id', userId)
    if (error) return
    const actor = get().profile?.name ?? 'Admin'
    set((s) => ({
      pendingSignups: s.pendingSignups.filter((p) => p.id !== userId),
      audit: pending
        ? logAudit(s.audit, actor, `Rejected signup ${pending.name} (${pending.email})`)
        : s.audit,
    }))
  },

  assignRole: (userId, role) =>
    set((s) => {
      const u = s.users.find((x) => x.id === userId)
      const actor = get().profile?.name ?? 'Admin'
      if (!u || u.role === role) return s
      return {
        users: s.users.map((x) => (x.id === userId ? { ...x, role } : x)),
        audit: logAudit(s.audit, actor, `Role changed for ${u.name}: ${u.role} → ${role}`),
      }
    }),

  setOverride: (userId, key, access) =>
    set((s) => {
      const u = s.users.find((x) => x.id === userId)
      const actor = get().profile?.name ?? 'Admin'
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
      const actor = get().profile?.name ?? 'Admin'
      if (!u) return s
      return {
        users: s.users.map((x) => (x.id === userId ? { ...x, status } : x)),
        audit: logAudit(s.audit, actor, `${u.name} set to ${status}`),
      }
    }),

  inviteUser: (input) =>
    set((s) => {
      const actor = get().profile?.name ?? 'Admin'
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
      const actor = get().profile?.name ?? 'Admin'
      if (!u) return s
      return {
        users: s.users.filter((x) => x.id !== userId),
        audit: logAudit(s.audit, actor, `Removed login for ${u.name} — access revoked, history retained`),
      }
    }),
}))

/** The real signed-in user (Supabase session), or null while checking / signed out. */
export function useCurrentUser(): AppUser | null {
  return useAuthStore((s) => s.profile)
}
