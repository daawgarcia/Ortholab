import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PackageX, Loader2, Undo2, CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/hooks/use-toast'

const STATUS: Record<string, { txt: string; cls: string }> = {
  MANUAL_PENDENTE: { txt: 'Aguardando o financeiro lançar no Protheus', cls: 'bg-amber-100 text-amber-800' },
  LANCADO_MANUAL: { txt: 'Lançado no Protheus pelo financeiro', cls: 'bg-emerald-100 text-emerald-800' },
  ENVIADO: { txt: 'Enviado ao Protheus automaticamente', cls: 'bg-emerald-100 text-emerald-800' },
  ERRO: { txt: 'Falhou o envio ao Protheus — lançar à mão', cls: 'bg-rose-100 text-rose-800' },
}
const fmt = (d?: string) => (d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '')

/** Botões "Perdeu MID" / "Perdeu FULL" — só a equipe vê; admin e laboratório clicam. Nunca aparece para o dentista. */
export function PacotePerdidoCard({ caseId }: { caseId: string }) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [tipo, setTipo] = useState<'MID' | 'FULL' | null>(null)
  const [motivo, setMotivo] = useState('')
  const interno = !!user && user.role !== 'DENTIST'
  const { data } = useQuery({
    queryKey: ['pacote-perdido', caseId],
    queryFn: () => api.get(`/pacotes-perdidos/caso/${caseId}`).then(r => r.data),
    enabled: interno && !!caseId,
  })
  const recarregar = () => { qc.invalidateQueries({ queryKey: ['pacote-perdido', caseId] }); qc.invalidateQueries({ queryKey: ['pacotes-perdidos'] }) }
  const marcar = useMutation({
    mutationFn: () => api.post(`/pacotes-perdidos/caso/${caseId}`, { tipo, motivo }),
    onSuccess: () => { toast({ title: `Marcado: Perdeu ${tipo}`, description: 'O financeiro foi avisado para lançar no Protheus.' }); setTipo(null); setMotivo(''); recarregar() },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Não foi possível marcar', description: e?.response?.data?.error }),
  })
  const desfazer = useMutation({
    mutationFn: (id: string) => api.post(`/pacotes-perdidos/${id}/desfazer`),
    onSuccess: (r: any) => { toast({ title: 'Marcação desfeita', description: r?.data?.avisoFinanceiro || undefined }); recarregar() },
  })
  const lancar = useMutation({
    mutationFn: (id: string) => api.post(`/pacotes-perdidos/${id}/lancado`),
    onSuccess: () => { toast({ title: 'Marcado como lançado no Protheus' }); recarregar() },
  })
  if (!interno || !data) return null
  const ativo = (data.itens || []).find((i: any) => !i.desfeitoEm)
  const historico = (data.itens || []).filter((i: any) => i !== ativo)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <PackageX className="w-4 h-4 text-rose-600" />
        <p className="text-sm font-semibold text-gray-800">Pacote perdido</p>
        <span className="text-[11px] text-gray-400">uso interno · o dentista não vê</span>
        {!ativo && (
          <div className="ml-auto flex gap-2">
            {(['MID', 'FULL'] as const).map(t => (
              <button key={t} type="button" disabled={!data.podeMarcar} onClick={() => setTipo(t)}
                title={data.podeMarcar ? '' : 'Só admin e laboratório podem marcar'}
                className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50">
                Perdeu {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {ativo ? (
        <div className="mt-3 rounded-lg bg-rose-50 p-3 ring-1 ring-rose-200">
          <p className="text-sm font-semibold text-rose-800">Perdeu {ativo.tipo}</p>
          <p className="text-xs text-gray-600">Marcado por {ativo.marcadoPor || '—'} em {fmt(ativo.marcadoEm)}{ativo.motivo ? ` · ${ativo.motivo}` : ''}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS[ativo.totvsStatus]?.cls || ''}`}>{STATUS[ativo.totvsStatus]?.txt || ativo.totvsStatus}</span>
            {ativo.totvsEm && <span className="text-[11px] text-gray-500">{ativo.totvsPor ? `${ativo.totvsPor} · ` : ''}{fmt(ativo.totvsEm)}</span>}
            {data.podeLancar && ['MANUAL_PENDENTE', 'ERRO'].includes(ativo.totvsStatus) && (
              <button type="button" onClick={() => lancar.mutate(ativo.id)} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> Já lancei no Protheus
              </button>
            )}
            {data.podeMarcar && (
              <button type="button" onClick={() => window.confirm('Desfazer a marcação de pacote perdido?') && desfazer.mutate(ativo.id)} className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800">
                <Undo2 className="w-3.5 h-3.5" /> Desfazer
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-500">Use quando o dentista perder o pacote deste caso. O financeiro é avisado na hora para lançar no Protheus.</p>
      )}

      {historico.length > 0 && (
        <details className="mt-2 text-xs text-gray-500">
          <summary className="cursor-pointer">Histórico ({historico.length})</summary>
          <ul className="mt-1 space-y-1">
            {historico.map((h: any) => <li key={h.id}>Perdeu {h.tipo} · {fmt(h.marcadoEm)} por {h.marcadoPor}{h.desfeitoEm ? ` · desfeito ${fmt(h.desfeitoEm)} por ${h.desfeitoPor}` : ''}</li>)}
          </ul>
        </details>
      )}

      {tipo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setTipo(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900">Confirmar "Perdeu {tipo}"?</h3>
            <p className="text-sm text-gray-600">O caso fica marcado como pacote {tipo} perdido e o financeiro é avisado para lançar no Protheus. O dentista não é notificado.</p>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} placeholder="Motivo (opcional)" className="w-full rounded-md border px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setTipo(null)} className="rounded-md border px-3 py-1.5 text-sm">Cancelar</button>
              <button type="button" disabled={marcar.isPending} onClick={() => marcar.mutate()} className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                {marcar.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar Perdeu {tipo}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
