import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

function WorkflowList({ title, status, subtitle }: { title: string; status: string; subtitle?: string }) {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['workflow', status],
    queryFn: () => api.get(`/cases?status=${status}&limit=200`).then(r => r.data),
  })
  const cases = data?.cases || []

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-gray-500 uppercase">{title}</h1>

      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="px-5 py-3 border-b bg-gray-50">
          <p className="text-sm font-semibold text-gray-700">{subtitle || `Casos - ${title}`}</p>
        </div>
        <div className="divide-y">
          {isLoading && <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>}
          {!isLoading && cases.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">Nenhum caso</div>
          )}
          {cases.map((c: any) => (
            <button
              key={c.id}
              onClick={() => navigate(`/cases/${c.id}`)}
              className="w-full px-5 py-3 flex items-center gap-4 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm text-primary font-medium hover:underline">
                {formatDate(c.createdAt)} | {c.patientName} : {String(c.caseNumber).padStart(6, '0')}
              </span>
              {c.dentist && (
                <span className="text-xs text-gray-400 ml-auto">{c.dentist.name}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function PrintingPage() {
  return <WorkflowList title="Impressão 3D (BR)" status="PRINTING_3D" subtitle="Casos a imprimir" />
}

export function LaboratoryPage() {
  return <WorkflowList title="Laboratório (BR)" status="LABORATORY" subtitle="Casos a confeccionar (Pressurização de placas, Recorte, Acabamento, Embalagem)" />
}

export function ExpeditionPage() {
  return <WorkflowList title="Expedição (BR)" status="EXPEDITION" subtitle="Casos a enviar" />
}
