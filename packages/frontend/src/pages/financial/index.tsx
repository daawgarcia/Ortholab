import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/status-badge'
import { formatDate, formatCurrency } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { Download, DollarSign, Loader2, CheckCircle } from 'lucide-react'

export default function FinancialPage() {
  const qc = useQueryClient()
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">{data?.total || 0} casos no workflow financeiro</p>
        </div>
        <Button variant="outline" onClick={exportExcel} className="gap-2"><Download className="w-4 h-4" /> Exportar Excel</Button>
      </div>

      <div className="flex gap-3">
        <Input placeholder="Buscar paciente ou dentista..." className="max-w-xs" value={search} onChange={e => setSearch(e.target.value)} />
        <select value={billed} onChange={e => setBilled(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Todos</option>
          <option value="false">Pendente</option>
          <option value="true">Faturado</option>
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
                  <div className="col-span-1 font-bold text-primary">#{c.caseNumber}</div>
                  <div className="col-span-2">{c.patientName}</div>
                  <div className="col-span-2">{c.dentist?.name}</div>
                  <div className="col-span-2 text-muted-foreground text-xs"><p>{c.dentist?.clinic}</p><p>{c.dentist?.cnpj}</p></div>
                  <div className="col-span-1 text-xs text-muted-foreground">{c.service?.name || '-'}</div>
                  <div className="col-span-1 font-medium">{c.financial?.amount ? formatCurrency(Number(c.financial.amount)) : c.payment?.amount ? formatCurrency(Number(c.payment.amount)) : '-'}</div>
                  <div className="col-span-1"><StatusBadge status={c.payment?.status || 'PENDING'} /></div>
                  <div className="col-span-1 text-xs">{c.financial?.invoiceNumber || <span className="text-muted-foreground">-</span>}</div>
                  <div className="col-span-1">
                    {!c.financial?.invoiceNumber ? (
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setBillModal(c); setBillForm({ invoiceNumber: '', amount: '', notes: '' }) }}>
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

      {billModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader><CardTitle>Faturar Caso #{billModal.caseNumber}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1"><label className="text-xs font-medium">Número da NF (opcional)</label><Input placeholder="NF-12345" value={billForm.invoiceNumber} onChange={e => setBillForm(f => ({ ...f, invoiceNumber: e.target.value }))} /></div>
              <div className="space-y-1"><label className="text-xs font-medium">Valor (R$)</label><Input type="number" placeholder="0.00" value={billForm.amount} onChange={e => setBillForm(f => ({ ...f, amount: e.target.value }))} /></div>
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
