import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'

/**
 * Hook para auto-renovar o token a cada 14 minutos
 * Refresh token válido por 7d, access token por 15m
 * Renewamos a cada 14m pra ter margem de segurança
 */
export function useTokenRefresh() {
  const { accessToken, refreshToken, setTokens, logout } = useAuthStore()
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!refreshToken || !accessToken) {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
      return
    }

    const refreshAccessToken = async () => {
      try {
        const { data } = await api.post('/auth/refresh', { refreshToken })
        setTokens(data.accessToken, refreshToken)
      } catch (error) {
        console.error('Token refresh failed:', error)
        logout()
        window.location.href = '/login'
      }
    }

    // Refresh a cada 14 minutos (840000 ms)
    const REFRESH_INTERVAL = 14 * 60 * 1000

    // Fazer o refresh no mount se a margem for pequena
    refreshAccessToken()

    // Agendar refreshes periódicos
    refreshIntervalRef.current = setInterval(refreshAccessToken, REFRESH_INTERVAL)

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    }
  }, [refreshToken, accessToken, setTokens, logout])
}
