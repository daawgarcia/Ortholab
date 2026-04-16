import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { CheckCircle, Clock, XCircle, RefreshCw } from 'lucide-react'
import api from '@/lib/api'

interface PixPayment {
  id: string
  dentistId: string
  totalAmount: number
  status: string
  pixCode: string | null
  pixExpiry: string | null
  transactionId: string | null
  createdAt: string
  paidAt: string | null
}

export default function AdminPixPaymentsPage() {
  const [payments, setPayments] = useState<PixPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/dentist-financial/invoices/payments/pix')
      setPayments(res.data.payments)
    } catch {
      toast({ title: 'Erro ao carregar pagamentos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const confirm = async (id: string) => {
    setConfirming(id)
    try {
      await api.post(`/dentist-financial/invoices/payment/${id}/confirm-pix`)
      toast({ title: 'PIX confirmado com sucesso!' })
      load()
    } catch (err: any) {
      toast({ title: 'Erro ao confirmar', description: err.response?.data?.error || err.message, variant: 'destructive' })
    } finally {
      setConfirming(null)
    }
  }

  const statusBadge = (status: string) => {
    if (status === 'PAID') return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Pago</Badge>
    if (status === 'PENDING') return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>
    return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Falhou</Badge>
  }

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  const fmtDate = (d: string) => new Date(d).toLocaleString('pt-BR')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pagamentos PIX</h1>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Todos os pagamentos PIX</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pagamento PIX encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Data</th>
                    <th className="pb-2 pr-4">Valor</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">TID Rede</th>
                    <th className="pb-2 pr-4">Pago em</th>
                    <th className="pb-2">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 text-muted-foreground">{fmtDate(p.createdAt)}</td>
                      <td className="py-3 pr-4 font-medium">{fmt(p.totalAmount)}</td>
                      <td className="py-3 pr-4">{statusBadge(p.status)}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{p.transactionId || '—'}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{p.paidAt ? fmtDate(p.paidAt) : '—'}</td>
                      <td className="py-3">
                        {p.status === 'PENDING' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => confirm(p.id)}
                            disabled={confirming === p.id}
                            className="text-green-700 border-green-300 hover:bg-green-50"
                          >
                            {confirming === p.id ? 'Confirmando...' : 'Confirmar PIX'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
