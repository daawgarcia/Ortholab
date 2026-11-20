import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Truck, Plus, Trash2, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

type Faixa = { uf: string; cidade: string; valor: string; prazoDias: string }

/** Tabela de frete (SEDEX por estado; dá para colocar uma cidade com valor diferente). "Retira" nunca cobra frete. */
export default function AdminFretePage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['frete'], queryFn: () => api.get('/orcamento/frete').then(r => r.data) })
  const [linhas, setLinhas] = useState<Faixa[]>([])
  useEffect(() => {
    if (data?.faixas) setLinhas(data.faixas.map((f: any) => ({ uf: f.uf, cidade: f.cidade || '', valor: String(Number(f.valor)), prazoDias: f.prazoDias ? String(f.prazoDias) : '' })))
  }, [data])

  const salvar = useMutation({
    mutationFn: () => api.put('/orcamento/frete', {
      faixas: linhas.map(l => ({ uf: l.uf, cidade: l.cidade || null, valor: Number(l.valor.replace(',', '.')), prazoDias: l.prazoDias ? Number(l.prazoDias) : null })),
    }),
    onSuccess: (r) => { toast({ title: `Tabela de frete salva (${r.data.linhas} linhas)` }); qc.invalidateQueries({ queryKey: ['frete'] }) },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Erro ao salvar', description: e?.response?.data?.error }),
  })

  const set = (i: number, k: keyof Faixa, v: string) => setLinhas(ls => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)))

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Truck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Frete</h1>
          <p className="text-sm text-gray-500">Valor cobrado na aprovação pelo estado do endereço de entrega do dentista. Cidade preenchida vale só para ela. Quem escolhe "Retirar" não paga frete.</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
            <tr><th className="px-3 py-2 w-20">UF</th><th className="px-3 py-2">Cidade (opcional)</th><th className="px-3 py-2 w-32">Valor (R$)</th><th className="px-3 py-2 w-28">Prazo (dias)</th><th className="w-10" /></tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && <tr><td colSpan={5} className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" /></td></tr>}
            {linhas.map((l, i) => (
              <tr key={i}>
                <td className="px-3 py-1.5"><input value={l.uf} maxLength={2} onChange={e => set(i, 'uf', e.target.value.toUpperCase())} className="h-8 w-14 rounded border px-2 font-mono" /></td>
                <td className="px-3 py-1.5"><input value={l.cidade} onChange={e => set(i, 'cidade', e.target.value)} placeholder="todo o estado" className="h-8 w-full rounded border px-2" /></td>
                <td className="px-3 py-1.5"><input value={l.valor} onChange={e => set(i, 'valor', e.target.value)} className="h-8 w-24 rounded border px-2 text-right tabular-nums" /></td>
                <td className="px-3 py-1.5"><input value={l.prazoDias} onChange={e => set(i, 'prazoDias', e.target.value.replace(/\D/g, ''))} className="h-8 w-16 rounded border px-2 text-right" /></td>
                <td className="px-2"><button onClick={() => setLinhas(ls => ls.filter((_, j) => j !== i))} className="text-gray-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" className="gap-2" onClick={() => setLinhas(ls => [...ls, { uf: '', cidade: '', valor: '', prazoDias: '' }])}><Plus className="h-4 w-4" /> Adicionar linha</Button>
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>{salvar.isPending ? 'Salvando…' : 'Salvar tabela'}</Button>
      </div>
    </div>
  )
}
