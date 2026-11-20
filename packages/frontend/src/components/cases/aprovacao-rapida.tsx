import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CheckCircle, Loader2, Truck, Store, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { ChecagemCard } from './checagem-card'

const brl = (n?: number | null) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Aprovação em 1 clique (pensada para celular): mostra a checagem 3D, o pacote, as parcelas,
 * entrega/retira e o valor final (com desconto do mês, taxa da checagem e frete) antes de aprovar.
 */
export function AprovacaoRapida({ caso }: { caso: any }) {
  const qc = useQueryClient()
  const [aberto, setAberto] = useState(false)
  const [serviceId, setServiceId] = useState<string>('')
  const [parcelas, setParcelas] = useState('1x')
  const [entrega, setEntrega] = useState<'ENTREGA' | 'RETIRA'>('ENTREGA')
  const enviadoEm = caso.updatedAt
  const dias = Math.floor((Date.now() - new Date(enviadoEm).getTime()) / 86400000)

  const { data, isLoading } = useQuery({
    queryKey: ['orcamento', caso.id, parcelas, entrega],
    queryFn: () => api.get(`/orcamento/caso/${caso.id}`, { params: { parcelas, entrega } }).then(r => r.data),
    enabled: aberto,
  })
  const opcoes: any[] = data?.opcoes || []
  const escolhida = opcoes.find(o => o.servico.id === serviceId) || null

  const aprovar = useMutation({
    mutationFn: () => api.post(`/workflow/case/${caso.id}/approve`, {
      serviceId, installmentOption: escolhida?.parcelas || parcelas, deliveryMethod: entrega,
    }),
    onSuccess: () => {
      toast({ title: 'Caso aprovado!', description: 'Seu caso foi liberado para produção.' })
      qc.invalidateQueries({ queryKey: ['cases'] })
      qc.invalidateQueries({ queryKey: ['aguardando-aprovacao'] })
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Não foi possível aprovar', description: e?.response?.data?.error }),
  })

  return (
    <div className="rounded-xl bg-white ring-1 ring-amber-200 shadow-sm overflow-hidden">
      <button onClick={() => setAberto(a => !a)} className="w-full flex items-center gap-3 p-4 text-left">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 truncate">{caso.patientName}</p>
          <p className="text-xs text-gray-500">
            {caso.patient?.boxNumber ? `Caixa ${caso.patient.boxNumber} • ` : ''}
            <span className={dias >= 25 ? 'text-rose-600 font-medium' : ''}><Clock className="inline w-3 h-3 -mt-0.5" /> aguardando há {dias} dia(s)</span>
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">{aberto ? 'Fechar' : 'Ver e aprovar'}</span>
        {aberto ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {aberto && (
        <div className="border-t p-4 space-y-4">
          <ChecagemCard checagem={caso.checagem} aguardandoDesde={enviadoEm} planejamentoLab={caso.planejamentoLab} />

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">1. Escolha o pacote</p>
            {isLoading && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
            <div className="grid gap-2 sm:grid-cols-3">
              {opcoes.map(o => (
                <button key={o.servico.id} disabled={!!o.erro} onClick={() => { setServiceId(o.servico.id) }}
                  className={`rounded-lg p-3 text-left ring-1 transition ${serviceId === o.servico.id ? 'ring-2 ring-primary bg-primary/5' : 'ring-gray-200 hover:ring-gray-300'} ${o.erro ? 'opacity-50' : ''}`}>
                  <p className="font-semibold text-gray-900">{o.servico.nome.replace(/^EA /, '')}</p>
                  {o.erro
                    ? <p className="text-xs text-gray-500">{o.erro}</p>
                    : <>
                        <p className="text-lg font-bold text-primary">{brl(o.totalSemFrete)}</p>
                        {o.quantidade && <p className="text-[11px] text-gray-500">{o.quantidade} alinhadores × {brl(o.precoUnitario)}</p>}
                        {o.descontoProgressivo > 0 && <p className="text-[11px] text-emerald-700">{o.casoNoMes}º caso do mês: -{o.descontoProgressivo}%</p>}
                      </>}
                </button>
              ))}
            </div>
          </div>

          {escolhida && (escolhida.parcelasPermitidas?.length || 0) > 1 && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">2. Forma de pagamento</p>
              <div className="flex flex-wrap gap-2">
                {escolhida.parcelasPermitidas.map((p: string) => (
                  <button key={p} onClick={() => setParcelas(p)}
                    className={`rounded-md px-3 py-1.5 text-sm ring-1 ${parcelas === p ? 'ring-2 ring-primary bg-primary/5 font-medium' : 'ring-gray-200'}`}>
                    {p === '1x' ? 'À vista' : p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">{escolhida && (escolhida.parcelasPermitidas?.length || 0) > 1 ? '3' : '2'}. Entrega</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setEntrega('ENTREGA')} className={`flex items-center gap-2 rounded-lg p-3 text-sm ring-1 ${entrega === 'ENTREGA' ? 'ring-2 ring-primary bg-primary/5' : 'ring-gray-200'}`}>
                <Truck className="w-4 h-4" /> Enviar (SEDEX)
              </button>
              <button onClick={() => setEntrega('RETIRA')} className={`flex items-center gap-2 rounded-lg p-3 text-sm ring-1 ${entrega === 'RETIRA' ? 'ring-2 ring-primary bg-primary/5' : 'ring-gray-200'}`}>
                <Store className="w-4 h-4" /> Retirar (sem frete)
              </button>
            </div>
          </div>

          {escolhida && !escolhida.erro && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>{escolhida.servico.nome} {escolhida.parcelas !== '1x' ? `(${escolhida.parcelas})` : ''}</span><span>{brl(escolhida.valorCheio)}</span></div>
              {escolhida.descontoProgressivo > 0 && <div className="flex justify-between text-emerald-700"><span>Desconto progressivo ({escolhida.casoNoMes}º caso do mês, -{escolhida.descontoProgressivo}%)</span><span>-{brl(escolhida.valorCheio - escolhida.valorComDesconto)}</span></div>}
              {escolhida.guiasAttachment && <div className="flex justify-between"><span>Guias de attachment ({escolhida.guiasAttachment.quantidade})</span><span>{brl(escolhida.guiasAttachment.valor)}</span></div>}
              {escolhida.taxaChecagem > 0 && <div className="flex justify-between text-rose-700"><span>Checagem 3D (aprovação após 30 dias)</span><span>{brl(escolhida.taxaChecagem)}</span></div>}
              <div className="flex justify-between"><span>Frete — {escolhida.frete.origem}</span><span>{escolhida.frete.valor === null ? 'a combinar' : brl(escolhida.frete.valor)}</span></div>
              <div className="flex justify-between border-t pt-1 text-base font-bold text-gray-900"><span>Total</span><span>{brl(escolhida.total)}</span></div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link to={`/patients/${caso.patientId}`} className="text-sm text-primary hover:underline">Ver caso completo</Link>
            <Button className="gap-2 bg-green-600 hover:bg-green-700" disabled={!escolhida || !!escolhida.erro || aprovar.isPending}
              onClick={() => aprovar.mutate()}>
              {aprovar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Aprovar {escolhida ? `• ${brl(escolhida.total)}` : ''}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
