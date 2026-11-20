import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ShieldCheck, Download, Search, EyeOff, Loader2, FileText } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/use-debounce'

const ACOES: Record<string, string> = {
  'lgpd.acesso': 'Acesso a dados',
  'lgpd.exportacao': 'Exportação de dados',
  'lgpd.anonimizacao': 'Anonimização',
  'lgpd.aceite_termos': 'Aceite de termos',
}

function fmt(d: string) {
  const x = new Date(d)
  return `${x.toLocaleDateString('pt-BR')} ${x.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

export default function AdminLgpdPage() {
  const [aba, setAba] = useState<'acessos' | 'titular' | 'documentos'>('acessos')
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">LGPD</h1>
          <p className="text-sm text-gray-500">Registro de acessos, direitos dos titulares e documentos de privacidade</p>
        </div>
      </div>
      <div className="flex gap-1 border-b">
        {([['acessos', 'Registro de acessos'], ['titular', 'Direitos do titular'], ['documentos', 'Termos e política']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setAba(k)}
            className={`px-4 py-2 text-sm ${aba === k ? 'border-b-2 border-primary font-medium text-primary' : 'text-gray-500 hover:text-gray-800'}`}>{l}</button>
        ))}
      </div>
      {aba === 'acessos' && <Acessos />}
      {aba === 'titular' && <DireitosTitular />}
      {aba === 'documentos' && <Documentos />}
    </div>
  )
}

function Acessos() {
  const [usuario, setUsuario] = useState('')
  const [acao, setAcao] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [page, setPage] = useState(1)
  const u = useDebounce(usuario, 400)
  const { data, isLoading } = useQuery({
    queryKey: ['lgpd-acessos', u, acao, de, ate, page],
    queryFn: () => api.get('/lgpd/acessos', { params: { usuario: u || undefined, acao: acao || undefined, de: de || undefined, ate: ate || undefined, page } }).then(r => r.data),
  })
  const itens: any[] = data?.itens || []
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input value={usuario} onChange={e => { setUsuario(e.target.value); setPage(1) }} placeholder="E-mail do usuário"
          className="h-9 w-60 rounded-md border px-3 text-sm" />
        <select value={acao} onChange={e => { setAcao(e.target.value); setPage(1) }} className="h-9 rounded-md border px-2 text-sm">
          <option value="">Todas as ações</option>
          {Object.entries(ACOES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" value={de} onChange={e => setDe(e.target.value)} className="h-9 rounded-md border px-2 text-sm" />
        <input type="date" value={ate} onChange={e => setAte(e.target.value)} className="h-9 rounded-md border px-2 text-sm" />
        <span className="ml-auto self-center text-sm text-gray-500">{data?.total ?? 0} registros</span>
      </div>
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
            <tr><th className="px-4 py-2">Quando</th><th className="px-4 py-2">Usuário</th><th className="px-4 py-2">Ação</th><th className="px-4 py-2">Paciente / recurso</th><th className="px-4 py-2">IP</th></tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && <tr><td colSpan={5} className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" /></td></tr>}
            {!isLoading && !itens.length && <tr><td colSpan={5} className="py-8 text-center text-gray-400">Nenhum registro</td></tr>}
            {itens.map(i => (
              <tr key={i.id}>
                <td className="whitespace-nowrap px-4 py-2 tabular-nums">{fmt(i.createdAt)}</td>
                <td className="px-4 py-2"><p className="text-gray-900">{i.actorEmail || '—'}</p><p className="text-[11px] text-gray-500">{i.actorRole}</p></td>
                <td className="px-4 py-2">{ACOES[i.action] || i.action}{i.metadata?.parte ? <span className="text-gray-500"> • {i.metadata.parte}</span> : null}</td>
                <td className="px-4 py-2">
                  {i.pacienteNome
                    ? <Link to={`/patients/${i.resourceId}`} className="text-primary hover:underline">{i.pacienteNome}</Link>
                    : <span className="text-gray-500">{i.resource}{i.metadata?.rota ? ` ${i.metadata.rota}` : ''}</span>}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">{i.ip || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
        <Button variant="outline" size="sm" disabled={page * 50 >= (data?.total || 0)} onClick={() => setPage(p => p + 1)}>Próxima</Button>
      </div>
    </div>
  )
}

function DireitosTitular() {
  const [busca, setBusca] = useState('')
  const termo = useDebounce(busca.trim(), 300)
  const [sel, setSel] = useState<any>(null)
  const [motivo, setMotivo] = useState('')
  const [confirma, setConfirma] = useState('')
  const { data } = useQuery({
    queryKey: ['lgpd-busca', termo],
    queryFn: () => api.get('/patients', { params: { search: termo, limit: 10 } }).then(r => r.data),
    enabled: termo.length >= 2,
  })

  const exportar = async (p: any) => {
    const res = await api.get(`/lgpd/pacientes/${p.id}/exportar`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `dados-paciente-${p.name.replace(/\W+/g, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Exportação gerada e registrada' })
  }

  const anonimizar = useMutation({
    mutationFn: () => api.post(`/lgpd/pacientes/${sel.id}/anonimizar`, { motivo, confirmacao: confirma }),
    onSuccess: (r) => { toast({ title: 'Paciente anonimizado', description: r.data.nome }); setSel(null); setMotivo(''); setConfirma('') },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Não foi possível anonimizar', description: e?.response?.data?.error }),
  })

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Pedido de um paciente (ou do dentista em nome dele) para acessar, levar ou eliminar seus dados. Localize o paciente:
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome do paciente ou nº da caixa"
            className="h-10 w-full rounded-md border pl-9 pr-3 text-sm" />
        </div>
        <div className="divide-y rounded-xl bg-white ring-1 ring-gray-200">
          {(data?.patients || []).map((p: any) => (
            <div key={p.id} className={`flex items-center gap-2 px-4 py-2.5 ${sel?.id === p.id ? 'bg-primary/5' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{p.name}</p>
                <p className="truncate text-xs text-gray-500">{p.dentist?.name}{p.boxNumber ? ` • Cx ${p.boxNumber}` : ''}</p>
              </div>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => exportar(p)}><Download className="h-3.5 w-3.5" /> Exportar</Button>
              <Button size="sm" variant="ghost" className="gap-1 text-rose-600" onClick={() => setSel(p)}><EyeOff className="h-3.5 w-3.5" /> Anonimizar</Button>
            </div>
          ))}
          {termo.length >= 2 && !(data?.patients || []).length && <p className="px-4 py-6 text-center text-sm text-gray-400">Nenhum paciente encontrado</p>}
        </div>
      </div>

      <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-5">
        <h3 className="font-semibold text-gray-900">Anonimizar paciente</h3>
        <p className="mt-1 text-sm text-gray-600">
          Remove nome, data de nascimento, sexo, observações e fotos do Ortholab 2. O histórico clínico e financeiro fica sem identificação.
          <strong> Atenção:</strong> a política da Esthetic Aligner é guardar os dados por tempo indeterminado — anonimize só com orientação do encarregado/jurídico.
          O Ortholab 1 não é alterado.
        </p>
        {sel ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm">Paciente: <strong>{sel.name}</strong></p>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo / número do pedido do titular"
              className="min-h-20 w-full rounded-md border bg-white px-3 py-2 text-sm" />
            <input value={confirma} onChange={e => setConfirma(e.target.value)} placeholder='Digite ANONIMIZAR para confirmar'
              className="h-9 w-full rounded-md border bg-white px-3 text-sm" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSel(null)}>Cancelar</Button>
              <Button className="bg-rose-600 hover:bg-rose-700" disabled={confirma !== 'ANONIMIZAR' || motivo.trim().length < 10 || anonimizar.isPending}
                onClick={() => anonimizar.mutate()}>Anonimizar</Button>
            </div>
          </div>
        ) : <p className="mt-4 text-sm text-gray-400">Selecione um paciente na lista.</p>}
      </div>
    </div>
  )
}

function Documentos() {
  return (
    <div className="max-w-2xl space-y-3 text-sm text-gray-700">
      <p>Os textos dos <strong>Termos de Uso</strong> e da <strong>Política de Privacidade</strong> foram criados como <strong>minuta</strong> e precisam ser revisados pelo jurídico e completados com os dados da empresa e do encarregado (DPO).</p>
      <p>Para editar, vá em <Link to="/admin/content" className="text-primary hover:underline">Administração → Conteúdo</Link> (páginas <code>termos-de-uso</code> e <code>politica-de-privacidade</code>). Sempre que o texto for salvo, todos os usuários aceitam a nova versão no próximo acesso — o aceite fica registrado com data, IP e versão.</p>
      <p className="flex items-center gap-2 text-gray-500"><FileText className="h-4 w-4" /> Prazo de guarda definido pela Esthetic Aligner: os dados são mantidos por tempo indeterminado.</p>
    </div>
  )
}
