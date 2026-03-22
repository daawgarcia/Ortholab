import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, RefreshCw } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export default function DentistsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dentists', search],
    queryFn: () => api.get(`/dentists?search=${search}&limit=50`).then(r => r.data),
    staleTime: 30000,
  })

  const syncTotvs = async () => {
    setSyncing(true)
    try {
      await api.post('/totvs/sync-dentists')
      toast({ title: 'Sincronização TOTVS concluída' })
      refetch()
    } catch {
      toast({ variant: 'destructive', title: 'Erro na sincronização TOTVS' })
    } finally {
      setSyncing(false)
    }
  }

  const dentists = data?.dentists || []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dentistas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{data?.total ?? 0} dentista(s) cadastrado(s)</p>
        </div>
        <Button variant="outline" onClick={syncTotvs} disabled={syncing} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          Sincronizar TOTVS
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Digite ao menos 2 caracteres, ou ** para listar tudo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_180px_120px_80px_60px] gap-0 divide-y">
          <div className="col-span-5 grid grid-cols-[1fr_180px_120px_80px_60px] gap-4 px-5 py-3 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
            <span>Dentista (CRO)</span>
            <span>E-mail</span>
            <span>Cidade / UF</span>
            <span>Pacientes</span>
            <span>Status</span>
          </div>
          {isLoading && (
            <div className="col-span-5 px-5 py-8 text-center text-gray-400 text-sm">Carregando...</div>
          )}
          {!isLoading && dentists.length === 0 && (
            <div className="col-span-5 px-5 py-8 text-center text-gray-400 text-sm">
              {search ? 'Nenhum dentista encontrado' : 'Digite para buscar dentistas'}
            </div>
          )}
          {dentists.map((d: any) => (
            <button
              key={d.id}
              onClick={() => navigate(`/dentists/${d.id}`)}
              className="col-span-5 grid grid-cols-[1fr_180px_120px_80px_60px] gap-4 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors items-center"
            >
              <span>
                <span className="font-medium text-sm text-gray-900">{d.clinic || d.name}</span>
                {d.cro && <span className="text-xs text-gray-400 ml-2">({d.cro})</span>}
              </span>
              <span className="text-xs text-gray-500 truncate">{d.email}</span>
              <span className="text-xs text-gray-500">
                {d.deliveryCity || d.city || '—'}{(d.deliveryState || d.state) ? ` / ${d.deliveryState || d.state}` : ''}
              </span>
              <span className="text-sm text-gray-600">{d._count?.patients ?? 0}</span>
              <span className={`text-xs font-medium ${d.status === 'ACTIVE' ? 'text-green-600' : 'text-yellow-600'}`}>
                {d.status === 'ACTIVE' ? 'Ativo' : 'Pendente'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
