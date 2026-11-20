import { Outlet } from 'react-router-dom'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { useUiStore } from '@/store/ui'
import { AceiteTermos } from '@/components/lgpd/aceite-termos'
import { useLogoutPorInatividade } from '@/hooks/use-inatividade'

export default function AppLayout() {
  const sidebarHidden = useUiStore(s => s.sidebarHidden)
  useLogoutPorInatividade(30)
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AceiteTermos />
      {!sidebarHidden && <Sidebar />}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
