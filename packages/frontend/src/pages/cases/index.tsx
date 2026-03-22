import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/status-badge'
import { formatDate } from '@/lib/utils'
import { Plus, Search, FolderOpen, Filter } from 'lucide-react'

const statuses = ['','DRAFT','SUBMITTED','IN_PLANNING','WAITING_APPROVAL','REVISION_REQUESTED','APPROVED','IN_PRODUCTION','SHIPPED','COMPLETED']
const statusLabels: Record<string, string> = {
  DRAFT: 'Rascunho',
  SUBMITTED: 'Submetido',
  IN_PLANNING: 'Em Planejamento',
  WAITING_APPROVAL: 'Aguard. Aprovação',
  REVISION_REQUESTED: 'Revisão Solicitada',
  APPROVED: 'Aprovado',
  IN_PRODUCTION: 'Em Produção',
  SHIPPED: 'Enviado',
  COMPLETED: 'Concluído',
}

export default function CasesPage() {
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['cases', search, status, page],
    queryFn: () => api.get(`/cases?search=${search}&status=${status}&page=${page}&limit=20`).then(r => r.data),
  })

  const cases = data?.cases || []
  const total = data?.total || 0
  const pages = Math.ceil(total / 20)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Casos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} caso{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</p>
        </div>
        {user?.role === 'DENTIST' && (
          <Link to="/cases/new"><Button className="gap-2"><Plus className="w-4 h-4" /> Novo Caso</Button></Link>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar paciente..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          {statuses.map(s => (
            <option key={s} value={s}>{s ? statusLabels[s] ?? s : 'Todos os status'}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : cases.length === 0 ? (
            <div className="py-16 text-center">
              <FolderOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhum caso encontrado</p>
            </div>
          ) : (
            <div className="divide-y">
              <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-gray-50 rounded-t-xl">
                <div className="col-span-1">#</div>
                <div className="col-span-3">Paciente</div>
                <div className="col-span-3">Dentista / Clínica</div>
                <div className="col-span-2">Serviço</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1">Data</div>
              </div>
              {cases.map((c: any) => (
                <Link key={c.id} to={`/cases/${c.id}`}
                  className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors items-center">
                  <div className="col-span-1 text-sm font-bold text-primary">#{c.caseNumber}</div>
                  <div className="col-span-3">
                    <p className="text-sm font-medium">{c.patientName}</p>
                    {c.isRefinement && <span className="text-xs text-orange-600 font-medium">Refinamento</span>}
                  </div>
                  <div className="col-span-3 text-sm text-muted-foreground">
                    <p>{c.dentist?.name}</p>
                    <p className="text-xs">{c.dentist?.clinic}</p>
                  </div>
                  <div className="col-span-2 text-sm text-muted-foreground">{c.service?.name || '-'}</div>
                  <div className="col-span-2"><StatusBadge status={c.status} /></div>
                  <div className="col-span-1 text-xs text-muted-foreground">{formatDate(c.createdAt)}</div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Anterior</Button>
          <span className="text-sm text-muted-foreground">Página {page} de {pages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>Próxima</Button>
        </div>
      )}
    </div>
  )
}
