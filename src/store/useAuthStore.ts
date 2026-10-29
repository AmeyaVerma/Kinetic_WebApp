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
  /** Which companies this person may open, and their role in each. */
  memberships?: { tenantId: string; tenantName: string; role: Role }[]
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

/* The Users screen used to list ten invented accounts with last-logins in
   July 2026, and omitted whoever was actually signed in (spec F12). The real
   roster now comes from `profiles` via fetchUsers(), so the seed list is
   gone rather than kept as a fallback -- a fallback here would just be the
   same fiction, shown when a query failed. */

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

/** A company the signed-in person belongs to, and their role there. A person
    can hold a different role in each — an Admin at Kinetic may be Finance at
    RKS — so the role travels with the membership, not the profile. */
export interface Company {
  id: string
  name: string
  role: Role
}

interface AuthState {
  users: AppUser[]
  /** Every company this person may open. Empty until the profile loads. */
  companies: Company[]
  /** The company whose data the whole session is scoped to. Null means the
      chooser has not been answered yet. */
  activeCompanyId: string | null
  companiesLoading: boolean
  loadCompanies: () => Promise<void>
  /** The real signed-up accounts, read from `profiles` with each person's
      company memberships. Replaces the ten invented rows the Users screen
      used to show (spec F12). */
  fetchUsers: () => Promise<void>
  usersLoading: boolean
  /** Grants or revokes a person's access to a company, with their role there.
      Siddharth: "admin can also choose who can login to which company." */
  setMembership: (userId: string, tenantId: string, role: Role | null) => Promise<void>
  /** Switches company for the session. Row-level security reads the same
      value from the database, so this is the real scope change, not a filter. */
  setActiveCompany: (companyId: string) => Promise<void>
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

  /** Total rows in `profiles` — the 10-account cap (0003_account_limit.sql)
      counts against this. Admin-only: RLS only lets admins select every row. */
  accountCount: number | null
  fetchAccountCount: () => Promise<void>

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
  users: [],
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
  accountCount: null,
  companies: [],
  activeCompanyId: null,
  companiesLoading: true,
  usersLoading: true,

  initAuth: () => {
    const applyRow = (row: ProfileRow | null) =>
      set({ profile: row ? rowToAppUser(row) : null, profileStatus: row?.status ?? null })

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const row = session ? await fetchProfileRow(session.user.id) : null
      applyRow(row)
      set({ session, authLoading: false })
      if (session) void get().loadCompanies()
      else set({ companies: [], activeCompanyId: null, companiesLoading: false })
    })

    supabase.auth.onAuthStateChange((event, session) => {
      // Arriving via a reset-email link: show the set-new-password screen
      // rather than dropping the user straight into the app.
      if (event === 'PASSWORD_RECOVERY') set({ recoveryMode: true })
      set({ session, authLoading: false })
      if (session) {
        fetchProfileRow(session.user.id).then(applyRow)
        void get().loadCompanies()
      } else {
        set({
          profile: null, profileStatus: null, viewAsRole: null,
          companies: [], activeCompanyId: null, companiesLoading: false,
        })
      }
    })
  },

  fetchUsers: async () => {
    const [profiles, memberships, tenants] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
      supabase.from('memberships').select('user_id, tenant_id, role'),
      supabase.from('tenants').select('id, name'),
    ])
    if (profiles.error || !profiles.data) {
      set({ usersLoading: false })
      return
    }
    const tenantName = new Map(
      ((tenants.data as { id: string; name: string }[]) ?? []).map((t) => [t.id, t.name]),
    )
    const byUser = new Map<string, { tenantId: string; tenantName: string; role: Role }[]>()
    for (const m of ((memberships.data as { user_id: string; tenant_id: string; role: Role }[]) ?? [])) {
      const list = byUser.get(m.user_id) ?? []
      list.push({ tenantId: m.tenant_id, tenantName: tenantName.get(m.tenant_id) ?? '—', role: m.role })
      byUser.set(m.user_id, list)
    }
    const rows = (profiles.data as ProfileRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      // A Pending account has no role yet; show it rather than hiding the row.
      role: (r.role ?? 'ops') as Role,
      status: r.status,
      mfaEnabled: r.mfa_enabled,
      lastLogin: null,
      overrides: {} as Override,
      memberships: (byUser.get(r.id) ?? []).sort((a, b) => a.tenantName.localeCompare(b.tenantName)),
    }))
    set({ users: rows, usersLoading: false })
  },

  setMembership: async (userId, tenantId, role) => {
    if (role === null) {
      const { error } = await supabase
        .from('memberships')
        .delete()
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
      if (error) {
        set({ authError: error.message })
        return
      }
    } else {
      const { error } = await supabase
        .from('memberships')
        .upsert({ user_id: userId, tenant_id: tenantId, role }, { onConflict: 'user_id,tenant_id' })
      if (error) {
        set({ authError: error.message })
        return
      }
    }
    await get().fetchUsers()
  },

  loadCompanies: async () => {
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth.user?.id
    if (!uid) {
      set({ companies: [], activeCompanyId: null, companiesLoading: false })
      return
    }
    const [memberships, profile] = await Promise.all([
      supabase.from('memberships').select('tenant_id, role, tenants(id, name)').eq('user_id', uid),
      supabase.from('profiles').select('active_tenant_id').eq('id', uid).single(),
    ])
    const rows = (memberships.data ?? []) as unknown as {
      tenant_id: string
      role: Role
      tenants: { id: string; name: string } | null
    }[]
    const companies: Company[] = rows
      .filter((r) => r.tenants)
      .map((r) => ({ id: r.tenant_id, name: r.tenants!.name, role: r.role }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const stored = (profile.data as { active_tenant_id: string | null } | null)?.active_tenant_id
    // Only one company means there is nothing to choose: go straight in.
    const active =
      companies.length === 1
        ? companies[0].id
        : companies.some((c) => c.id === stored)
          ? stored!
          : null
    set({ companies, activeCompanyId: active, companiesLoading: false })
  },

  setActiveCompany: async (companyId) => {
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth.user?.id
    if (!uid) return
    // The database is the one that matters: auth_tenant_id() reads this
    // column, and refuses a company the person is not a member of.
    const { error } = await supabase
      .from('profiles')
      .update({ active_tenant_id: companyId })
      .eq('id', uid)
    if (error) {
      set({ authError: error.message })
      return
    }
    set({ activeCompanyId: companyId, viewAsRole: null })

    /* Every store slice was loaded under the previous company. Clearing them
       one by one would be a list someone forgets to update, and a single
       stale booking shown under the wrong company is a GST problem, not a
       cosmetic one. So the session restarts outright. */
    if (typeof window !== 'undefined') window.location.assign('/')
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

  fetchAccountCount: async () => {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
    if (error) return
    set({ accountCount: count })
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
