import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'

export default function AdminCouponsPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ code: '', description: '', type: 'PERCENT', value: 0, active: true })

  const { data, isLoading } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: () => api.get('/admin/coupons').then(r => r.data),
  })

  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: ['admin-coupons-report'],
    queryFn: () => api.get('/admin/coupons/report').then(r => r.data),
  })

  const createCoupon = useMutation({
    mutationFn: () => api.post('/admin/coupons', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] })
      setForm({ code: '', description: '', type: 'PERCENT', value: 0, active: true })
      toast({ title: 'Cupom criado', description: 'Cupom cadastrado com sucesso.' })
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Erro', description: error?.response?.data?.error || 'Erro ao criar cupom' })
    },
  })

  const updateCoupon = useMutation({
    mutationFn: (payload: any) => api.patch(`/admin/coupons/${payload.id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] })
      toast({ title: 'Cupom atualizado', description: 'Dados do cupom atualizados.' })
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Erro', description: error?.response?.data?.error || 'Erro ao atualizar cupom' })
    },
  })

  const deleteCoupon = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/coupons/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] })
      toast({ title: 'Cupom removido', description: 'Cupom apagado com sucesso.' })
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Erro', description: error?.response?.data?.error || 'Erro ao apagar cupom' })
    },
  })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Admin - Cupons</h1>

      <div className="rounded-lg border bg-blue-50 p-4 text-sm text-blue-900">
        O cupom é aplicado sobre o valor final da condição de pagamento escolhida, só pode ser usado em casos de alinhadores e cada dentista pode usar o mesmo cupom apenas uma vez.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg bg-white p-4 space-y-3">
          <h2 className="text-lg font-semibold">Novo cupom</h2>
          <Input placeholder="Código" value={form.code} onChange={e => setForm(s => ({ ...s, code: e.target.value.toUpperCase() }))} />
          <Input placeholder="Descrição" value={form.description} onChange={e => setForm(s => ({ ...s, description: e.target.value }))} />
          <div className="flex gap-2">
            <select className="border rounded px-2 py-1" value={form.type} onChange={e => setForm(s => ({ ...s, type: e.target.value }))}>
              <option value="PERCENT">Percentual (%)</option>
              <option value="AMOUNT">Valor fixo</option>
            </select>
            <Input type="number" placeholder="Valor" value={form.value} onChange={e => setForm(s => ({ ...s, value: Number(e.target.value) }))} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={e => setForm(s => ({ ...s, active: e.target.checked }))} className="accent-primary" />
            Ativo
          </label>
          <Button onClick={() => createCoupon.mutate()} disabled={createCoupon.isPending}>Criar cupom</Button>
        </div>

        <div className="border rounded-lg bg-white p-4">
          <h2 className="text-lg font-semibold">Cupons ativos</h2>
          {isLoading ? (
            <div className="text-sm text-gray-500">Carregando...</div>
          ) : (
            <div className="space-y-2 mt-3">
              {(data?.coupons || []).map((coupon: any) => (
                <div key={coupon.id} className="p-3 border rounded flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{coupon.code} - {coupon.description || '-'}</p>
                    <p className="text-xs text-gray-500">{coupon.type === 'PERCENT' ? `${coupon.value}%` : `R$ ${coupon.value.toFixed(2)}`} • {coupon.active ? 'Ativo' : 'Inativo'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateCoupon.mutate({ ...coupon, active: !coupon.active })}>
                      {coupon.active ? 'Inativar' : 'Ativar'}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteCoupon.mutate(coupon.id)}>Excluir</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border rounded-lg bg-white p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Relatório de uso de cupons</h2>
          <p className="text-sm text-gray-500">Controle por cupom, dentista e caso faturado ou em andamento.</p>
        </div>

        {reportLoading ? (
          <div className="text-sm text-gray-500">Carregando relatório...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(reportData?.summary || []).map((item: any) => (
                <div key={item.code} className="rounded border p-3">
                  <p className="text-sm font-semibold">{item.code}</p>
                  <p className="text-xs text-gray-500">{item.totalUses} uso(s) • {item.uniqueDentists} dentista(s)</p>
                </div>
              ))}
              {(reportData?.summary || []).length === 0 && <div className="text-sm text-gray-500">Nenhum uso registrado ainda.</div>}
            </div>

            {(reportData?.usages || []).length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="py-2 pr-3">Cupom</th>
                      <th className="py-2 pr-3">Dentista</th>
                      <th className="py-2 pr-3">Caso</th>
                      <th className="py-2 pr-3">Serviço</th>
                      <th className="py-2 pr-3">NF</th>
                      <th className="py-2 pr-3">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.usages.map((item: any) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">{item.discountCoupon}</td>
                        <td className="py-2 pr-3">{item.dentist?.name}</td>
                        <td className="py-2 pr-3">#{item.caseNumber}</td>
                        <td className="py-2 pr-3">{item.service?.name || item.service?.type || '-'}</td>
                        <td className="py-2 pr-3">{item.financial?.invoiceNumber || '-'}</td>
                        <td className="py-2 pr-3 text-gray-500">{new Date(item.financial?.billedAt || item.createdAt).toLocaleDateString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}