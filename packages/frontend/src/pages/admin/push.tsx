import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDateTime } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { Plus, Bell, Loader2, X } from 'lucide-react'

export default function AdminPushPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', link: '', level: 'INFO', targetType: 'ALL', targetId: '' })

  const { data } = useQuery({ queryKey: ['pushes'], queryFn: () => api.get('/push').then(r => r.data) })
  const [userSearch, setUserSearch] = useState('')
  const [userCandidates, setUserCandidates] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  const { data: searchResults } = useQuery({
    queryKey: ['search-users', userSearch],
    queryFn: () => {
      if (!userSearch.trim()) return { users: [] }
      return api.get(`/admin/users?search=${encodeURIComponent(userSearch.trim())}`).then(r => r.data)
    },
    staleTime: 0,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/push', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pushes'] }); setShow(false); toast({ title: 'Push criado!' }) },
  })

  const pushes = data?.pushes || []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Push Notifications</h1>
        <Button onClick={() => setShow(true)} className="gap-2"><Plus className="w-4 h-4" /> Criar Push</Button>
      </div>
      <div className="space-y-3">
        {pushes.length === 0 && <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">Nenhum push criado</CardContent></Card>}
        {pushes.map((p: any) => (
          <Card key={p.id}>
            <CardContent className="p-4 flex items-start gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${p.level === 'URGENT' ? 'bg-red-100' : p.level === 'WARNING' ? 'bg-yellow-100' : 'bg-blue-100'}`}>
                <Bell className={`w-5 h-5 ${p.level === 'URGENT' ? 'text-red-600' : p.level === 'WARNING' ? 'text-yellow-600' : 'text-blue-600'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{p.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.level === 'URGENT' ? 'bg-red-100 text-red-700' : p.level === 'WARNING' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{p.level}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{p.body}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>Destino: <strong>{p.targetType}</strong></span>
                  <span>{p._count?.reads || 0} leituras</span>
                  <span>{formatDateTime(p.createdAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader><CardTitle>Criar Push Notification</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1"><label className="text-xs font-medium">Título *</label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div className="space-y-1"><label className="text-xs font-medium">Mensagem *</label><textarea className="w-full min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} /></div>
              <div className="space-y-1"><label className="text-xs font-medium">Link (opcional)</label><Input placeholder="https://..." value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-xs font-medium">Nível</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}>
                    <option value="INFO">Informação</option><option value="WARNING">Aviso</option><option value="URGENT">Urgente</option>
                  </select>
                </div>
                <div className="space-y-1"><label className="text-xs font-medium">Destinatário</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.targetType} onChange={e => setForm(f => ({ ...f, targetType: e.target.value, targetId: '' }))}>
                    <option value="ALL">Todos</option>
                    <option value="ROLE">Por Perfil</option>
                    <option value="USER">Usuário Específico</option>
                    {user?.role === 'SELLER' && <option value="SELLER_PORTFOLIO">Minha Carteira</option>}
                  </select>
                </div>
              </div>

              {form.targetType === 'ROLE' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium">Selecionar perfil</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.targetId} onChange={e => setForm(f => ({ ...f, targetId: e.target.value }))}>
                    <option value="">-- choose --</option>
                    <option value="DENTIST">DENTIST</option>
                    <option value="LAB_TECH">LAB_TECH</option>
                    <option value="FINANCIAL">FINANCIAL</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SELLER">SELLER</option>
                  </select>
                </div>
              )}

              {form.targetType === 'USER' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium">Buscar usuário (nome ou email)</label>
                  <Input 
                    value={userSearch} 
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="Digite nome ou email..."
                  />

                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {userSearch.trim() && searchResults?.users?.length > 0 ? (
                      searchResults.users.map(u => (
                        <button 
                          key={u.id} 
                          type="button" 
                          className="w-full text-left p-2 border rounded hover:bg-blue-50 transition-colors text-sm"
                          onClick={() => { 
                            setForm(f => ({ ...f, targetId: u.id })); 
                            setUserSearch(u.name)
                          }}
                        >
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-gray-500">{u.email} — {u.role}</div>
                        </button>
                      ))
                    ) : userSearch.trim() ? (
                      <p className="text-xs text-muted-foreground p-2">Nenhum usuário encontrado</p>
                    ) : (
                      <p className="text-xs text-muted-foreground p-2">Digite para buscar usuários...</p>
                    )}
                  </div>

                  {form.targetId && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Usuário selecionado</label>
                      <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                        <span>{userSearch}</span>
                        <button type="button" onClick={() => { setForm(f => ({ ...f, targetId: '' })); setUserSearch('') }}>
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShow(false)}>Cancelar</Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.title || !form.body}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Enviar Push
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
