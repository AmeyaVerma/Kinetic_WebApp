import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface UiState {
  theme: Theme
  sidebarOpen: boolean // mobile drawer
  sidebarCollapsed: boolean // desktop collapse
  setTheme: (t: Theme) => void
  toggleSidebar: () => void
  closeSidebar: () => void
  toggleCollapsed: () => void
}

const applyTheme = (t: Theme) => {
  document.documentElement.classList.toggle('dark', t === 'dark')
  localStorage.setItem('kl-theme', t)
}

const initialTheme: Theme =
  (localStorage.getItem('kl-theme') as Theme | null) ?? 'light'
applyTheme(initialTheme)

export const useUiStore = create<UiState>((set) => ({
  theme: initialTheme,
  sidebarOpen: false,
  sidebarCollapsed: false,
  setTheme: (t) => {
    applyTheme(t)
    set({ theme: t })
  },
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
  toggleCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))
