import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDebounce } from '@/hooks/use-debounce'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Plus, UserCircle } from 'lucide-react'

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  ALINHADORES: 'Alinhadores',
  FINALIZACAO: 'Contenção',
  PLACA_MIORRELAXANTE: 'EA Mio',
  EA_AIR2: 'EA Air²',
  EA_GUARD: 'EA Guard',
}

function getTreatmentLabel(patient: any) {
  const latestCase = patient?.cases?.[0]
  if (!latestCase) return ''
  if (latestCase.productType && PRODUCT_TYPE_LABELS[latestCase.productType]) return PRODUCT_TYPE_LABELS[latestCase.productType]
  return latestCase.service?.name || latestCase.service?.type || ''
}

export default function PatientsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('busca') || '')
  const termo = useDebounce(search.trim(), 300)
  useEffect(() => { const b = params.get('busca'); if (b !== null) setSearch(b) }, [params])
  const [dentistId, setDentistId] = useState(params.get('dentistId') || '')
  useEffect(() => { setDentistId(params.get('dentistId') || '') }, [params])
  const { data: dentistaAtual } = useQuery({
    queryKey: ['dentist-name', dentistId],
    queryFn: () => api.get(`/dentists/${dentistId}`).then(r => r.data),
    enabled: !!dentistId && !!params.get('dentistId'),
    staleTime: 300000,
  })
  const [dentistSearch, setDentistSearch] = useState('')
  const termoDentista = useDebounce(dentistSearch.trim(), 300)

  const POR_PAGINA = 50
  const [pagina, setPagina] = useState(1)
  useEffect(() => { setPagina(1) }, [termo, dentistId])
  const { data, isLoading } = useQuery({
    queryKey: ['patients', termo, dentistId, pagina],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (termo.length >= 2) qs.set('search', termo)
      if (dentistId) qs.set('dentistId', dentistId)
      qs.set('page', String(pagina))
      qs.set('limit', String(POR_PAGINA))
      return api.get(`/patients?${qs}`).then(r => r.data)
    },
    staleTime: 30000,
  })

  const { data: dentistsData } = useQuery({
    queryKey: ['dentists-select', termoDentista],
    queryFn: () => api.get(`/dentists?limit=30&search=${encodeURIComponent(termoDentista)}`).then(r => r.data),
    enabled: user?.role === 'ADMIN' || user?.role === 'LAB_TECH' || user?.role === 'FINANCIAL',
  })

  const patients = data?.patients || []

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          {params.get('dentistId') && dentistaAtual ? (
            <>
              <button onClick={() => navigate(`/dentists/${dentistId}`)} className="text-sm text-primary hover:underline">‹ Voltar para {dentistaAtual.name}</button>
              <h1 className="text-2xl font-bold text-gray-900">Pacientes de {dentistaAtual.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{data?.total ?? 0} paciente(s) deste dentista</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{data?.total ?? 0} paciente(s) cadastrado(s)</p>
            </>
          )}
        </div>
        <Button onClick={() => navigate('/patients/new')} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Paciente
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder={params.get('dentistId') ? 'Buscar entre os pacientes deste dentista: nome ou nº da caixa' : 'Nome do paciente, nº da caixa ou dentista (aceita erro de digitação)'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {!params.get('dentistId') && <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar dentista por nome..."
            value={dentistSearch}
            onChange={e => setDentistSearch(e.target.value)}
            className="pl-9"
          />
        </div>}
        {dentistsData?.dentists && !params.get('dentistId') && (
          <select
            value={dentistId}
            onChange={e => setDentistId(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm text-gray-700 bg-white min-w-[220px]"
          >
            <option value="">Todos os dentistas</option>
            {dentistsData.dentists.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name} {d.clinic ? `— ${d.clinic}` : ''}</option>
            ))}
          </select>
        )}
      </div>

      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 divide-y">
          <div className="contents">
            <div className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase bg-gray-50 col-span-4 grid grid-cols-[1fr_220px_60px] gap-4">
              <span>Nome</span>
              <span>Dentista</span>
              <span>Status</span>
            </div>
          </div>
          {isLoading && (
            <div className="px-5 py-8 text-center text-gray-400 text-sm col-span-4">Carregando...</div>
          )}
          {!isLoading && patients.length === 0 && (
            <div className="px-5 py-8 text-center text-gray-400 text-sm col-span-4">
              {search ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
            </div>
          )}
          {patients.map((p: any) => {
            const treatmentLabel = getTreatmentLabel(p)
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/patients/${p.id}`)}
                className="col-span-4 grid grid-cols-[1fr_220px_60px] gap-4 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors items-center"
              >
                <span className="flex items-center gap-2">
                  <UserCircle className="w-5 h-5 text-gray-300 shrink-0" />
                  <span className="font-medium text-gray-900 text-sm">{p.name}</span>
                  {treatmentLabel && (
                    <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[11px] font-medium">
                      {treatmentLabel}
                    </span>
                  )}
                  {['M', 'F', 'male', 'female'].includes(p.gender) && <span className="text-xs text-gray-400">{p.gender === 'M' || p.gender === 'male' ? 'Masc' : 'Fem'}</span>}
                </span>
                <span className="text-sm text-gray-500 truncate">{p.dentist?.name || '—'}</span>
                <span className={`text-xs font-medium ${p.active ? 'text-green-600' : 'text-gray-400'}`}>
                  {p.active ? 'Ativo' : 'Inativo'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      {(data?.total ?? 0) > POR_PAGINA && (() => {
        const totalPaginas = Math.ceil((data?.total ?? 0) / POR_PAGINA)
        return (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Página {pagina} de {totalPaginas} · {data?.total} paciente(s){params.get('dentistId') ? ' deste dentista' : ''}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => { setPagina(pagina - 1); window.scrollTo({ top: 0 }) }}>‹ Anterior</Button>
              <Button variant="outline" size="sm" disabled={pagina >= totalPaginas} onClick={() => { setPagina(pagina + 1); window.scrollTo({ top: 0 }) }}>Próxima ›</Button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
