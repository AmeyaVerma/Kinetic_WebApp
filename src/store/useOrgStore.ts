import { create } from 'zustand'

/* ── Organization profile (workspace-level settings) ─────────────
   Local-only for now (localStorage), same pattern as useUiStore's
   theme persistence — there's no `organizations` table yet (Phase 2
   backend migration hasn't started). NOT yet wired to app branding:
   Sidebar/LoginPage/ResetPasswordPage/ExternalPortal still hardcode
   "KINETIC LINE" as literal text. Swapping those to read from here is
   a deliberate follow-up, not done in this pass — ask before doing it,
   since it touches branding across four files.                      */

export interface OrgProfile {
  name: string
  defaultCurrency: 'USD' | 'INR'
  taxId: string
  address: string
}

interface OrgState extends OrgProfile {
  setOrgProfile: (patch: Partial<OrgProfile>) => void
}

const STORAGE_KEY = 'kl-org-profile'

const defaults: OrgProfile = {
  name: 'Kinetic Line',
  defaultCurrency: 'INR',
  taxId: '',
  address: '',
}

function loadInitial(): OrgProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    return { ...defaults, ...JSON.parse(raw) }
  } catch {
    return defaults
  }
}

export const useOrgStore = create<OrgState>((set, get) => ({
  ...loadInitial(),
  setOrgProfile: (patch) => {
    const next: OrgProfile = {
      name: get().name,
      defaultCurrency: get().defaultCurrency,
      taxId: get().taxId,
      address: get().address,
      ...patch,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    set(next)
  },
}))
