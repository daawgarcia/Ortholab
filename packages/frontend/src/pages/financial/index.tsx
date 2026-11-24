import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/status-badge'
import { formatDate, formatCurrency } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { Download, DollarSign, Loader2, CheckCircle, Copy, PackageX } from 'lucide-react'
import { useSearchParams, Link } from 'react-router-dom'
import { diasUteis } from '@/lib/prazos'

function getAmountDetails(c: any) {
  if (c.financial?.amount !== null && c.financial?.amount !== undefined) {
    return { tone: 'text-emerald-700', text: 'Valor já faturado no Financeiro' }
  }

  if (c.payment?.amount !== null && c.payment?.amount !== undefined) {
    return { tone: 'text-sky-700', text: 'Valor vindo do pagamento registrado' }
  }

  if (c.pricingContext) {
    const parts = [`Base ${formatCurrency(Number(c.pricingContext.baseAmount || 0))}`]
    if (c.pricingContext.progressiveDiscountPercent) {
      parts.push(`Progressivo ${c.pricingContext.progressiveDiscountPercent}%`)
    }
    if (c.pricingContext.couponCode) {
      parts.push(`Cupom ${c.pricingContext.couponCode}`)
    }
    return { tone: 'text-amber-700', text: parts.join(' · ') }
  }

  return { tone: 'text-muted-foreground', text: 'Valor ainda sem composição disponível' }
}

/** Texto pronto para digitar no Protheus (processo manual do financeiro até a integração). */
function textoProtheus(c: any, valor: number | null) {
  const doc = (c.dentist?.cnpj || c.dentist?.cpf || '').replace(/\D/g, '')
  const lab = c.planejamentoLab || {}
  const linhas = [
    `Cliente: ${c.dentist?.name || ''}${c.dentist?.totvsCode ? ` — código ${c.dentist.totvsCode}${c.dentist?.totvsLoja ? `/${c.dentist.totvsLoja}` : ''}` : ''}`,
    `CPF/CNPJ: ${doc || '—'}`,
    `Caso nº ${c.caseNumber}${c.patient?.boxNumber ? ` · caixa ${c.patient.boxNumber}` : ''} · paciente ${c.patientName}`,
    `Produto: ${c.service?.name || '—'}${lab.seriesSuperior != null ? ` · séries sup ${lab.seriesSuperior} / inf ${lab.seriesInferior}${Number(lab.guias) > 0 ? ` · guias ${lab.guias}` : ''}` : ''}`,
    `Valor: ${valor != null ? formatCurrency(valor) : '—'} · parcelas ${c.installmentOption || '—'}${c.discountCoupon ? ` · cupom ${c.discountCoupon}` : ''}${c.deliveryMethod === 'RETIRA' ? ' · retira (sem frete)' : c.freightAmount ? ` · frete ${formatCurrency(Number(c.freightAmount))}` : ''}`,
    c.approvedAt ? `Aprovado em ${new Date(c.approvedAt).toLocaleDateString('pt-BR')}` : '',
  ]
  return linhas.filter(Boolean).join('\n')
}

function PacotesPerdidos() {
  const qc = useQueryClient()
  const [status, setStatus] = useState('pendente')
  const { data, isLoading } = useQuery({ queryKey: ['pacotes-perdidos', status], queryFn: () => api.get(`/pacotes-perdidos?status=${status}`).then(r => r.data) })
  const lancar = useMutation({
    mutationFn: (id: string) => api.post(`/pacotes-perdidos/${id}/lancado`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pacotes-perdidos'] }); toast({ title: 'Marcado como lançado no Protheus' }) },
  })
  const itens = data?.itens || []
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b px-6 py-3">
          {[['pendente', 'A lançar no Protheus'], ['lancado', 'Já lançados'], ['', 'Todos']].map(([v, l]) => (
            <button key={v} onClick={() => setStatus(v)} className={`rounded-full px-3 py-1 text-xs ring-1 ${status === v ? 'bg-primary text-white ring-primary' : 'ring-gray-200 text-gray-600'}`}>{l}</button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">Marcados pelo laboratório/admin em cada caso (Perdeu MID / Perdeu FULL)</span>
        </div>
        {isLoading ? <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div> :
          itens.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">Nada por aqui.</div> : (
          <div className="divide-y">
            {itens.map((i: any) => (
              <div key={i.id} className="grid grid-cols-12 items-center gap-4 px-6 py-3 text-sm">
                <div className="col-span-1"><span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">Perdeu {i.tipo}</span></div>
                <div className="col-span-3"><Link to={`/cases/${i.case?.id}`} className="font-medium text-primary hover:underline">{i.case?.patientName}</Link><p className="text-xs text-muted-foreground">Caso #{i.case?.caseNumber}{i.case?.patient?.boxNumber ? ` · caixa ${i.case.patient.boxNumber}` : ''}</p></div>
                <div className="col-span-3"><p>{i.case?.dentist?.name}</p><p className="text-xs text-muted-foreground">{i.case?.dentist?.totvsCode ? `Protheus ${i.case.dentist.totvsCode}${i.case.dentist.totvsLoja ? '/' + i.case.dentist.totvsLoja : ''} · ` : ''}{i.case?.dentist?.cnpj || i.case?.dentist?.cpf || ''}</p></div>
                <div className="col-span-3 text-xs text-muted-foreground">Marcado por {i.marcadoPor} em {formatDate(i.marcadoEm)}{i.motivo ? ` · ${i.motivo}` : ''}{i.totvsEm ? <><br />Lançado {i.totvsPor ? `por ${i.totvsPor} ` : ''}em {formatDate(i.totvsEm)}</> : null}</div>
                <div className="col-span-2 text-right">
                  {['MANUAL_PENDENTE', 'ERRO'].includes(i.totvsStatus)
                    ? <Button size="sm" variant="outline" className="h-7 text-xs" disabled={lancar.isPending} onClick={() => lancar.mutate(i.id)}><CheckCircle className="mr-1 h-3 w-3" /> Já lancei</Button>
                    : <span className="text-xs font-medium text-emerald-700">✓ No Protheus</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function FinancialPage() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const aba = params.get('aba') === 'pacotes' ? 'pacotes' : 'faturar'
  const { data: pp } = useQuery({ queryKey: ['pacotes-perdidos', 'contagem'], queryFn: () => api.get('/pacotes-perdidos?status=pendente').then(r => r.data), refetchInterval: 120000 })

  const [search, setSearch] = useState('')
  const [billed, setBilled] = useState('')
  const [billModal, setBillModal] = useState<any>(null)
  const [billForm, setBillForm] = useState({ invoiceNumber: '', amount: '', notes: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['financial', search, billed],
    queryFn: () => api.get(`/financial?search=${search}&billed=${billed}&limit=50`).then(r => r.data),
  })

  const billMutation = useMutation({
    mutationFn: (caseId: string) => api.post(`/financial/${caseId}/bill`, { invoiceNumber: billForm.invoiceNumber, amount: billForm.amount ? parseFloat(billForm.amount) : undefined, notes: billForm.notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financial'] }); setBillModal(null); toast({ title: 'Caso faturado com sucesso!' }) },
  })

  const exportExcel = async () => {
    const response = await api.get('/export/cases', { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([response.data]))
    const a = document.createElement('a'); a.href = url; a.download = `casos_${new Date().toISOString().split('T')[0]}.xlsx`; a.click()
  }

  const cases = data?.cases || []

  function getDisplayAmount(c: any) {
    if (c.financial?.amount !== null && c.financial?.amount !== undefined) return Number(c.financial.amount)
    if (c.payment?.amount !== null && c.payment?.amount !== undefined) return Number(c.payment.amount)
    if (c.suggestedAmount !== null && c.suggestedAmount !== undefined) return Number(c.suggestedAmount)
    return null
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">{billed === 'true' ? `${data?.total || 0} caso(s) faturado(s)` : billed === 'all' ? `${data?.total || 0} caso(s) no workflow financeiro` : `${data?.total || 0} caso(s) a faturar`} · o botão “Protheus” copia os dados do caso para lançar</p>
        </div>
        <Button variant="outline" onClick={exportExcel} className="gap-2"><Download className="w-4 h-4" /> Exportar Excel</Button>
      </div>

      <div className="flex gap-2 border-b">
        <button onClick={() => setParams({})} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${aba === 'faturar' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}>Casos a faturar</button>
        <button onClick={() => setParams({ aba: 'pacotes' })} className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium ${aba === 'pacotes' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}>
          <PackageX className="h-4 w-4" /> Pacotes perdidos {pp?.pendentes ? <span className="rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white">{pp.pendentes}</span> : null}
        </button>
      </div>

      {aba === 'pacotes' ? <PacotesPerdidos /> : <>
      <div className="flex gap-3">
        <Input placeholder="Buscar paciente ou dentista..." className="max-w-xs" value={search} onChange={e => setSearch(e.target.value)} />
        <select value={billed} onChange={e => setBilled(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">A faturar (como no Ortholab 1)</option>
          <option value="true">Faturados</option>
          <option value="all">Todos</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div> :
          cases.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">Nenhum caso encontrado</div> : (
            <div className="divide-y">
              <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-medium text-muted-foreground uppercase bg-gray-50 rounded-t-xl">
                <div className="col-span-1">#</div>
                <div className="col-span-2">Paciente</div>
                <div className="col-span-2">Dentista</div>
                <div className="col-span-2">Clínica / CNPJ</div>
                <div className="col-span-1">Serviço</div>
                <div className="col-span-1">Valor</div>
                <div className="col-span-1">Pgto</div>
                <div className="col-span-1">NF</div>
                <div className="col-span-1">Ação</div>
              </div>
              {cases.map((c: any) => (
                <div key={c.id} className="grid grid-cols-12 gap-4 px-6 py-3 items-center text-sm">
                  <div className="col-span-1">
                    <p className="font-bold text-primary">#{c.caseNumber}</p>
                    {(c.faturamentoDesde || c.approvedAt) && c.faturamentoPendente && !c.financial?.invoiceNumber && (() => { const d = diasUteis(c.faturamentoDesde || c.approvedAt); return <p className={`text-[11px] ${d >= 2 ? 'font-semibold text-rose-600' : 'text-muted-foreground'}`}>{d === 0 ? 'aprovado hoje' : `há ${d}d úteis`}</p> })()}
                    <button type="button" title="Copiar os dados para lançar no Protheus" onClick={() => { navigator.clipboard.writeText(textoProtheus(c, getDisplayAmount(c))); toast({ title: 'Copiado', description: 'Dados prontos para colar no Protheus.' }) }}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-primary"><Copy className="h-3 w-3" /> Protheus</button>
                  </div>
                  <div className="col-span-2">{c.patientName}</div>
                  <div className="col-span-2">{c.dentist?.name}</div>
                  <div className="col-span-2 text-muted-foreground text-xs"><p>{c.dentist?.clinic}</p><p>{c.dentist?.cnpj}</p></div>
                  <div className="col-span-1 text-xs text-muted-foreground">{c.service?.name || '-'}</div>
                  <div className="col-span-1 font-medium">
                    {getDisplayAmount(c) !== null ? formatCurrency(getDisplayAmount(c)) : '-'}
                    <p className={`mt-1 text-[11px] leading-tight ${getAmountDetails(c).tone}`}>{getAmountDetails(c).text}</p>
                  </div>
                  <div className="col-span-1"><StatusBadge status={c.payment?.status || 'PENDING'} /></div>
                  <div className="col-span-1 text-xs">{c.financial?.invoiceNumber || <span className="text-muted-foreground">-</span>}</div>
                  <div className="col-span-1">
                    {!c.financial?.invoiceNumber ? (
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setBillModal(c); setBillForm({ invoiceNumber: '', amount: getDisplayAmount(c) !== null ? String(getDisplayAmount(c)) : '', notes: '' }) }}>
                        <DollarSign className="w-3 h-3 mr-1" /> Faturar
                      </Button>
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      </>}

      {billModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader><CardTitle>Faturar Caso #{billModal.caseNumber}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1"><label className="text-xs font-medium">Número da NF (opcional)</label><Input placeholder="NF-12345" value={billForm.invoiceNumber} onChange={e => setBillForm(f => ({ ...f, invoiceNumber: e.target.value }))} /></div>
              <div className="space-y-1"><label className="text-xs font-medium">Valor (R$)</label><Input type="number" placeholder="0.00" value={billForm.amount} onChange={e => setBillForm(f => ({ ...f, amount: e.target.value }))} /></div>
              {billModal && (
                <p className={`text-xs ${getAmountDetails(billModal).tone}`}>{getAmountDetails(billModal).text}</p>
              )}
              <div className="space-y-1"><label className="text-xs font-medium">Observações</label><Input value={billForm.notes} onChange={e => setBillForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <p className="text-xs text-muted-foreground">Use este fluxo para lançar valor manual (ex.: 21x e UNIDADE) e liberar para pagamento do cliente.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setBillModal(null)}>Cancelar</Button>
                <Button onClick={() => billMutation.mutate(billModal.id)} disabled={billMutation.isPending || !(parseFloat(billForm.amount) > 0)}>
                  {billMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Confirmar Faturamento
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
