import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDateTime } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { AlertCircle, Bell, CheckCircle, Download, Loader2, Plus, Upload, X } from 'lucide-react'

export default function AdminPushPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [showPushModal, setShowPushModal] = useState(false)
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [form, setForm] = useState({
    title: '',
    body: '',
    link: '',
    level: 'INFO',
    targetType: 'ALL',
    targetId: '',
  })
  const [csvForm, setCsvForm] = useState({
    title: '',
    body: '',
    link: '',
    level: 'INFO',
  })
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvResult, setCsvResult] = useState<{ matched: Array<{ name?: string; email: string }>; notFound: string[] } | null>(null)
  const [csvLoading, setCsvLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const csvFileRef = useRef<HTMLInputElement | null>(null)

  const { data } = useQuery({
    queryKey: ['pushes'],
    queryFn: () => api.get('/push').then((response) => response.data),
  })

  const { data: searchResults } = useQuery({
    queryKey: ['search-users', userSearch],
    queryFn: () => {
      if (!userSearch.trim()) return { users: [] }
      return api.get(`/admin/users?search=${encodeURIComponent(userSearch.trim())}`).then((response) => response.data)
    },
    staleTime: 0,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/push', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pushes'] })
      setShowPushModal(false)
      toast({ title: 'Push criado!' })
    },
  })

  const pushes = data?.pushes || []

  async function sendCsvPush() {
    if (!csvFile || !csvForm.title || !csvForm.body) return

    setCsvLoading(true)
    setCsvResult(null)

    try {
      const formData = new FormData()
      formData.append('file', csvFile)

      const params = new URLSearchParams({
        title: csvForm.title,
        body: csvForm.body,
        level: csvForm.level,
      })

      if (csvForm.link) {
        params.set('link', csvForm.link)
      }

      const response = await api.post(`/push/send-csv?${params.toString()}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setCsvResult(response.data)
      queryClient.invalidateQueries({ queryKey: ['pushes'] })
      toast({ title: `Push enviado para ${response.data.matched.length} usuário(s)` })
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error?.response?.data?.error || 'Falha ao processar planilha',
        variant: 'destructive',
      })
    } finally {
      setCsvLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Push Notifications</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setShowCsvModal(true)
              setCsvResult(null)
            }}
            className="gap-2"
          >
            <Upload className="w-4 h-4" /> Enviar por Planilha
          </Button>
          <Button onClick={() => setShowPushModal(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Criar Push
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {pushes.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">Nenhum push criado</CardContent>
          </Card>
        )}

        {pushes.map((push: any) => (
          <Card key={push.id}>
            <CardContent className="p-4 flex items-start gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${push.level === 'URGENT' ? 'bg-red-100' : push.level === 'WARNING' ? 'bg-yellow-100' : 'bg-blue-100'}`}>
                <Bell className={`w-5 h-5 ${push.level === 'URGENT' ? 'text-red-600' : push.level === 'WARNING' ? 'text-yellow-600' : 'text-blue-600'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{push.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${push.level === 'URGENT' ? 'bg-red-100 text-red-700' : push.level === 'WARNING' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                    {push.level}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{push.body}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>Destino: <strong>{push.targetType}</strong></span>
                  <span>{push._count?.reads || 0} leituras</span>
                  <span>{formatDateTime(push.createdAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {showPushModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Criar Push Notification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Título *</label>
                <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Mensagem *</label>
                <textarea
                  className="w-full min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  value={form.body}
                  onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Link (opcional)</label>
                <Input
                  placeholder="https://..."
                  value={form.link}
                  onChange={(event) => setForm((current) => ({ ...current, link: event.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Nível</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.level}
                    onChange={(event) => setForm((current) => ({ ...current, level: event.target.value }))}
                  >
                    <option value="INFO">Informação</option>
                    <option value="WARNING">Aviso</option>
                    <option value="URGENT">Urgente</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Destinatário</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.targetType}
                    onChange={(event) => setForm((current) => ({ ...current, targetType: event.target.value, targetId: '' }))}
                  >
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
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.targetId}
                    onChange={(event) => setForm((current) => ({ ...current, targetId: event.target.value }))}
                  >
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
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Digite nome ou email..."
                  />

                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {userSearch.trim() && searchResults?.users?.length > 0 ? (
                      searchResults.users.map((userItem: any) => (
                        <button
                          key={userItem.id}
                          type="button"
                          className="w-full text-left p-2 border rounded hover:bg-blue-50 transition-colors text-sm"
                          onClick={() => {
                            setForm((current) => ({ ...current, targetId: userItem.id }))
                            setUserSearch(userItem.name)
                          }}
                        >
                          <div className="font-medium">{userItem.name}</div>
                          <div className="text-xs text-gray-500">{userItem.email} - {userItem.role}</div>
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
                        <button
                          type="button"
                          onClick={() => {
                            setForm((current) => ({ ...current, targetId: '' }))
                            setUserSearch('')
                          }}
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowPushModal(false)}>Cancelar</Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.title || !form.body}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Enviar Push
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Enviar Push por Planilha (CSV)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-2">
                <p>Baixe o modelo para evitar erro de cabeçalho. A coluna obrigatória é <strong>email</strong>.</p>
                <a href="/push-contacts-template.csv" download className="inline-flex items-center gap-2 text-primary hover:underline">
                  <Download className="w-4 h-4" /> Baixar template CSV
                </a>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Título *</label>
                <Input value={csvForm.title} onChange={(event) => setCsvForm((current) => ({ ...current, title: event.target.value }))} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Mensagem *</label>
                <textarea
                  className="w-full min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  value={csvForm.body}
                  onChange={(event) => setCsvForm((current) => ({ ...current, body: event.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Link (opcional)</label>
                <Input
                  placeholder="https://..."
                  value={csvForm.link}
                  onChange={(event) => setCsvForm((current) => ({ ...current, link: event.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Nível</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={csvForm.level}
                  onChange={(event) => setCsvForm((current) => ({ ...current, level: event.target.value }))}
                >
                  <option value="INFO">Informação</option>
                  <option value="WARNING">Aviso</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Arquivo CSV *</label>
                <input
                  ref={csvFileRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
                />
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => csvFileRef.current?.click()} className="gap-2">
                    <Upload className="w-4 h-4" /> {csvFile ? csvFile.name : 'Selecionar arquivo'}
                  </Button>
                  {csvFile && (
                    <button type="button" onClick={() => setCsvFile(null)}>
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>

              {csvResult && (
                <div className="space-y-2 rounded-md border p-3 bg-gray-50 text-sm">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-4 h-4" />
                    <span><strong>{csvResult.matched.length}</strong> usuário(s) encontrado(s) e notificado(s)</span>
                  </div>
                  {csvResult.matched.length > 0 && (
                    <div className="text-xs text-muted-foreground pl-6">
                      {csvResult.matched.map((matchedUser) => matchedUser.name || matchedUser.email).join(', ')}
                    </div>
                  )}
                  {csvResult.notFound.length > 0 && (
                    <div className="flex items-start gap-2 text-yellow-700">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span><strong>{csvResult.notFound.length}</strong> email(s) não encontrado(s): {csvResult.notFound.join(', ')}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCsvModal(false)
                    setCsvFile(null)
                    setCsvResult(null)
                  }}
                >
                  Fechar
                </Button>
                <Button onClick={sendCsvPush} disabled={csvLoading || !csvFile || !csvForm.title || !csvForm.body} className="gap-2">
                  {csvLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Enviar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
