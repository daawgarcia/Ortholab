import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Loader2, Archive, CheckCircle, Package, FileText, UserPlus, Box, PlayCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

interface Entry {
  id: string
  patientId: string
  dentistId: string
  caseId: string | null
  entryType: 'NEW_PATIENT' | 'PLANNING_FORM' | 'COMPLETION_FORM' | 'OTHER_SERVICES_FORM' | 'STL_FILE'
  boxNumber: string | null
  lastStlDate: string | null
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ARCHIVED'
  createdAt: string
  processedAt: string | null
  notes: string | null
  patient: { id: string; name: string }
  dentist: { id: string; name: string; clinic: string | null }
  case?: { id: string; caseNumber: number; status: string } | null
}

const entryTypeLabels: Record<string, string> = {
  NEW_PATIENT: 'Novo Paciente',
  PLANNING_FORM: 'Ficha de planejamento',
  COMPLETION_FORM: 'Ficha de finalização',
  OTHER_SERVICES_FORM: 'Ficha de novos produtos',
  STL_FILE: 'Modelos STL',
}

const entryTypeIcons: Record<string, React.ReactNode> = {
  NEW_PATIENT: <UserPlus className="w-4 h-4" />,
  PLANNING_FORM: <FileText className="w-4 h-4" />,
  COMPLETION_FORM: <FileText className="w-4 h-4" />,
  OTHER_SERVICES_FORM: <Box className="w-4 h-4" />,
  STL_FILE: <Package className="w-4 h-4" />,
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('pt-BR')
}

function formatDateTime(d: string | null) {
  if (!d) return '-'
  const date = new Date(d)
  return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

export function EntriesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [createBoxDialogOpen, setCreateBoxDialogOpen] = useState(false)
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['entries'],
    queryFn: () => api.get('/entries?limit=10000').then(r => r.data),
  })

  const entries: Entry[] = data?.entries || []

  const { data: stats } = useQuery({
    queryKey: ['entries-stats'],
    queryFn: () => api.get('/entries/stats/summary').then(r => r.data),
  })

  // Mutação para criar caixa (abrir caixa no TOTVS)
  const createBoxMutation = useMutation({
    mutationFn: (entryId: string) => api.post(`/entries/${entryId}/create-box`).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['entries'] })
      toast({ title: `Caixa ${data.boxNumber} criada com sucesso!` })
      setCreateBoxDialogOpen(false)
      setSelectedEntry(null)
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Erro ao criar caixa', description: err?.response?.data?.error || 'Tente novamente' })
    },
  })

  // Mutação para iniciar workflow (processar entrada)
  const startWorkflowMutation = useMutation({
    mutationFn: (entryId: string) => api.post(`/entries/${entryId}/start-workflow`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] })
      qc.invalidateQueries({ queryKey: ['entries-stats'] })
      toast({ title: 'Workflow iniciado com sucesso!' })
      setWorkflowDialogOpen(false)
      setSelectedEntry(null)
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Erro', description: err?.response?.data?.error || 'Falha ao iniciar workflow' })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (entryId: string) => api.post(`/entries/${entryId}/archive`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] })
      toast({ title: 'Entrada arquivada' })
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Erro', description: err?.response?.data?.error || 'Falha ao arquivar' })
    },
  })

  const handleCreateBox = () => {
    if (!selectedEntry) return
    createBoxMutation.mutate(selectedEntry.id)
  }

  const handleStartWorkflow = () => {
    if (!selectedEntry) return
    startWorkflowMutation.mutate(selectedEntry.id)
  }

  const [busca, setBusca] = useState('')
  const termo = busca.trim().toLowerCase()
  const visiveis = termo
    ? entries.filter(e => [e.patient.name, e.dentist.name, e.boxNumber].filter(Boolean).some(v => v!.toLowerCase().includes(termo)))
    : entries

  return (
    <div className="-m-6 p-4 h-[calc(100vh-4rem)] flex flex-col gap-3">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold text-gray-900">Entradas</h1>
          <p className="text-sm text-gray-500">Envios de dentistas aguardando abertura de workflow • mais antigos no topo</p>
        </div>
        <div className="flex gap-2">
          {[
            { n: stats?.pending ?? entries.length, label: 'Pendentes', cls: 'text-sky-700' },
            { n: entries.filter(e => !e.boxNumber).length, label: 'Sem caixa', cls: 'text-amber-700' },
            { n: stats?.totalToday || 0, label: 'Hoje', cls: 'text-emerald-700' },
          ].map(c => (
            <div key={c.label} className="rounded-lg bg-white ring-1 ring-gray-200 px-3 py-1.5 text-center min-w-[84px]">
              <p className={`text-lg font-semibold leading-tight tabular-nums ${c.cls}`}>{c.n}</p>
              <p className="text-[11px] text-gray-500">{c.label}</p>
            </div>
          ))}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Paciente, dentista ou caixa"
            className="h-9 w-60 rounded-md border border-gray-200 bg-white pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl bg-white ring-1 ring-gray-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur border-b">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-4 py-2.5">Último envio</th>
              <th className="px-4 py-2.5">Dentista</th>
              <th className="px-4 py-2.5">Paciente</th>
              <th className="px-4 py-2.5">Caixa</th>
              <th className="px-4 py-2.5">Enviado</th>
              <th className="px-4 py-2.5 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
            )}
            {!isLoading && visiveis.length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-400">Nenhuma entrada pendente</td></tr>
            )}
            {visiveis.map(entry => {
              const quando = entry.lastStlDate || entry.createdAt
              const dias = Math.max(0, Math.floor((Date.now() - new Date(quando).getTime()) / 86400000))
              return (
                <tr key={entry.id} className="group hover:bg-gray-50/80">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <p className="font-medium text-gray-900 tabular-nums">{formatDateTime(quando)}</p>
                    <p className={`text-[11px] ${dias >= 7 ? 'text-rose-600' : 'text-gray-500'}`}>
                      {dias === 0 ? 'hoje' : dias === 1 ? 'há 1 dia' : `há ${dias} dias`}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 max-w-[260px]">
                    <p className="truncate font-medium text-gray-800" title={entry.dentist.name}>{entry.dentist.name}</p>
                    {entry.dentist.clinic && <p className="truncate text-[11px] text-gray-500">{entry.dentist.clinic}</p>}
                  </td>
                  <td className="px-4 py-2.5 max-w-[280px]">
                    <button onClick={() => navigate(`/patients/${entry.patientId}`)}
                      className="truncate max-w-full text-left font-medium text-primary hover:underline" title={entry.patient.name}>
                      {entry.patient.name}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {entry.boxNumber
                      ? <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[13px] font-semibold text-gray-800">{entry.boxNumber}</span>
                      : <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">sem caixa</span>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-gray-600">
                      <span className="text-gray-400">{entryTypeIcons[entry.entryType]}</span>
                      {entryTypeLabels[entry.entryType]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {!entry.boxNumber ? (
                        <Button size="sm" variant="outline"
                          className="h-8 gap-1 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                          onClick={() => { setSelectedEntry(entry); setCreateBoxDialogOpen(true) }}>
                          <CheckCircle className="w-3.5 h-3.5" /> Criar caixa
                        </Button>
                      ) : (entry.status === 'PENDING' || entry.status === 'PROCESSING') ? (
                        <Button size="sm" className="h-8 gap-1 text-xs"
                          onClick={() => { setSelectedEntry(entry); setWorkflowDialogOpen(true) }}>
                          <PlayCircle className="w-3.5 h-3.5" /> Iniciar workflow
                        </Button>
                      ) : entry.status === 'COMPLETED' && entry.case ? (
                        <Button size="sm" variant="ghost" className="h-8 text-xs text-primary"
                          onClick={() => navigate(`/cases/${entry.case?.id}`)}>Ver caso</Button>
                      ) : null}
                      {(entry.status === 'PENDING' || entry.status === 'PROCESSING') && (
                        <Button size="sm" variant="ghost" title="Arquivar"
                          className="h-8 w-8 p-0 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-700"
                          onClick={() => archiveMutation.mutate(entry.id)} disabled={archiveMutation.isPending}>
                          <Archive className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Dialog de Criar Caixa */}
      <Dialog open={createBoxDialogOpen} onOpenChange={setCreateBoxDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Caixa</DialogTitle>
            <DialogDescription>
              {selectedEntry && (
                <>
                  Abrir caixa no TOTVS para: <span className="font-medium">{selectedEntry.patient.name}</span>
                  <br />
                  <span className="text-xs text-gray-500">
                    O número da caixa será gerado automaticamente pela integração TOTVS.
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>Atenção:</strong> Ao confirmar, uma nova caixa será aberta no sistema TOTVS 
                com número sequencial automático.
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setCreateBoxDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateBox}
                disabled={createBoxMutation.isPending}
                className="gap-1 bg-amber-600 hover:bg-amber-700"
              >
                {createBoxMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Confirmar e Criar Caixa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Iniciar Workflow */}
      <Dialog open={workflowDialogOpen} onOpenChange={setWorkflowDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Iniciar Workflow</DialogTitle>
            <DialogDescription>
              {selectedEntry && (
                <>
                  Mover <span className="font-medium">{selectedEntry.patient.name}</span> para o workflow
                  {selectedEntry.boxNumber && (
                    <span className="block mt-1 text-xs text-gray-500">
                      Caixa: <span className="font-mono font-semibold">{selectedEntry.boxNumber}</span>
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                O caso será movido para a etapa inicial do workflow (Recebimento dos modelos).
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setWorkflowDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleStartWorkflow}
                disabled={startWorkflowMutation.isPending}
                className="gap-1"
              >
                {startWorkflowMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PlayCircle className="w-4 h-4" />
                )}
                Iniciar Workflow
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}