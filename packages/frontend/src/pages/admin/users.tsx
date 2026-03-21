import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/status-badge'
import { formatDate } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { CheckCircle, XCircle, Search } from 'lucide-react'

export default function AdminUsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')

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
      <h1 className="text-2xl font-bold">Usuários</h1>
      <div className="flex gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={role} onChange={e => setRole(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Todos os perfis</option>
          {['DENTIST','LAB_TECH','ADMIN','FINANCIAL','SELLER'].map(r => <option key={r} value={r}>{r}</option>)}
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
              <div className="col-span-3">Nome</div><div className="col-span-3">E-mail</div><div className="col-span-1">Perfil</div><div className="col-span-2">Clínica / CRO</div><div className="col-span-1">Status</div><div className="col-span-1">Cadastro</div><div className="col-span-1">Ações</div>
            </div>
            {users.map((u: any) => (
              <div key={u.id} className="grid grid-cols-12 gap-4 px-6 py-3 items-center text-sm">
                <div className="col-span-3 font-medium">{u.name}</div>
                <div className="col-span-3 text-muted-foreground text-xs">{u.email}</div>
                <div className="col-span-1"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-medium">{u.role}</span></div>
                <div className="col-span-2 text-xs text-muted-foreground"><p>{u.clinic}</p><p>{u.cro}</p></div>
                <div className="col-span-1"><StatusBadge status={u.status} /></div>
                <div className="col-span-1 text-xs text-muted-foreground">{formatDate(u.createdAt)}</div>
                <div className="col-span-1 flex gap-1">
                  {u.status !== 'ACTIVE' && <Button size="icon" variant="ghost" className="w-7 h-7 text-green-600" onClick={() => updateStatus.mutate({ id: u.id, status: 'ACTIVE' })}><CheckCircle className="w-4 h-4" /></Button>}
                  {u.status === 'ACTIVE' && <Button size="icon" variant="ghost" className="w-7 h-7 text-red-500" onClick={() => updateStatus.mutate({ id: u.id, status: 'INACTIVE' })}><XCircle className="w-4 h-4" /></Button>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
