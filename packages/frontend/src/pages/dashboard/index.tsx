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
import { Plus, FolderOpen, Clock, CheckCircle, TrendingUp, AlertCircle, Search, UserCog, Package, Printer, Scissors, Send } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  ALINHADORES: 'Alinhadores',
  FINALIZACAO: 'Contenção',
  PLACA_MIORRELAXANTE: 'Placa Miorrelaxante',
  EA_AIR2: 'EA Air²',
}

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'day', label: 'Hoje' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mês' },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value)
}

export default function DashboardPage() {
  const { user, setAuth } = useAuthStore()
  const navigate = useNavigate()
  const [dentistSearch, setDentistSearch] = useState('')
  const [caseSearch, setCaseSearch] = useState('')
  const [showImpersonate, setShowImpersonate] = useState(false)
  const [period, setPeriod] = useState('all')

  const { data: casesData } = useQuery({
    queryKey: ['cases-summary'],
    queryFn: () => api.get('/cases?limit=200').then(r => r.data),
  })

  const { data: adminStats } = useQuery({
    queryKey: ['admin-stats', period],
    queryFn: () => api.get(`/admin/stats${period !== 'all' ? `?period=${period}` : ''}`).then(r => r.data),
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
  const recentCases = cases.slice(0, 5)
  const total = casesData?.total || 0

  const resolveCaseStatus = (item: any) => {
    if (item?.status && item.status !== 'DRAFT') return item.status
    const stage = item?.workflowEvents?.[0]?.stage
    const stageMap: Record<number, string> = {
      1: 'IN_PLANNING',
      2: 'IN_PLANNING',
      3: 'IN_MOVEMENT',
      4: 'LAB_APPROVAL',
      5: 'WAITING_APPROVAL',
      6: 'APPROVED',
      7: 'PRINTING_3D',
      8: 'LABORATORY',
      9: 'EXPEDITION',
    }
    return stageMap[Number(stage)] || item?.status || 'DRAFT'
  }

  const statusCount = (key: string) =>
    user?.role === 'ADMIN'
      ? (adminStats?.casesByStatus?.find((s: any) => s.status === key)?._count?._all || 0)
      : cases.filter((item: any) => resolveCaseStatus(item) === key).length

  const stats = [
    { label: 'Total de Pacientes',        value: user?.role === 'ADMIN' ? (adminStats?.totalPatients || 0) : total, icon: FolderOpen, color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'A Preparar',               value: statusCount('IN_PLANNING'),       icon: Clock,       color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'A Movimentar',             value: statusCount('IN_MOVEMENT'),        icon: Package,     color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Aguardando Aprovação',     value: statusCount('WAITING_APPROVAL'),   icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Em Impressão',             value: statusCount('PRINTING_3D'),        icon: Printer,     color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Em Recorte',               value: statusCount('LABORATORY'),         icon: Scissors,    color: 'text-pink-600',   bg: 'bg-pink-50' },
    { label: 'Em Postagem',              value: statusCount('EXPEDITION'),         icon: Send,        color: 'text-green-600',  bg: 'bg-green-50' },
  ]

  const billingStats = user?.role === 'ADMIN'
    ? [
        { label: 'Casos Faturados', value: adminStats?.billedCases || 0 },
        { label: 'Valor Faturado', value: formatCurrency(adminStats?.billedAmount || 0) },
      ]
    : []

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
            <Link to="/patients/new">
              <Button className="gap-2"><Plus className="w-4 h-4" /> Novo Paciente</Button>
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

      <div className="flex items-center gap-2 flex-wrap">
        {PERIOD_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              period === opt.value
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex flex-col gap-2">
                <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground leading-tight">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {billingStats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {billingStats.map((item) => (
            <Card key={item.label}>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">{item.label}</p>
                <p className="text-3xl font-bold text-gray-900">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
              <Link key={c.id} to={`/patients/${c.patientId}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  #{c.caseNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{c.patientName}</p>
                  <p className="text-xs text-gray-400">{c.dentist?.name} {c.dentist?.clinic ? `· ${c.dentist.clinic}` : ''}</p>
                </div>
                <StatusBadge status={resolveCaseStatus(c)} />
              </Link>
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Pacientes Recentes</CardTitle>
          <Link to="/patients">
            <Button variant="ghost" size="sm" className="text-primary gap-1">
              <TrendingUp className="w-4 h-4" /> Ver todos
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {recentCases.length === 0 && (
              <div className="py-10 text-center text-muted-foreground">
                <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum paciente encontrado</p>
                {user?.role === 'DENTIST' && (
                  <Link to="/patients/new">
                    <Button size="sm" variant="outline" className="mt-3 gap-1"><Plus className="w-3 h-3" /> Criar primeiro paciente</Button>
                  </Link>
                )}
              </div>
            )}
            {recentCases.map((c: any) => {
              const treatmentLabel = c.productType
                ? (PRODUCT_TYPE_LABELS[c.productType] || c.service?.name)
                : c.service?.name
              return (
                <Link key={c.id} to={`/patients/${c.patientId}`} className="flex items-center gap-4 py-3.5 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-xs shrink-0">
                    #{c.caseNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-sm truncate">{c.patientName}</p>
                      {treatmentLabel && (
                        <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[11px] font-medium shrink-0">
                          {treatmentLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{c.dentist?.clinic || c.dentist?.name} · {formatDate(c.createdAt)}</p>
                  </div>
                  <StatusBadge status={resolveCaseStatus(c)} />
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
