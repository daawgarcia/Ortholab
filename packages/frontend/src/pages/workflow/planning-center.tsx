import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { FileDown, Search, ChevronRight, Clock, Loader2 } from 'lucide-react'

const COLUMNS = [
  { key: 'IN_PLANNING', label: 'Casos a preparar', accent: 'bg-sky-500' },
  { key: 'IN_MOVEMENT', label: 'Casos a movimentar', accent: 'bg-indigo-500' },
  { key: 'LAB_APPROVAL', label: 'A aprovar (resp. lab.)', accent: 'bg-violet-500' },
  { key: 'WAITING_APPROVAL', label: 'Aguardando aprovação do dentista', accent: 'bg-amber-500' },
  { key: 'REVISION_REQUESTED', label: 'Alteração solicitada pelo dentista', accent: 'bg-rose-500' },
]

function diasDesde(d: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000))
}

function badgeDias(dias: number) {
  if (dias >= 15) return 'bg-rose-50 text-rose-700 ring-rose-200'
  if (dias >= 7) return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-gray-50 text-gray-600 ring-gray-200'
}

export default function PlanningCenterPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const podeAvancar = !!user && user.role !== 'DENTIST'

  const advanceMutation = useMutation({
    mutationFn: (caseId: string) => api.post(`/workflow/case/${caseId}/advance`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-center'] })
      qc.invalidateQueries({ queryKey: ['cases'] })
      qc.invalidateQueries({ queryKey: ['case'] })
      toast({ title: 'Caso avançado', description: 'Status do caso atualizado.' })
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Erro ao avançar caso', description: error?.response?.data?.error || 'Não foi possível avançar o caso' })
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['planning-center', 'all'],
    queryFn: async () => {
      const results = await Promise.all(
        COLUMNS.map(col =>
          api.get(`/cases?status=${col.key}&limit=500`).then(r => ({ key: col.key, cases: r.data.cases || [], total: r.data.total }))
        )
      )
      return results.reduce((acc, cur) => {
        // mais antigo primeiro: quem está esperando há mais tempo aparece no topo
        acc[cur.key] = [...cur.cases].sort(
          (a: any, b: any) => new Date(a.updatedAt || a.createdAt).getTime() - new Date(b.updatedAt || b.createdAt).getTime()
        )
        return acc
      }, {} as Record<string, any[]>)
    },
  })

  const filtrado = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo || !data) return data
    const out: Record<string, any[]> = {}
    for (const k of Object.keys(data)) {
      out[k] = data[k].filter((c: any) =>
        [c.patientName, c.dentist?.name, c.dentist?.clinic, String(c.caseNumber), c.patient?.boxNumber]
          .filter(Boolean)
          .some((v: string) => v.toLowerCase().includes(termo))
      )
    }
    return out
  }, [data, busca])

  const exportExcel = async () => {
    const res = await api.get(`/export/cases`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `planning-center.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalGeral = data ? Object.values(data).reduce((s, l) => s + l.length, 0) : 0

  return (
    <div className="p-6 space-y-5 h-full flex flex-col">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Planning Center</h1>
          <p className="text-sm text-gray-500">
            {isLoading ? 'Carregando casos…' : `${totalGeral} casos em planejamento • mais antigos no topo`}
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar paciente, dentista, nº do caso ou caixa"
            className="h-9 w-80 rounded-md border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <Button variant="outline" size="sm" onClick={exportExcel} className="gap-2">
          <FileDown className="w-4 h-4" />
          Exportar Excel
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto">
        <div className="grid grid-flow-col auto-cols-[minmax(270px,1fr)] gap-4 h-full min-w-max lg:min-w-0">
          {COLUMNS.map(col => {
            const lista = filtrado?.[col.key] || []
            return (
              <section key={col.key} className="flex flex-col min-h-0 rounded-xl bg-gray-50 ring-1 ring-gray-200">
                <header className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
                  <span className={`h-2 w-2 rounded-full ${col.accent}`} />
                  <h2 className="text-sm font-semibold text-gray-800 leading-tight">{col.label}</h2>
                  <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                    {isLoading ? '…' : lista.length}
                  </span>
                </header>

                <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-220px)]">
                  {isLoading && (
                    <div className="py-10 flex justify-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
                  )}
                  {!isLoading && lista.length === 0 && (
                    <div className="py-10 text-center text-sm text-gray-400">Nenhum caso</div>
                  )}
                  {!isLoading && lista.map((c: any) => {
                    const dias = diasDesde(c.updatedAt || c.createdAt)
                    return (
                      <article
                        key={c.id}
                        className="group rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200 hover:ring-primary/40 hover:shadow transition"
                      >
                        <button onClick={() => navigate(`/cases/${c.id}`)} className="w-full text-left space-y-1.5">
                          <div className="flex items-start gap-2">
                            <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{c.patientName}</p>
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary ml-auto shrink-0 mt-0.5" />
                          </div>
                          <p className="text-xs text-gray-600 truncate" title={c.dentist?.name}>
                            {c.dentist?.name || 'Dentista não informado'}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700">
                              Caso {String(c.caseNumber).padStart(6, '0')}
                            </span>
                            {c.patient?.boxNumber && (
                              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700">
                                Cx {c.patient.boxNumber}
                              </span>
                            )}
                            <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1 ${badgeDias(dias)}`}
                              title={`Desde ${new Date(c.updatedAt || c.createdAt).toLocaleDateString('pt-BR')}`}>
                              <Clock className="w-3 h-3" />
                              {dias === 0 ? 'hoje' : `${dias}d`}
                            </span>
                          </div>
                        </button>
                        {podeAvancar && (
                          <div className="mt-2 pt-2 border-t border-gray-100 flex justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-primary"
                              onClick={() => advanceMutation.mutate(c.id)}
                              disabled={advanceMutation.isPending}
                            >
                              Avançar etapa
                            </Button>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
