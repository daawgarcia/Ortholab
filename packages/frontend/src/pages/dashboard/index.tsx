import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Plus, FolderOpen, Clock, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuthStore()

  const { data: casesData } = useQuery({
    queryKey: ['cases-summary'],
    queryFn: () => api.get('/cases?limit=5').then(r => r.data),
  })

  const { data: adminStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data),
    enabled: user?.role === 'ADMIN',
  })

  const cases = casesData?.cases || []
  const total = casesData?.total || 0

  const statusGroups = cases.reduce((acc: any, c: any) => {
    acc[c.status] = (acc[c.status] || 0) + 1
    return acc
  }, {})

  const stats = [
    { label: 'Total de Casos', value: adminStats?.totalCases || total, icon: FolderOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Em Planejamento', value: statusGroups['IN_PLANNING'] || 0, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Aguard. Aprovação', value: statusGroups['WAITING_APPROVAL'] || 0, icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Concluídos', value: statusGroups['COMPLETED'] || 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
  ]

  if (user?.role === 'ADMIN') {
    stats[0].value = adminStats?.totalCases || 0
    stats[3].value = adminStats?.pendingUsers || 0
    stats[3].label = 'Cadastros Pendentes'
    stats[3].icon = AlertCircle
    stats[3].color = 'text-red-600'
    stats[3].bg = 'bg-red-50'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Olá, {user?.name?.split(' ')[0]}!</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Aqui está um resumo do seu painel</p>
        </div>
        {user?.role === 'DENTIST' && (
          <Link to="/cases/new">
            <Button className="gap-2"><Plus className="w-4 h-4" /> Novo Caso</Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-3xl font-bold mt-1">{s.value}</p>
                </div>
                <div className={`w-12 h-12 ${s.bg} rounded-xl flex items-center justify-center`}>
                  <s.icon className={`w-6 h-6 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Casos Recentes</CardTitle>
          <Link to="/cases">
            <Button variant="ghost" size="sm" className="text-primary gap-1">
              <TrendingUp className="w-4 h-4" /> Ver todos
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {cases.length === 0 && (
              <div className="py-10 text-center text-muted-foreground">
                <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum caso encontrado</p>
                {user?.role === 'DENTIST' && (
                  <Link to="/cases/new">
                    <Button size="sm" variant="outline" className="mt-3 gap-1"><Plus className="w-3 h-3" /> Criar primeiro caso</Button>
                  </Link>
                )}
              </div>
            )}
            {cases.map((c: any) => (
              <Link key={c.id} to={`/cases/${c.id}`} className="flex items-center gap-4 py-3.5 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  #{c.caseNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.patientName}</p>
                  <p className="text-xs text-muted-foreground">{c.dentist?.clinic || c.dentist?.name} · {formatDate(c.createdAt)}</p>
                </div>
                <StatusBadge status={c.status} />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
