import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { FileDown } from 'lucide-react'

const TABS = [
  { key: 'IN_PLANNING', label: 'Casos a preparar' },
  { key: 'IN_MOVEMENT', label: 'Casos a movimentar' },
  { key: 'LAB_APPROVAL', label: 'Casos a aprovar resp. lab.' },
  { key: 'WAITING_APPROVAL', label: 'Aguardando aprovação' },
  { key: 'REVISION_REQUESTED', label: 'Casos a alterar (Solicitação dentista)' },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function PlanningCenterPage() {
  const [activeTab, setActiveTab] = useState(TABS[0].key)
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['planning-center', activeTab],
    queryFn: () => api.get(`/cases?status=${activeTab}&limit=200`).then(r => r.data),
  })

  const cases = data?.cases || []

  const exportExcel = async () => {
    const res = await api.get(`/export/cases?status=${activeTab}`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `planning-center-${activeTab}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-500 uppercase">Planning Center</h1>
        <Button variant="outline" size="sm" onClick={exportExcel} className="gap-2">
          <FileDown className="w-4 h-4" />
          Exportar Excel
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="flex border-b overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.key
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="divide-y">
          {isLoading && (
            <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
          )}
          {!isLoading && cases.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">Nenhum caso nesta aba</div>
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
                <span className="text-xs text-gray-400 ml-auto">{c.dentist.name} {c.dentist.clinic ? `• ${c.dentist.clinic}` : ''}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
