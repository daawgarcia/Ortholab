import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { Plus, Grid3X3, Loader2, ExternalLink } from 'lucide-react'

export default function AdminModulesPage() {
  const qc = useQueryClient()
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '', url: '', icon: '', roles: 'ADMIN,DENTIST', openInNewTab: false, order: '0' })

  const { data } = useQuery({ queryKey: ['modules-all'], queryFn: () => api.get('/modules/all').then(r => r.data) })

  const createMutation = useMutation({
    mutationFn: () => api.post('/modules', { ...form, roles: form.roles.split(',').map(r => r.trim()), order: parseInt(form.order), openInNewTab: form.openInNewTab }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['modules-all'] }); setShow(false); toast({ title: 'Módulo adicionado!' }) },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/modules/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modules-all'] }),
  })

  const modules = data?.modules || []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Módulos</h1>
          <p className="text-sm text-muted-foreground">Gerencie ferramentas integradas ao portal</p>
        </div>
        <Button onClick={() => setShow(true)} className="gap-2"><Plus className="w-4 h-4" /> Adicionar Módulo</Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {modules.map((m: any) => (
          <Card key={m.id} className={m.status === 'INACTIVE' ? 'opacity-60' : ''}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center"><Grid3X3 className="w-5 h-5 text-primary" /></div>
                  <div>
                    <p className="font-semibold">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.slug}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{m.status}</span>
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-1 truncate"><ExternalLink className="w-3 h-3 shrink-0" />{m.url}</p>
                <p>Perfis: {m.roles?.join(', ')}</p>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => toggleMutation.mutate({ id: m.id, status: m.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}>
                  {m.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-6 space-y-3">
              <h3 className="font-bold text-lg">Novo Módulo</h3>
              {[['name','Nome'],['slug','Slug (único)'],['url','URL'],['icon','Ícone'],['roles','Perfis (separados por vírgula)'],['order','Ordem']].map(([k, l]) => (
                <div key={k} className="space-y-1"><label className="text-xs font-medium">{l}</label>
                  <Input value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.openInNewTab} onChange={e => setForm(f => ({ ...f, openInNewTab: e.target.checked }))} />
                Abrir em nova aba
              </label>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShow(false)}>Cancelar</Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
