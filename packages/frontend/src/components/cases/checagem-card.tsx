import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, AlertTriangle, Layers, CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/hooks/use-toast'

interface Faixa { min: number; max: number }
export interface Checagem {
  estimativaSuperior?: Faixa
  estimativaInferior?: Faixa
  estimativaGeral?: Faixa
  seriesFaseSuperior?: number
  seriesFaseInferior?: number
  tipoIndicado?: 'UNIDADE' | 'MID' | 'FULL' | null
  pagina?: number
  arquivo?: string
  arquivoId?: string
  lidoEm?: string
  data?: string
  planejamentos?: Checagem[]
  escolhido?: string
}

function Arcada({ nome, fase, estimativa }: { nome: string; fase?: number; estimativa?: Faixa }) {
  return (
    <div className="rounded-lg bg-white/70 ring-1 ring-gray-200 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{nome}</p>
      <p className="mt-1 text-xs text-gray-500">Estimativa de movimentação</p>
      <p className="text-2xl font-semibold text-gray-900 tabular-nums">
        {estimativa ? `${estimativa.min} – ${estimativa.max}` : '—'} <span className="text-sm font-normal text-gray-500">séries</span>
      </p>
      <p className="mt-1 text-xs text-gray-600">
        Produção nesta fase: <strong className="tabular-nums">{fase != null ? `${fase} séries` : '—'}</strong>
      </p>
    </div>
  )
}

const dataBr = (d?: string) => (d ? new Date(d).toLocaleDateString('pt-BR') : '')

/** Card da Checagem Virtual 3D — indicação lida do(s) PDF(s) do planejamento. Com mais de um planejamento, mostra todos para escolha. */
export function ChecagemCard({ checagem, aguardandoDesde, planejamentoLab, caseId, dentistId }: { checagem?: Checagem | null; aguardandoDesde?: string; planejamentoLab?: any; caseId?: string; dentistId?: string }) {
  const dias = aguardandoDesde ? Math.floor((Date.now() - new Date(aguardandoDesde).getTime()) / 86400000) : null
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const lista: Checagem[] = (checagem?.planejamentos && checagem.planejamentos.length ? checagem.planejamentos : (checagem ? [checagem] : []))
  const escolhidoId = checagem?.escolhido || checagem?.arquivoId || lista[lista.length - 1]?.arquivoId
  const idxEscolhido = Math.max(0, lista.findIndex(p => p.arquivoId === escolhidoId))
  const [ver, setVer] = useState<number>(lista.length ? (lista.findIndex(p => p.arquivoId === escolhidoId) >= 0 ? idxEscolhido : lista.length - 1) : 0)
  const atual = lista[ver] || checagem || null
  const podeEscolher = !!caseId && !!user && (user.role === 'ADMIN' || user.role === 'LAB_TECH' || (user.role === 'DENTIST' && user.id === dentistId))

  const escolher = useMutation({
    mutationFn: (arquivoId: string) => api.post(`/workflow/case/${caseId}/planejamento-escolhido`, { arquivoId }),
    onSuccess: () => {
      toast({ title: 'Planejamento escolhido', description: 'O valor e as séries passam a seguir este planejamento.' })
      qc.invalidateQueries({ queryKey: ['cases'] }); qc.invalidateQueries({ queryKey: ['case'] }); qc.invalidateQueries({ queryKey: ['orcamento'] }); qc.invalidateQueries({ queryKey: ['aguardando-aprovacao'] })
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Não foi possível escolher', description: e?.response?.data?.error }),
  })

  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Layers className="w-5 h-5 text-amber-600" />
        <h3 className="text-base font-semibold text-gray-900">Checagem Virtual 3D</h3>
        {dias != null && (
          <span className={`ml-auto text-xs ${dias >= 30 ? 'text-rose-700 font-medium' : 'text-gray-500'}`}>
            Aguardando aprovação há {dias} {dias === 1 ? 'dia' : 'dias'}
            {dias >= 30 && ' — aprovação após 30 dias cobra a checagem (R$ 320)'}
          </span>
        )}
      </div>

      {lista.length > 1 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-gray-600">Este caso tem {lista.length} planejamentos. Compare e escolha:</p>
          <div className="flex flex-wrap gap-2">
            {lista.map((p, i) => (
              <button key={p.arquivoId || i} type="button" onClick={() => setVer(i)}
                className={`rounded-lg px-3 py-2 text-left text-xs ring-1 transition ${ver === i ? 'ring-2 ring-amber-500 bg-white' : 'ring-gray-200 bg-white/60 hover:ring-gray-300'}`}>
                <span className="block font-semibold text-gray-900">Planejamento {i + 1}{i === idxEscolhido ? ' ✓' : ''}</span>
                <span className="text-gray-500">{dataBr(p.data || p.lidoEm) || 'sem data'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {atual ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Arcada nome="Arcada superior" fase={atual.seriesFaseSuperior} estimativa={atual.estimativaSuperior ?? atual.estimativaGeral} />
            <Arcada nome="Arcada inferior" fase={atual.seriesFaseInferior} estimativa={atual.estimativaInferior ?? atual.estimativaGeral} />
          </div>
          {lista.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {ver === idxEscolhido
                ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"><CheckCircle2 className="w-3.5 h-3.5" /> Planejamento escolhido</span>
                : podeEscolher && atual.arquivoId
                  ? <button type="button" disabled={escolher.isPending} onClick={() => escolher.mutate(atual.arquivoId!)} className="rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60">{escolher.isPending ? 'Salvando…' : `Escolher o Planejamento ${ver + 1}`}</button>
                  : <span className="text-xs text-gray-500">Escolhido: Planejamento {idxEscolhido + 1}</span>}
            </div>
          )}
          {planejamentoLab && (
            <p className="mt-3 rounded-md bg-white/70 px-3 py-2 text-xs text-gray-700 ring-1 ring-gray-200">
              <strong>Produção definida pelo laboratório:</strong> {planejamentoLab.seriesSuperior} séries superiores, {planejamentoLab.seriesInferior} inferiores
              {Number(planejamentoLab.guias) > 0 ? ` e ${planejamentoLab.guias} guia(s) de attachment` : ', sem guia de attachment'}
            </p>
          )}
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-500">
            <FileText className="w-3.5 h-3.5" />
            Lido do planejamento 3D{atual.arquivo ? ` "${atual.arquivo}"` : ''}{atual.pagina ? `, página ${atual.pagina}` : ''}{(atual.data || atual.lidoEm) ? ` · ${dataBr(atual.data || atual.lidoEm)}` : ''}
          </p>
        </>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          Ainda não há leitura do PDF do planejamento 3D para este caso. Ao anexar o PDF, a indicação é lida automaticamente.
        </p>
      )}
    </div>
  )
}
