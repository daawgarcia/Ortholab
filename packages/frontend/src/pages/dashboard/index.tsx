import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Plus, FolderOpen, Clock, CheckCircle, TrendingUp, AlertCircle, Search, UserCog } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export default function DashboardPage() {
  const { user, setAuth } = useAuthStore()
  const navigate = useNavigate()
  const [dentistSearch, setDentistSearch] = useState('')
  const [caseSearch, setCaseSearch] = useState('')
  const [showImpersonate, setShowImpersonate] = useState(false)

  const { data: casesData } = useQuery({
    queryKey: ['cases-summary'],
    queryFn: () => api.get('/cases?limit=5').then(r => r.data),
  })

  const { data: adminStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data),
    enabled: user?.role === 'ADMIN',
  })

  const { data: dentistResults } = useQuery({
    queryKey: ['dentist-search', dentistSearch],
    queryFn: () => api.get(`/admin/dentists?search=${dentistSearch}`).then(r => r.data),
    enabled: user?.role === 'ADMIN' && dentistSearch.length >= 2,
    staleTime: 30000,
  })

  const { data: caseByNumber } = useQuery({
    queryKey: ['case-by-number', caseSearch],
    queryFn: () => api.get(`/cases?search=${caseSearch}&limit=5`).then(r => r.data),
    enabled: caseSearch.length >= 2,
    staleTime: 30000,
  })

  const impersonateMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/admin/impersonate/${userId}`).then(r => r.data),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.accessToken, [])
      toast({ title: `Acessando como ${data.user.name}`, description: 'Você está impersonando este usuário. Faça logout para retornar.' })
      setShowImpersonate(false)
      navigate('/')
    },
  })

  const cases = casesData?.cases || []
  const total = casesData?.total || 0

  const stats = [
    { label: 'Total de Casos', value: user?.role === 'ADMIN' ? (adminStats?.totalCases || 0) : total, icon: FolderOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Em Planejamento', value: adminStats?.casesByStatus?.find((s: any) => s.status === 'IN_PLANNING')?._count?._all || 0, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Aguard. Aprovação', value: adminStats?.casesByStatus?.find((s: any) => s.status === 'WAITING_APPROVAL')?._count?._all || 0, icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: user?.role === 'ADMIN' ? 'Cadastros Pendentes' : 'Concluídos', value: user?.role === 'ADMIN' ? (adminStats?.pendingUsers || 0) : 0, icon: user?.role === 'ADMIN' ? AlertCircle : CheckCircle, color: user?.role === 'ADMIN' ? 'text-red-600' : 'text-green-600', bg: user?.role === 'ADMIN' ? 'bg-red-50' : 'bg-green-50' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Olá, {user?.name?.split(' ')[0]}!</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Aqui está um resumo do seu painel</p>
        </div>
        <div className="flex gap-2">
          {user?.role === 'ADMIN' && (
            <Button variant="outline" size="sm" onClick={() => setShowImpersonate(o => !o)} className="gap-2">
              <UserCog className="w-4 h-4" />
              Acessar como usuário
            </Button>
          )}
          {user?.role === 'DENTIST' && (
            <Link to="/cases/new">
              <Button className="gap-2"><Plus className="w-4 h-4" /> Novo Caso</Button>
            </Link>
          )}
        </div>
      </div>

      {showImpersonate && user?.role === 'ADMIN' && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium text-orange-800">Acessar como outro usuário (somente Admin)</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar dentista por nome, e-mail ou clínica..."
                value={dentistSearch}
                onChange={e => setDentistSearch(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
            {dentistResults?.dentists?.length > 0 && (
              <div className="border rounded-lg bg-white divide-y shadow-sm">
                {dentistResults.dentists.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-gray-400">{d.email} {d.clinic ? `· ${d.clinic}` : ''}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => impersonateMutation.mutate(d.id)}
                      disabled={impersonateMutation.isPending}>
                      Acessar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nº de caixa ou paciente..."
            value={caseSearch}
            onChange={e => setCaseSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {caseSearch && caseByNumber?.cases?.length > 0 && (
          <div className="lg:col-span-3 border rounded-lg bg-white shadow-sm divide-y">
            {caseByNumber.cases.map((c: any) => (
              <Link key={c.id} to={`/cases/${c.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  #{c.caseNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{c.patientName}</p>
                  <p className="text-xs text-gray-400">{c.dentist?.name} {c.dentist?.clinic ? `· ${c.dentist.clinic}` : ''}</p>
                </div>
                <StatusBadge status={c.status} />
              </Link>
            ))}
          </div>
        )}
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
