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

  const createCoupon = useMutation({
    mutationFn: () => api.post('/admin/coupons', form),
    onSuccess: () => {
      qc.invalidateQueries(['admin-coupons'])
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
      qc.invalidateQueries(['admin-coupons'])
      toast({ title: 'Cupom atualizado', description: 'Dados do cupom atualizados.' })
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Erro', description: error?.response?.data?.error || 'Erro ao atualizar cupom' })
    },
  })

  const deleteCoupon = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/coupons/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['admin-coupons'])
      toast({ title: 'Cupom removido', description: 'Cupom apagado com sucesso.' })
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Erro', description: error?.response?.data?.error || 'Erro ao apagar cupom' })
    },
  })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Admin - Cupons</h1>

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
          <Button onClick={() => createCoupon.mutate()} disabled={createCoupon.isLoading}>Criar cupom</Button>
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
    </div>
  )
}