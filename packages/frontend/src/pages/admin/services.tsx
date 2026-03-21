import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { Plus, Loader2 } from 'lucide-react'

export default function AdminServicesPage() {
  const qc = useQueryClient()
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', type: 'FULL', productionDays: '15', maxRevisions: '2', price: '' })

  const { data } = useQuery({ queryKey: ['services-all'], queryFn: () => api.get('/services').then(r => r.data) })

  const createMutation = useMutation({
    mutationFn: () => api.post('/services', { ...form, productionDays: parseInt(form.productionDays), maxRevisions: parseInt(form.maxRevisions), price: parseFloat(form.price) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['services-all'] }); setShow(false); toast({ title: 'Serviço criado!' }) },
  })

  const services = data?.services || []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Serviços e Preços</h1>
        <Button onClick={() => setShow(true)} className="gap-2"><Plus className="w-4 h-4" /> Novo Serviço</Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {services.map((s: any) => (
          <Card key={s.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold">{s.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.active ? 'Ativo' : 'Inativo'}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-2"><p className="text-lg font-bold text-primary">{s.prices?.[0] ? formatCurrency(Number(s.prices[0].price)) : '-'}</p><p className="text-xs text-muted-foreground">Preço</p></div>
                <div className="bg-gray-50 rounded-lg p-2"><p className="text-lg font-bold">{s.productionDays}d</p><p className="text-xs text-muted-foreground">Produção</p></div>
                <div className="bg-gray-50 rounded-lg p-2"><p className="text-lg font-bold">{s.maxRevisions}</p><p className="text-xs text-muted-foreground">Revisões</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader><CardTitle>Novo Serviço</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[['name','Nome do serviço'],['description','Descrição'],['price','Preço (R$)'],['productionDays','Prazo (dias)'],['maxRevisions','Máx. revisões']].map(([k, l]) => (
                <div key={k} className="space-y-1"><label className="text-xs font-medium">{l}</label><Input value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>
              ))}
              <div className="flex gap-2 justify-end mt-2">
                <Button variant="outline" onClick={() => setShow(false)}>Cancelar</Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Criar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
