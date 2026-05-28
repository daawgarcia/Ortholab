import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Loader2, ArrowRight, Archive, CheckCircle, Package, FileText, UserPlus, Box, PlayCircle } from 'lucide-react'
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
  PLANNING_FORM: 'Ficha de Planejamento',
  COMPLETION_FORM: 'Ficha de Finalização',
  OTHER_SERVICES_FORM: 'Ficha de Novos Produtos',
  STL_FILE: 'Arquivo STL',
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
    queryFn: () => api.get('/entries?limit=100').then(r => r.data),
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-500 uppercase">Entradas</h1>
        <div className="flex gap-4 text-sm">
          <div className="bg-blue-50 px-4 py-2 rounded-lg">
            <span className="text-blue-600 font-semibold">{stats?.pending || 0}</span>
            <span className="text-gray-500 ml-1">Pendentes</span>
          </div>
          <div className="bg-yellow-50 px-4 py-2 rounded-lg">
            <span className="text-yellow-600 font-semibold">{stats?.processing || 0}</span>
            <span className="text-gray-500 ml-1">Com Caixa Aberta</span>
          </div>
          <div className="bg-green-50 px-4 py-2 rounded-lg">
            <span className="text-green-600 font-semibold">{stats?.totalToday || 0}</span>
            <span className="text-gray-500 ml-1">Hoje</span>
          </div>
        </div>
      </div>

      {/* Tabela de Entradas */}
      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dentista</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paciente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Caixa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Último STL</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entrada em</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </td>
                </tr>
              )}
              {!isLoading && entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                    Nenhuma entrada pendente
                  </td>
                </tr>
              )}
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{entry.dentist.name}</p>
                      {entry.dentist.clinic && (
                        <p className="text-xs text-gray-500">{entry.dentist.clinic}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/patients/${entry.patientId}`)}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {entry.patient.name}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {entry.boxNumber ? (
                      <span className="text-sm text-gray-900 font-mono font-semibold">
                        {entry.boxNumber}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                        Criar caixa
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{entryTypeIcons[entry.entryType]}</span>
                      <span className="text-sm text-gray-600">{entryTypeLabels[entry.entryType]}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{formatDate(entry.lastStlDate)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{formatDateTime(entry.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {!entry.boxNumber ? (
                        // Sem caixa - mostrar botão para criar
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                          onClick={() => {
                            setSelectedEntry(entry)
                            setCreateBoxDialogOpen(true)
                          }}
                        >
                          <CheckCircle className="w-3 h-3" />
                          Criar Caixa
                        </Button>
                      ) : entry.status === 'PENDING' || entry.status === 'PROCESSING' ? (
                        // Com caixa - mostrar botão para iniciar workflow
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs"
                          onClick={() => {
                            setSelectedEntry(entry)
                            setWorkflowDialogOpen(true)
                          }}
                        >
                          <PlayCircle className="w-3 h-3" />
                          Iniciar Workflow
                        </Button>
                      ) : entry.status === 'COMPLETED' && entry.case ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-primary"
                          onClick={() => navigate(`/cases/${entry.case?.id}`)}
                        >
                          Ver Caso
                        </Button>
                      ) : null}
                      
                      {(entry.status === 'PENDING' || entry.status === 'PROCESSING') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-gray-400 hover:text-gray-600"
                          onClick={() => archiveMutation.mutate(entry.id)}
                          disabled={archiveMutation.isPending}
                        >
                          <Archive className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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