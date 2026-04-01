import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Plus, UserCircle } from 'lucide-react'

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  ALINHADORES: 'Alinhadores',
  FINALIZACAO: 'Contenção',
  PLACA_MIORRELAXANTE: 'Placa Miorrelaxante',
  EA_AIR2: 'EA Air²',
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
  const [search, setSearch] = useState('')
  const [dentistId, setDentistId] = useState('')
  const [dentistSearch, setDentistSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['patients', search, dentistId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (dentistId) params.set('dentistId', dentistId)
      return api.get(`/patients?${params}`).then(r => r.data)
    },
    staleTime: 30000,
  })

  const { data: dentistsData } = useQuery({
    queryKey: ['dentists-select', dentistSearch],
    queryFn: () => api.get(`/admin/dentists?search=${encodeURIComponent(dentistSearch)}`).then(r => r.data),
    enabled: user?.role === 'ADMIN' || user?.role === 'LAB_TECH' || user?.role === 'FINANCIAL',
  })

  const patients = data?.patients || []

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{data?.total ?? 0} paciente(s) cadastrado(s)</p>
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
            placeholder="Buscar paciente por nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar dentista por nome..."
            value={dentistSearch}
            onChange={e => setDentistSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {dentistsData?.dentists && (
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
            <div className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase bg-gray-50 col-span-4 grid grid-cols-[1fr_150px_80px_60px] gap-4">
              <span>Nome</span>
              <span>Dentista</span>
              <span>Casos</span>
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
                className="col-span-4 grid grid-cols-[1fr_150px_80px_60px] gap-4 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors items-center"
              >
                <span className="flex items-center gap-2">
                  <UserCircle className="w-5 h-5 text-gray-300 shrink-0" />
                  <span className="font-medium text-gray-900 text-sm">{p.name}</span>
                  {treatmentLabel && (
                    <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[11px] font-medium">
                      {treatmentLabel}
                    </span>
                  )}
                  {p.gender && <span className="text-xs text-gray-400">{p.gender === 'M' ? 'Masc' : 'Fem'}</span>}
                </span>
                <span className="text-sm text-gray-500 truncate">{p.dentist?.name || '—'}</span>
                <span className="text-sm text-gray-500">{p._count?.cases ?? 0} caso(s)</span>
                <span className={`text-xs font-medium ${p.active ? 'text-green-600' : 'text-gray-400'}`}>
                  {p.active ? 'Ativo' : 'Inativo'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
