import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import {
  LayoutDashboard, FolderOpen, FlaskConical, DollarSign,
  Users, Settings, Package, Bell, Wrench, Grid3X3,
  Briefcase, ExternalLink, ChevronRight
} from 'lucide-react'

const baseNav = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['DENTIST','LAB_TECH','ADMIN','FINANCIAL','SELLER'] },
  { label: 'Casos', href: '/cases', icon: FolderOpen, roles: ['DENTIST','LAB_TECH','ADMIN'] },
  { label: 'Planejamento', href: '/planning', icon: FlaskConical, roles: ['LAB_TECH','ADMIN'] },
  { label: 'Financeiro', href: '/financial', icon: DollarSign, roles: ['FINANCIAL','ADMIN'] },
  { label: 'Carteira', href: '/seller', icon: Briefcase, roles: ['SELLER'] },
]

const adminNav = [
  { label: 'Usuários', href: '/admin/users', icon: Users },
  { label: 'Serviços e Preços', href: '/admin/services', icon: Package },
  { label: 'Push / Avisos', href: '/admin/push', icon: Bell },
  { label: 'Módulos', href: '/admin/modules', icon: Grid3X3 },
  { label: 'Configurações', href: '/admin/settings', icon: Settings },
]

export function Sidebar() {
  const { user } = useAuthStore()
  const { pathname } = useLocation()

  const { data: modulesData } = useQuery({
    queryKey: ['app-modules'],
    queryFn: () => api.get('/modules').then(r => r.data.modules),
    enabled: !!user,
  })

  const navItems = baseNav.filter(i => i.roles.includes(user?.role || ''))
  const isAdmin = user?.role === 'ADMIN'
  const isSeller = user?.role === 'SELLER'

  return (
    <aside className="sidebar-gradient w-64 flex flex-col h-full text-white shrink-0">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">EA</div>
          <div>
            <p className="font-bold text-sm leading-tight">Ortholab</p>
            <p className="text-white/50 text-xs">Esthetic Aligner</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} to={item.href}
              className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                active ? 'bg-white/15 text-white font-medium' : 'text-white/70 hover:bg-white/10 hover:text-white')}>
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
              {active && <ChevronRight className="w-3 h-3 ml-auto" />}
            </Link>
          )
        })}

        {(isAdmin || isSeller) && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-white/30 text-xs uppercase tracking-wider font-medium">
                {isAdmin ? 'Administração' : 'Vendedor'}
              </p>
            </div>
            {(isAdmin ? adminNav : [{ label: 'Push / Avisos', href: '/admin/push', icon: Bell }]).map(item => {
              const active = pathname.startsWith(item.href)
              return (
                <Link key={item.href} to={item.href}
                  className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                    active ? 'bg-white/15 text-white font-medium' : 'text-white/70 hover:bg-white/10 hover:text-white')}>
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}

        {modulesData && modulesData.length > 0 && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-white/30 text-xs uppercase tracking-wider font-medium">Ferramentas</p>
            </div>
            {modulesData.map((mod: any) => (
              <a key={mod.id} href={mod.url} target={mod.openInNewTab ? '_blank' : '_self'} rel="noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all">
                <Grid3X3 className="w-4 h-4 shrink-0" />
                {mod.name}
                {mod.openInNewTab && <ExternalLink className="w-3 h-3 ml-auto opacity-50" />}
              </a>
            ))}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-white/10">
        <Link to="/profile" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-all">
          <div className="w-8 h-8 bg-primary/80 rounded-full flex items-center justify-center text-xs font-bold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-white/40 truncate">{user?.role}</p>
          </div>
          <Wrench className="w-3.5 h-3.5 text-white/40" />
        </Link>
      </div>
    </aside>
  )
}
