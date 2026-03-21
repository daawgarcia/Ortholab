import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'DENTIST' | 'LAB_TECH' | 'ADMIN' | 'FINANCIAL' | 'SELLER'
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  pendingPushes: any[]
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string, pushes?: any[]) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  logout: () => void
  clearPushes: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      pendingPushes: [],
      setAuth: (user, accessToken, refreshToken, pushes = []) =>
        set({ user, accessToken, refreshToken, pendingPushes: pushes }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null, pendingPushes: [] }),
      clearPushes: () => set({ pendingPushes: [] }),
    }),
    { name: 'ortholab-auth' }
  )
)
