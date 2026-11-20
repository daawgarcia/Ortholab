import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiState {
  sidebarHidden: boolean
  setSidebarHidden: (v: boolean) => void
  toggleSidebar: () => void
}

// Preferência de menu lateral oculto/visível (fica salva no navegador)
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarHidden: false,
      setSidebarHidden: (v) => set({ sidebarHidden: v }),
      toggleSidebar: () => set((s) => ({ sidebarHidden: !s.sidebarHidden })),
    }),
    { name: 'ortholab-ui' }
  )
)
