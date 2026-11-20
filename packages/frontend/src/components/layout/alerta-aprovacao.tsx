import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

/** Como no Ortholab 1: o dentista vê em todas as telas um aviso dos casos aguardando a aprovação dele. */
export function AlertaAprovacao() {
  const { user } = useAuthStore()
  const { pathname } = useLocation()
  const { data } = useQuery({
    queryKey: ['aguardando-aprovacao'],
    queryFn: () => api.get('/cases?status=WAITING_APPROVAL&limit=50').then(r => r.data),
    enabled: user?.role === 'DENTIST',
    refetchInterval: 5 * 60_000,
  })
  const n = data?.cases?.length || 0
  if (user?.role !== 'DENTIST' || !n || pathname === '/') return null
  const nomes = data.cases.slice(0, 2).map((c: any) => c.patientName).join(', ')
  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="truncate">
        {n === 1 ? `O caso de ${nomes} está aguardando sua aprovação.` : `${n} casos aguardando sua aprovação (${nomes}${n > 2 ? '…' : ''}).`}
      </span>
      <Link to="/" className="ml-auto shrink-0 font-medium underline">Ver e aprovar</Link>
    </div>
  )
}
