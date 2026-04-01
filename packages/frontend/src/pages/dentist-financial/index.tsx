import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { DollarSign, CheckCircle, Clock, AlertCircle, CreditCard, QrCode, RefreshCw, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

type Invoice = {
  id: string
  invoiceNumber: string
  description: string
  amount: string
  dueDate: string
  status: string
  paidAt?: string
}

type PaymentResult = {
  payment: {
    id: string
    method: string
    status: string
    pixCode?: string
    pixExpiry?: string
    cardLast4?: string
  }
}

function StatusBadge({ status, dueDate }: { status: string; dueDate: string }) {
  const isOverdue = status === 'OPEN' && new Date(dueDate) < new Date()
  if (status === 'PAID') return <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5"><CheckCircle className="w-3 h-3" /> Pago</span>
  if (isOverdue) return <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5"><AlertCircle className="w-3 h-3" /> Vencido</span>
  return <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 rounded-full px-2 py-0.5"><Clock className="w-3 h-3" /> Em aberto</span>
}

function formatCurrency(val: string) {
  return parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function DentistFinancialPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string[]>([])
  const [method, setMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX')
  const [installments, setInstallments] = useState<number>(1)
  const [cardData, setCardData] = useState({ number: '', holder: '', expiry: '', cvv: '' })
  const [payResult, setPayResult] = useState<PaymentResult | null>(null)
  const [paying, setPaying] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['dentist-invoices'],
    queryFn: () => api.get('/dentist-financial/invoices').then(r => r.data.invoices as Invoice[]),
  })

  const openInvoices = data?.filter(i => i.status === 'OPEN') || []
  const paidInvoices = data?.filter(i => i.status === 'PAID') || []

  const selectedInvoices = openInvoices.filter(i => selected.includes(i.id))
  const total = selectedInvoices.reduce((s, i) => s + parseFloat(i.amount), 0)

  const toggleAll = () => {
    if (selected.length === openInvoices.length) setSelected([])
    else setSelected(openInvoices.map(i => i.id))
  }

  const handlePay = async () => {
    if (!selected.length) return toast({ title: 'Selecione pelo menos um título', variant: 'destructive' })
    setPaying(true)
    try {
      const res = await api.post('/dentist-financial/invoices/pay', {
        invoiceIds: selected,
        method,
        installments: method === 'CREDIT_CARD' ? installments : 1,
        cardData: method === 'CREDIT_CARD' ? cardData : undefined,
      })
      setPayResult(res.data)
      if (method === 'CREDIT_CARD') {
        toast({ title: 'Pagamento processado!', description: `R$ ${total.toFixed(2)} debitado no cartão final ${res.data.payment.cardLast4}` })
        setSelected([])
        qc.invalidateQueries({ queryKey: ['dentist-invoices'] })
      }
    } catch (err: any) {
      toast({ title: 'Erro no pagamento', description: err.response?.data?.error, variant: 'destructive' })
    } finally {
      setPaying(false)
    }
  }

  const copyPix = () => {
    if (payResult?.payment.pixCode) {
      navigator.clipboard.writeText(payResult.payment.pixCode)
      toast({ title: 'Código PIX copiado!' })
    }
  }

  const checkPixStatus = async () => {
    if (!payResult) return
    const res = await api.get(`/dentist-financial/invoices/payment/${payResult.payment.id}/status`)
    if (res.data.status === 'PAID') {
      toast({ title: 'Pagamento PIX confirmado!' })
      setPayResult(null)
      setSelected([])
      qc.invalidateQueries({ queryKey: ['dentist-invoices'] })
    } else {
      toast({ title: 'Aguardando pagamento...', description: 'O PIX ainda não foi confirmado.' })
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
        <p className="text-gray-500 text-sm mt-1">Visualize seus títulos e acompanhe o processamento pelo nosso Financeiro</p>
      </div>

      <div className="border rounded-xl bg-amber-50 border-amber-200 p-4 text-sm text-amber-900">
        O pagamento direto pelo portal está temporariamente desabilitado. Neste momento, o faturamento e a liberação são centralizados pelo Financeiro.
      </div>

      {false && payResult?.payment.method === 'PIX' && payResult.payment.status !== 'PAID' && (
        <div className="border-2 border-primary/30 rounded-xl p-6 bg-primary/5 space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold text-lg">
            <QrCode className="w-5 h-5" /> Aguardando Pagamento PIX
          </div>
          <p className="text-sm text-gray-600">Copie o código abaixo e pague no app do seu banco.</p>
          <div className="bg-white border rounded-lg p-3 font-mono text-xs break-all text-gray-700">{payResult.payment.pixCode}</div>
          <div className="flex gap-3">
            <Button onClick={copyPix} variant="outline" size="sm"><Copy className="w-4 h-4 mr-1.5" /> Copiar código</Button>
            <Button onClick={checkPixStatus} size="sm"><RefreshCw className="w-4 h-4 mr-1.5" /> Verificar pagamento</Button>
          </div>
          {payResult.payment.pixExpiry && (
            <p className="text-xs text-gray-400">Expira em: {new Date(payResult.payment.pixExpiry).toLocaleTimeString('pt-BR')}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Títulos em aberto</p>
          <p className="text-2xl font-bold text-gray-900">{openInvoices.length}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total a pagar</p>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(String(openInvoices.reduce((s, i) => s + parseFloat(i.amount), 0)))}
          </p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Selecionado</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(String(total))}</p>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
          <p className="font-semibold text-gray-700">Títulos em Aberto</p>
          {openInvoices.length > 0 && (
            <button onClick={toggleAll} className="text-xs text-primary hover:underline">
              {selected.length === openInvoices.length ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Carregando títulos...</div>
        ) : openInvoices.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Nenhum título em aberto!</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b">
              <th className="px-5 py-3 w-10"></th>
              <th className="px-5 py-3">Nº Título</th>
              <th className="px-5 py-3">Descrição</th>
              <th className="px-5 py-3">Vencimento</th>
              <th className="px-5 py-3">Valor</th>
              <th className="px-5 py-3">Status</th>
            </tr></thead>
            <tbody>
              {openInvoices.map(inv => (
                <tr key={inv.id} className={cn('border-b last:border-0 hover:bg-gray-50 cursor-pointer', selected.includes(inv.id) && 'bg-primary/5')}
                  onClick={() => setSelected(s => s.includes(inv.id) ? s.filter(x => x !== inv.id) : [...s, inv.id])}>
                  <td className="px-5 py-3"><input type="checkbox" checked={selected.includes(inv.id)} readOnly className="accent-primary" /></td>
                  <td className="px-5 py-3 font-mono font-medium">{inv.invoiceNumber}</td>
                  <td className="px-5 py-3 text-gray-600">{inv.description}</td>
                  <td className="px-5 py-3">{formatDate(inv.dueDate)}</td>
                  <td className="px-5 py-3 font-semibold">{formatCurrency(inv.amount)}</td>
                  <td className="px-5 py-3"><StatusBadge status={inv.status} dueDate={inv.dueDate} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {false && selected.length > 0 && (
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <p className="font-semibold text-gray-800">Forma de Pagamento</p>
          <div className="flex gap-3">
            <button onClick={() => setMethod('PIX')}
              className={cn('flex-1 border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all',
                method === 'PIX' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300')}>
              <QrCode className="w-6 h-6 text-primary" />
              <span className="font-medium text-sm">PIX</span>
              <span className="text-xs text-gray-400">Aprovação imediata</span>
            </button>
            <button onClick={() => setMethod('CREDIT_CARD')}
              className={cn('flex-1 border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all',
                method === 'CREDIT_CARD' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300')}>
              <CreditCard className="w-6 h-6 text-primary" />
              <span className="font-medium text-sm">Cartão de Crédito</span>
              <span className="text-xs text-gray-400">Escolha as parcelas</span>
            </button>
          </div>

          {method === 'CREDIT_CARD' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Parcelas</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  value={installments}
                  onChange={e => setInstallments(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(opt => (
                    <option key={opt} value={opt}>{opt}x</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Número do Cartão</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="0000 0000 0000 0000"
                  value={cardData.number} onChange={e => setCardData(d => ({ ...d, number: e.target.value }))} maxLength={19} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Nome no Cartão</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm uppercase" placeholder="NOME SOBRENOME"
                  value={cardData.holder} onChange={e => setCardData(d => ({ ...d, holder: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Validade</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="MM/AA"
                  value={cardData.expiry} onChange={e => setCardData(d => ({ ...d, expiry: e.target.value }))} maxLength={5} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">CVV</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="000" type="password"
                  value={cardData.cvv} onChange={e => setCardData(d => ({ ...d, cvv: e.target.value }))} maxLength={4} />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <p className="text-xs text-gray-500">{selected.length} título(s) selecionado(s)</p>
              <p className="font-bold text-lg text-gray-900">{formatCurrency(String(total))}</p>
            </div>
            <Button onClick={handlePay} disabled={paying} className="gap-2">
              <DollarSign className="w-4 h-4" />
              {paying ? 'Processando...' : `Pagar ${formatCurrency(String(total))}`}
            </Button>
          </div>
        </div>
      )}

      {paidInvoices.length > 0 && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <p className="font-semibold text-gray-700">Histórico de Pagamentos</p>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b">
              <th className="px-5 py-3">Nº Título</th>
              <th className="px-5 py-3">Descrição</th>
              <th className="px-5 py-3">Pago em</th>
              <th className="px-5 py-3">Valor</th>
            </tr></thead>
            <tbody>
              {paidInvoices.map(inv => (
                <tr key={inv.id} className="border-b last:border-0 text-gray-500">
                  <td className="px-5 py-3 font-mono">{inv.invoiceNumber}</td>
                  <td className="px-5 py-3">{inv.description}</td>
                  <td className="px-5 py-3">{inv.paidAt ? formatDate(inv.paidAt) : '-'}</td>
                  <td className="px-5 py-3">{formatCurrency(inv.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
