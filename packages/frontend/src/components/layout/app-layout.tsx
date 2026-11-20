import { Outlet } from 'react-router-dom'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { useUiStore } from '@/store/ui'
import { AceiteTermos } from '@/components/lgpd/aceite-termos'
import { AlertaAprovacao } from './alerta-aprovacao'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { AplicarIdioma } from './seletor-idioma'

export default function AppLayout() {
  const sidebarHidden = useUiStore(s => s.sidebarHidden)
  const updateUser = useAuthStore(s => s.updateUser)
  // mantém país, países liberados e idioma sempre atualizados (o admin pode mudar a qualquer momento)
  const { data: me } = useQuery({ queryKey: ['auth-me'], queryFn: () => api.get('/auth/me').then(r => r.data.user), staleTime: 60_000 })
  useEffect(() => {
    if (me) updateUser({ pais: me.pais, paises: me.paises, idioma: me.idioma, name: me.name, role: me.role })
  }, [me, updateUser])
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AplicarIdioma />
      <AceiteTermos />
      {!sidebarHidden && <Sidebar />}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <AlertaAprovacao />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
