import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, CreditCard, Search } from 'lucide-react'
import api from '@/lib/api'

interface CardPayment {
  id: string
  totalAmount: number
  status: string
  transactionId: string | null
  installments: number | null
  cardBrand: string | null
  createdAt: string
  paidAt: string | null
  case: { caseNumber: number; patientName?: string } | null
  dentist: { name: string; clinic: string | null } | null
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDING:   { label: 'Pendente',   className: 'bg-yellow-100 text-yellow-700' },
  PAID:      { label: 'Pago',       className: 'bg-green-100 text-green-700'  },
  FAILED:    { label: 'Falhou',     className: 'bg-red-100 text-red-700'      },
  CANCELLED: { label: 'Cancelado',  className: 'bg-gray-100 text-gray-600'    },
  REFUNDED:  { label: 'Estornado',  className: 'bg-purple-100 text-purple-700'},
}

export function AdminCardPaymentsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const limit = 50

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-card-payments', statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(limit), offset: String((page - 1) * limit) })
      if (statusFilter) params.set('status', statusFilter)
      return api.get(`/payments/admin/list?${params}`).then(r => r.data)
    },
  })

  const payments: CardPayment[] = data?.payments || []

  const filtered = search
    ? payments.filter(p =>
        p.dentist?.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.case?.caseNumber?.toString().includes(search) ||
        p.transactionId?.toLowerCase().includes(search.toLowerCase())
      )
    : payments

  const totalAmount = filtered.reduce((sum, p) => p.status === 'PAID' ? sum + p.totalAmount : sum, 0)

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6" />
            Pagamentos em Cartão
          </h1>
          <p className="text-gray-500 mt-1">Histórico de transações via cartão de crédito (Rede)</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" />Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-gray-500">Total de transações</p>
            <p className="text-2xl font-bold mt-1">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-gray-500">Valor pago (filtro atual)</p>
            <p className="text-2xl font-bold mt-1 text-green-600">
              {totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-gray-500">Pagamentos aprovados</p>
            <p className="text-2xl font-bold mt-1">
              {filtered.filter(p => p.status === 'PAID').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <CardTitle className="text-base">Transações</CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Dentista, caso, ID..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border rounded-md"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
                className="text-sm border rounded-md px-2 py-2"
              >
                <option value="">Todos os status</option>
                {Object.entries(STATUS_LABELS).map(([val, { label }]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-gray-400">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Nenhum pagamento encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="pb-2 pr-4">Caso</th>
                    <th className="pb-2 pr-4">Dentista</th>
                    <th className="pb-2 pr-4">Valor</th>
                    <th className="pb-2 pr-4">Parcelas</th>
                    <th className="pb-2 pr-4">Bandeira</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">ID Transação</th>
                    <th className="pb-2">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(p => {
                    const st = STATUS_LABELS[p.status] || { label: p.status, className: 'bg-gray-100 text-gray-600' }
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="py-3 pr-4 font-mono font-medium">
                          {p.case ? `#${String(p.case.caseNumber).padStart(6, '0')}` : '—'}
                        </td>
                        <td className="py-3 pr-4">
                          <p className="font-medium">{p.dentist?.name || '—'}</p>
                          {p.dentist?.clinic && (
                            <p className="text-xs text-gray-400">{p.dentist.clinic}</p>
                          )}
                        </td>
                        <td className="py-3 pr-4 font-medium">
                          {p.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3 pr-4 text-center">
                          {p.installments ? `${p.installments}x` : '—'}
                        </td>
                        <td className="py-3 pr-4 uppercase text-xs font-medium">
                          {p.cardBrand || '—'}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.className}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs text-gray-500">
                          {p.transactionId || '—'}
                        </td>
                        <td className="py-3 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                          {p.paidAt && (
                            <p className="text-green-600">Pago: {new Date(p.paidAt).toLocaleDateString('pt-BR')}</p>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {(data?.total || 0) > limit && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                Anterior
              </Button>
              <span className="text-sm py-1 px-2 text-gray-500">Página {page}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={filtered.length < limit}>
                Próxima
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default AdminCardPaymentsPage
