import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/status-badge'
import { formatDate } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { CheckCircle, XCircle, Search, Plus, X } from 'lucide-react'

const ROLES = ['DENTIST', 'LAB_TECH', 'ADMIN', 'FINANCIAL', 'SELLER']
const ROLE_LABELS: Record<string, string> = {
  DENTIST: 'Dentista', LAB_TECH: 'Lab Tech', ADMIN: 'Administrador', FINANCIAL: 'Financeiro', SELLER: 'Vendedor'
}

function CreateUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'DENTIST', cro: '', clinic: '', cnpj: '', phone: '',
    address: '', city: '', state: '', zipCode: '',
  })

  const mutation = useMutation({
    mutationFn: () => api.post('/admin/users', { ...form }),
    onSuccess: () => {
      toast({ title: 'Usuário criado com sucesso' })
      onSuccess()
      onClose()
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Erro', description: err.response?.data?.error || 'Erro ao criar usuário' })
    },
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold">Novo Usuário</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome completo *</Label>
              <Input className="mt-1" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nome" />
            </div>
            <div>
              <Label>E-mail *</Label>
              <Input className="mt-1" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div>
              <Label>Senha *</Label>
              <Input className="mt-1" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Mínimo 8 caracteres" />
            </div>
            <div>
              <Label>Perfil *</Label>
              <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm" value={form.role} onChange={e => set('role', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>

          {(form.role === 'DENTIST') && (
            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-medium text-gray-700">Dados profissionais</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>CRO</Label>
                  <Input className="mt-1" value={form.cro} onChange={e => set('cro', e.target.value)} placeholder="CRO-SP 000000" />
                </div>
                <div>
                  <Label>Clínica</Label>
                  <Input className="mt-1" value={form.clinic} onChange={e => set('clinic', e.target.value)} placeholder="Nome da clínica" />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input className="mt-1" value={form.cnpj} onChange={e => set('cnpj', e.target.value)} placeholder="00.000.000/0001-00" />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input className="mt-1" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(11) 99999-9999" />
                </div>
                <div className="col-span-2">
                  <Label>Endereço</Label>
                  <Input className="mt-1" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Rua, número, complemento" />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input className="mt-1" value={form.city} onChange={e => set('city', e.target.value)} />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Input className="mt-1" value={form.state} onChange={e => set('state', e.target.value)} placeholder="SP" />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !form.name || !form.email || !form.password}
            >
              {mutation.isPending ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { data } = useQuery({
    queryKey: ['admin-users', search, role, status],
    queryFn: () => api.get(`/admin/users?search=${search}&role=${role}&status=${status}`).then(r => r.data),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/admin/users/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast({ title: 'Status atualizado!' }) },
  })

  const users = data?.users || []

  return (
    <div className="space-y-5">
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-users'] })}
        />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuários</h1>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Usuário
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={role} onChange={e => setRole(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Todos os perfis</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Todos os status</option>
          {['PENDING','ACTIVE','INACTIVE'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-medium text-muted-foreground uppercase bg-gray-50 rounded-t-xl">
              <div className="col-span-3">Nome</div>
              <div className="col-span-3">E-mail</div>
              <div className="col-span-1">Perfil</div>
              <div className="col-span-2">Clínica / CRO</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Cadastro</div>
              <div className="col-span-1">Ações</div>
            </div>
            {users.length === 0 && (
              <div className="px-6 py-10 text-center text-gray-400 text-sm">Nenhum usuário encontrado</div>
            )}
            {users.map((u: any) => (
              <div key={u.id} className="grid grid-cols-12 gap-4 px-6 py-3 items-center text-sm">
                <div className="col-span-3 font-medium">{u.name}</div>
                <div className="col-span-3 text-muted-foreground text-xs">{u.email}</div>
                <div className="col-span-1">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">{ROLE_LABELS[u.role] || u.role}</span>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {u.clinic && <p>{u.clinic}</p>}
                  {u.cro && <p className="text-gray-400">CRO: {u.cro}</p>}
                </div>
                <div className="col-span-1"><StatusBadge status={u.status} /></div>
                <div className="col-span-1 text-xs text-muted-foreground">{formatDate(u.createdAt)}</div>
                <div className="col-span-1 flex gap-1">
                  {u.status !== 'ACTIVE' && (
                    <Button size="icon" variant="ghost" className="w-7 h-7 text-green-600"
                      onClick={() => updateStatus.mutate({ id: u.id, status: 'ACTIVE' })}>
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                  )}
                  {u.status === 'ACTIVE' && (
                    <Button size="icon" variant="ghost" className="w-7 h-7 text-red-500"
                      onClick={() => updateStatus.mutate({ id: u.id, status: 'INACTIVE' })}>
                      <XCircle className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
