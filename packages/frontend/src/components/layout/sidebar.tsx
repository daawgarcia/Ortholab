import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import {
  LayoutDashboard, FolderOpen, DollarSign,
  Users, Settings, Package, Bell, Wrench, Grid3X3,
  Briefcase, ExternalLink, ChevronRight, ChevronDown,
  FlaskConical, Printer, Beaker, Send, UserCircle,
  CreditCard, BookOpen, Radio, PlaySquare, FileText, Video, MessageCircle
} from 'lucide-react'

const WORKFLOW_ROLES = ['LAB_TECH', 'ADMIN', 'FINANCIAL']
const PATIENT_ROLES = ['DENTIST', 'LAB_TECH', 'ADMIN', 'FINANCIAL', 'SELLER']

const workflowItems = [
  { label: 'Planning Center', href: '/workflow/planning-center', icon: FlaskConical },
  { label: 'Impressão 3D', href: '/workflow/printing', icon: Printer },
  { label: 'Recorte', href: '/workflow/laboratory', icon: Beaker },
  { label: 'Expedição', href: '/workflow/expedition', icon: Send },
  { label: 'Financeiro', href: '/financial', icon: DollarSign },
]

const dentistItems = [
  { label: 'Financeiro', href: '/dentist-financial', icon: CreditCard },
  { label: 'Preços e Serviços', href: '/prices-rules', icon: BookOpen },
  { label: 'Vídeo Aulas', href: '/video-aulas', icon: Video },
  { label: 'Webinars', href: '/webinars', icon: Radio },
]

const adminNav = [
  { label: 'Usuários', href: '/admin/users', icon: Users },
  { label: 'Gestão de Carteira', href: '/admin/seller-clients', icon: Briefcase },
  { label: 'Serviços e Preços', href: '/admin/services', icon: Package },
  { label: 'Pagamentos PIX', href: '/admin/pix-payments', icon: CreditCard },
  { label: 'Cupons', href: '/admin/coupons', icon: CreditCard },
  { label: 'Conteúdo', href: '/admin/content', icon: FileText },
  { label: 'Vídeos', href: '/admin/videos', icon: PlaySquare },
  { label: 'Push / Avisos', href: '/admin/push', icon: Bell },
  { label: 'Módulos', href: '/admin/modules', icon: Grid3X3 },
  { label: 'Configurações', href: '/admin/settings', icon: Settings },
]

export function Sidebar() {
  const { user } = useAuthStore()
  const { pathname } = useLocation()
  const [workflowOpen, setWorkflowOpen] = useState(
    pathname.startsWith('/workflow') || pathname.startsWith('/financial')
  )
  const [dentistOpen, setDentistOpen] = useState(
    dentistItems.some(i => pathname.startsWith(i.href))
  )

  const { data: modulesData } = useQuery({
    queryKey: ['app-modules'],
    queryFn: () => api.get('/modules').then(r => r.data.modules),
    enabled: !!user,
  })

  const isAdmin = user?.role === 'ADMIN'
  const isDentist = user?.role === 'DENTIST'
  const isSeller = user?.role === 'SELLER'
  const isFinancial = user?.role === 'FINANCIAL'
  const showWorkflow = WORKFLOW_ROLES.includes(user?.role || '')
  const showPatients = PATIENT_ROLES.includes(user?.role || '')

  const isActive = (href: string) => href === '/'
    ? pathname === '/'
    : pathname.startsWith(href)

  return (
    <aside className="sidebar-gradient w-64 flex flex-col h-full text-white shrink-0">
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src="/logo-ea.png" alt="Esthetic Aligner" className="h-9 w-auto" />
        </div>
        <p className="text-white/40 text-xs mt-2 pl-0.5">Ortholab</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <NavItem href="/" icon={LayoutDashboard} label="Dashboard" active={isActive('/')} />

        {showPatients && (
          <NavItem href="/patients" icon={UserCircle} label="Pacientes" active={isActive('/patients')} />
        )}

        {isAdmin && (
          <NavItem href="/dentists" icon={Users} label="Dentistas" active={isActive('/dentists')} />
        )}

        {(isSeller || isDentist || isAdmin || isFinancial) && (
          <NavItem href="/chat" icon={MessageCircle} label="Chat" active={isActive('/chat')} />
        )}

        {isSeller && (
          <NavItem href="/seller" icon={Briefcase} label="Carteira" active={isActive('/seller')} />
        )}

        {isDentist && (
          <>
            <button
              onClick={() => setDentistOpen(o => !o)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">Minha Área</span>
              {dentistOpen
                ? <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                : <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
            </button>
            {dentistOpen && (
              <div className="ml-3 space-y-0.5 border-l border-white/10 pl-3">
                {dentistItems.map(item => (
                  <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={isActive(item.href)} small />
                ))}
              </div>
            )}
          </>
        )}

        {showWorkflow && (
          <>
            <button
              onClick={() => setWorkflowOpen(o => !o)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all"
            >
              <Grid3X3 className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">Workflow</span>
              {workflowOpen
                ? <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                : <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
            </button>
            {workflowOpen && (
              <div className="ml-3 space-y-0.5 border-l border-white/10 pl-3">
                {workflowItems.map(item => {
                  if (item.href === '/financial' && user?.role !== 'ADMIN' && user?.role !== 'FINANCIAL') return null
                  return (
                    <NavItem
                      key={item.href}
                      href={item.href}
                      icon={item.icon}
                      label={item.label}
                      active={isActive(item.href)}
                      small
                    />
                  )
                })}
              </div>
            )}
          </>
        )}

        {(isAdmin || isSeller) && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-white/30 text-xs uppercase tracking-wider font-medium">
                {isAdmin ? 'Administração' : 'Vendedor'}
              </p>
            </div>
            {(isAdmin ? adminNav : [{ label: 'Push / Avisos', href: '/admin/push', icon: Bell }]).map(item => (
              <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={isActive(item.href)} />
            ))}
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

function NavItem({ href, icon: Icon, label, active, small }: {
  href: string; icon: any; label: string; active: boolean; small?: boolean
}) {
  return (
    <Link to={href}
      className={cn(
        'flex items-center gap-3 px-3 rounded-lg text-sm transition-all',
        small ? 'py-2' : 'py-2.5',
        active ? 'bg-white/15 text-white font-medium' : 'text-white/70 hover:bg-white/10 hover:text-white'
      )}>
      <Icon className={cn('shrink-0', small ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
      {label}
      {active && !small && <ChevronRight className="w-3 h-3 ml-auto" />}
    </Link>
  )
}
