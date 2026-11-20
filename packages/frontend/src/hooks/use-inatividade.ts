import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth'

/**
 * Segurança/LGPD: encerra a sessão da EQUIPE após um período sem uso
 * (computadores compartilhados no laboratório). Dentistas não são afetados.
 */
export function useLogoutPorInatividade(minutos = 30) {
  const { user, logout } = useAuthStore()
  useEffect(() => {
    if (!user || user.role === 'DENTIST') return
    let timer: ReturnType<typeof setTimeout>
    const reiniciar = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        logout()
        window.location.href = '/login?motivo=inatividade'
      }, minutos * 60_000)
    }
    const eventos = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    eventos.forEach(e => window.addEventListener(e, reiniciar, { passive: true }))
    reiniciar()
    return () => { clearTimeout(timer); eventos.forEach(e => window.removeEventListener(e, reiniciar)) }
  }, [user?.id, minutos, logout])
}
