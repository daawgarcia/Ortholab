import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

function WorkflowList({
  title,
  status,
  subtitle,
  advanceLabel,
  confirmMessage,
}: {
  title: string
  status: string
  subtitle?: string
  advanceLabel?: string
  confirmMessage?: string
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [advancing, setAdvancing] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['workflow', status],
    queryFn: () => api.get(`/cases?status=${status}&limit=200`).then(r => r.data),
  })
  const cases = data?.cases || []

  const advanceMutation = useMutation({
    mutationFn: (caseId: string) => api.post(`/workflow/case/${caseId}/advance`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow', status] })
      toast({ title: 'Caso avançado com sucesso' })
      setAdvancing(null)
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Erro', description: err?.response?.data?.error || 'Falha ao avançar caso' })
      setAdvancing(null)
    },
  })

  const handleAdvance = (caseId: string, caseLabel: string) => {
    const msg = confirmMessage ? confirmMessage.replace('{case}', caseLabel) : `Avançar "${caseLabel}"?`
    if (!window.confirm(msg)) return
    setAdvancing(caseId)
    advanceMutation.mutate(caseId)
  }

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
          {cases.map((c: any) => {
            const label = `${formatDate(c.createdAt)} | ${c.patientName} : ${String(c.caseNumber).padStart(6, '0')}`
            return (
              <div key={c.id} className="px-5 py-3 flex items-center gap-4">
                <button
                  onClick={() => navigate(`/cases/${c.id}`)}
                  className="text-sm text-primary font-medium hover:underline flex-1 text-left"
                >
                  {label}
                </button>
                {c.dentist && (
                  <span className="text-xs text-gray-400">{c.dentist.name}</span>
                )}
                {advanceLabel && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs shrink-0"
                    disabled={advancing === c.id}
                    onClick={() => handleAdvance(c.id, label)}
                  >
                    {advancing === c.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <ArrowRight className="w-3 h-3" />}
                    {advanceLabel}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function PrintingPage() {
  return (
    <WorkflowList
      title="Impressão 3D (BR)"
      status="PRINTING_3D"
      subtitle="Casos a imprimir"
      advanceLabel="Liberar para Laboratório"
      confirmMessage="Liberar {case} para o Laboratório?"
    />
  )
}

export function LaboratoryPage() {
  return (
    <WorkflowList
      title="Laboratório (BR)"
      status="LABORATORY"
      subtitle="Casos a confeccionar (Pressurização de placas, Recorte, Acabamento, Embalagem)"
      advanceLabel="Liberar para Expedição"
      confirmMessage="Liberar {case} para a Expedição?"
    />
  )
}

export function ExpeditionPage() {
  return (
    <WorkflowList
      title="Expedição (BR)"
      status="EXPEDITION"
      subtitle="Casos a enviar"
    />
  )
}
