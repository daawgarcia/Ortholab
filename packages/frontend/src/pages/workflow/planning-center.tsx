import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useUiStore } from '@/store/ui'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { FileDown, Search, Loader2, ArrowRight, RefreshCw } from 'lucide-react'
import { tomPlanning, CLASSE_TOM, SELO_TOM } from '@/lib/prazos'

// Mesmas 5 colunas do Planning Center do Ortholab 1
const COLUMNS = [
  { key: 'IN_PLANNING', label: 'Casos a preparar', dot: 'bg-sky-500', head: 'from-sky-50' },
  { key: 'IN_MOVEMENT', label: 'Casos a movimentar', dot: 'bg-indigo-500', head: 'from-indigo-50' },
  { key: 'LAB_APPROVAL', label: 'A aprovar resp. lab.', dot: 'bg-violet-500', head: 'from-violet-50' },
  { key: 'WAITING_APPROVAL', label: 'Aguardando aprovação', dot: 'bg-amber-500', head: 'from-amber-50' },
  { key: 'REVISION_REQUESTED', label: 'Casos a alterar', dot: 'bg-rose-500', head: 'from-rose-50' },
]

const dataEvento = (c: any) => c.updatedAt || c.createdAt

function diasDesde(d: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000))
}

function corDias(dias: number) {
  if (dias >= 15) return 'text-rose-600 bg-rose-50'
  if (dias >= 7) return 'text-amber-700 bg-amber-50'
  return 'text-gray-500 bg-gray-100'
}

export default function PlanningCenterPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const setSidebarHidden = useUiStore(s => s.setSidebarHidden)
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const isEquipe = !!user && user.role !== 'DENTIST'

  // Para a equipe, o Planning Center abre em tela cheia (menu oculto; dá para reabrir no topo)
  useEffect(() => {
    if (isEquipe) setSidebarHidden(true)
  }, [isEquipe, setSidebarHidden])

  // envio para aprovação: o laboratório informa séries e guias (conferidas com o PDF do planejamento)
  const [envio, setEnvio] = useState<any>(null)
  const advanceMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body?: any }) => api.post(`/workflow/case/${id}/advance`, body || {}),
    onSuccess: (r: any) => {
      setEnvio(null)
      if (r?.data?.avisoSeries) toast({ title: 'Enviado para aprovação', description: r.data.avisoSeries })
      qc.invalidateQueries({ queryKey: ['planning-center'] })
      qc.invalidateQueries({ queryKey: ['cases'] })
      toast({ title: 'Caso avançado para a próxima etapa' })
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Erro ao avançar caso', description: error?.response?.data?.error || 'Tente novamente' })
    },
  })

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['planning-center', 'all'],
    queryFn: async () => {
      const results = await Promise.all(
        COLUMNS.map(col => api.get(`/cases?status=${col.key}&limit=1000`).then(r => ({ key: col.key, cases: r.data.cases || [] })))
      )
      return results.reduce((acc, cur) => {
        // como no Ortholab 1: ordenado pela data do último evento (mais antigo no topo)
        acc[cur.key] = [...cur.cases].sort((a: any, b: any) => new Date(dataEvento(a)).getTime() - new Date(dataEvento(b)).getTime())
        return acc
      }, {} as Record<string, any[]>)
    },
    refetchInterval: 60_000,
  })

  const filtrado = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo || !data) return data
    const out: Record<string, any[]> = {}
    for (const k of Object.keys(data)) {
      out[k] = data[k].filter((c: any) =>
        [c.patientName, c.dentist?.name, c.patient?.boxNumber]
          .filter(Boolean).some((v: string) => v.toLowerCase().includes(termo)))
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

  const total = data ? Object.values(data).reduce((s, l) => s + l.length, 0) : 0

  return (
    // ocupa exatamente a área visível: só as colunas rolam por dentro
    <div className="-m-6 p-4 h-[calc(100vh-4rem)] flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="mr-auto flex items-baseline gap-3">
          <h1 className="text-xl font-semibold text-gray-900">Planning Center</h1>
          <span className="text-sm text-gray-500">{isLoading ? 'carregando…' : `${total} casos`}</span>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Paciente, dentista ou caixa"
            className="h-8 w-64 rounded-md border border-gray-200 bg-white pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} title="Atualizar" className="h-8 w-8 p-0">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
        <Button variant="outline" size="sm" onClick={exportExcel} className="h-8 gap-1.5">
          <FileDown className="w-4 h-4" /> Excel
        </Button>
      </div>

      <p className="-mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span><span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-200 align-middle mr-1" />mais de 2 dias úteis na etapa</span>
        <span><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-200 align-middle mr-1" />caso a alterar</span>
        <span>Aguardando aprovação: vermelho a partir de 30 dias corridos (cobra a checagem)</span>
        <span>Dias úteis sem fim de semana e feriados</span>
      </p>

      <div className="flex-1 min-h-0 grid grid-cols-5 gap-3">
        {COLUMNS.map(col => {
          const lista = filtrado?.[col.key] || []
          return (
            <section key={col.key} className="min-w-0 min-h-0 flex flex-col rounded-xl bg-white ring-1 ring-gray-200 overflow-hidden">
              <header className={`flex items-center gap-2 px-3 py-2.5 border-b bg-gradient-to-b ${col.head} to-white`}>
                <span className={`h-2 w-2 rounded-full shrink-0 ${col.dot}`} />
                <h2 className="text-[13px] font-semibold text-gray-800 truncate">{col.label}</h2>
                <span className="ml-auto text-xs font-semibold text-gray-600 tabular-nums">{isLoading ? '…' : lista.length}</span>
              </header>

              <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
                {isLoading && (
                  <li className="py-10 flex justify-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></li>
                )}
                {!isLoading && lista.length === 0 && (
                  <li className="py-10 text-center text-sm text-gray-400">Nenhum caso</li>
                )}
                {!isLoading && lista.map((c: any) => {
                  const regra = tomPlanning(col.key, dataEvento(c))
                  const dias = col.key === 'WAITING_APPROVAL' ? regra.diasCorridos : regra.diasUteis
                  return (
                    <li key={c.id} className={`group relative hover:brightness-[0.98] ${CLASSE_TOM[regra.tom] || 'hover:bg-gray-50'}`}>
                      <button onClick={() => navigate(`/cases/${c.id}`)} className="w-full text-left px-3 py-2">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-medium text-gray-900 truncate" title={c.patientName}>{c.patientName}</p>
                          <span className={`ml-auto shrink-0 rounded px-1.5 py-px text-[11px] tabular-nums ${SELO_TOM[regra.tom]}`}
                            title={`Na etapa desde ${new Date(dataEvento(c)).toLocaleDateString('pt-BR')} · ${regra.diasUteis} dia(s) útil(eis) · ${regra.diasCorridos} dia(s) corrido(s)`}>
                            {dias === 0 ? 'hoje' : col.key === 'WAITING_APPROVAL' ? `${dias}d` : `${dias}d úteis`}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500 min-w-0">
                          {c.patient?.boxNumber && (<>
                            <span className="font-mono text-gray-600 shrink-0">Cx {c.patient.boxNumber}</span>
                            <span className="text-gray-300">•</span>
                          </>)}
                          <span className="truncate" title={c.dentist?.name}>{c.dentist?.name}</span>
                        </div>
                      </button>
                      {isEquipe && (
                        <button
                          onClick={() => col.key === 'LAB_APPROVAL'
                            ? setEnvio({ caso: c, sup: String(c.checagem?.seriesFaseSuperior ?? ''), inf: String(c.checagem?.seriesFaseInferior ?? ''), guias: '0' })
                            : advanceMutation.mutate({ id: c.id })}
                          disabled={advanceMutation.isPending}
                          title="Avançar para a próxima etapa"
                          className="absolute right-2 bottom-1.5 hidden group-hover:flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-white shadow-sm"
                        >
                          Avançar <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
      {envio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEnvio(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="font-semibold text-gray-900">Enviar para aprovação do dentista</h3>
              <p className="text-sm text-gray-500">{envio.caso.patientName}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[['sup', 'Séries superiores'], ['inf', 'Séries inferiores'], ['guias', 'Guias de attachment']].map(([k, l]) => (
                <label key={k} className="text-xs text-gray-600">
                  {l}
                  <input value={envio[k]} inputMode="numeric" onChange={e => setEnvio({ ...envio, [k]: e.target.value.replace(/\D/g, '') })}
                    className="mt-1 h-10 w-full rounded-md border px-2 text-center text-lg font-semibold" />
                </label>
              ))}
            </div>
            {envio.caso.checagem && (envio.caso.checagem.seriesFaseSuperior != null || envio.caso.checagem.seriesFaseInferior != null) && (
              (Number(envio.sup) !== Number(envio.caso.checagem.seriesFaseSuperior ?? 0) || Number(envio.inf) !== Number(envio.caso.checagem.seriesFaseInferior ?? 0))
                ? <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">O PDF do planejamento indica {envio.caso.checagem.seriesFaseSuperior ?? 0} superiores e {envio.caso.checagem.seriesFaseInferior ?? 0} inferiores. Confira antes de enviar.</p>
                : <p className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-800">Séries conferem com o PDF do planejamento.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEnvio(null)}>Cancelar</Button>
              <Button disabled={advanceMutation.isPending || (!Number(envio.sup) && !Number(envio.inf))}
                onClick={() => advanceMutation.mutate({ id: envio.caso.id, body: { seriesSuperior: Number(envio.sup || 0), seriesInferior: Number(envio.inf || 0), guias: Number(envio.guias || 0) } })}>
                Enviar para aprovação
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
