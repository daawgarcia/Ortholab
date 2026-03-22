import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Plus } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { StatusBadge } from '@/components/status-badge'

const TABS = ['Workflow', 'Fotos', 'Fotos Restritas', 'Modelos Digitais', 'Relatório', 'Fichas', 'Ficha Clínica']

const WORKFLOW_STAGES = [
  { n: 1, label: 'Recebimento dos modelos' },
  { n: 2, label: 'Preparo dos modelos' },
  { n: 3, label: 'Movimento' },
  { n: 4, label: 'Status de aprovação enviado' },
  { n: 5, label: 'Caso aprovado para produção' },
  { n: 6, label: 'Tipo de faturamento' },
  { n: 7, label: 'Impressão 3D' },
  { n: 8, label: 'Recorte acabamento' },
  { n: 9, label: 'Postagem dos alinhadores' },
]

function WorkflowTab({ cases, patientId }: { cases: any[]; patientId: string }) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [workflowTab, setWorkflowTab] = useState<'Em Aberto' | 'Concluídos'>('Em Aberto')
  const openCases = cases.filter(c => c.status !== 'COMPLETED')
  const completedCases = cases.filter(c => c.status === 'COMPLETED')
  const [selectedCase, setSelectedCase] = useState<string>(openCases[0]?.id || '')
  const [notes, setNotes] = useState('')
  const [billingForm, setBillingForm] = useState<any>({})

  const canStartWorkflow = user?.role !== 'DENTIST'

  const startWorkflowMutation = useMutation({
    mutationFn: () => api.post(`/patients/${patientId}/open-workflow`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', patientId] })
      toast({ title: 'Fluxo iniciado', description: 'Recebimento dos modelos registrado com sucesso.' })
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Não foi possível iniciar o fluxo'
      toast({ variant: 'destructive', title: 'Erro', description: message })
    },
  })

  const { data: workflowData } = useQuery({
    queryKey: ['workflow', selectedCase],
    queryFn: () => api.get(`/workflow/case/${selectedCase}`).then(r => r.data),
    enabled: workflowTab === 'Em Aberto' && !!selectedCase,
  })

  // keep selected in sync with open cases list
  useEffect(() => {
    if (workflowTab === 'Em Aberto' && openCases.length && !openCases.some(c => c.id === selectedCase)) {
      setSelectedCase(openCases[0].id)
    }
  }, [workflowTab, openCases, selectedCase])

  const advanceMutation = useMutation({
    mutationFn: () => api.post(`/workflow/case/${selectedCase}/advance`, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow', selectedCase] })
      setNotes('')
      toast({ title: 'Etapa salva com sucesso', description: 'O caso foi avançado no fluxo.' })
    },
  })

  const billingMutation = useMutation({
    mutationFn: () => api.patch(`/workflow/case/${selectedCase}/billing`, billingForm),
    onSuccess: () => toast({ title: 'Faturamento atualizado' }),
  })

  const caseData = workflowData?.case
  const events = caseData?.workflowEvents || []
  const currentStage = events[events.length - 1]?.stage || 0
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'LAB_TECH' || user?.role === 'FINANCIAL'

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['Em Aberto', 'Concluídos'].map(tab => (
          <button
            key={tab}
            onClick={() => setWorkflowTab(tab as 'Em Aberto' | 'Concluídos')}
            className={`px-4 py-2 text-sm rounded-lg font-medium border transition ${workflowTab === tab ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {workflowTab === 'Concluídos' ? (
        <div className="space-y-3">
          {completedCases.length === 0 ? (
            <div className="p-6 text-center bg-yellow-50 border border-yellow-200 rounded-lg">Nenhum fluxo concluído ainda.</div>
          ) : (
            completedCases.map((c: any) => (
              <div key={c.id} className="border rounded-lg bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-semibold">Caso #{c.caseNumber} - {c.productType || c.service?.name || 'Caso'}</div>
                    <div className="text-xs text-gray-500">Concluído em {new Date(c.updatedAt).toLocaleDateString('pt-BR')}</div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <p className="text-xs text-gray-600">Último evento: {c.workflowEvents?.[0]?.stage} - {c.workflowEvents?.[0]?.notes || 'Sem notas'}</p>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          {openCases.length === 0 ? (
            <div className="p-6 space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg text-blue-700 p-4">Nenhum fluxo em aberto. Registre o recebimento dos modelos para iniciar o processo.</div>
              {canStartWorkflow ? (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => startWorkflowMutation.mutate()}
                  disabled={startWorkflowMutation.isLoading}
                >
                  {startWorkflowMutation.isLoading ? 'Registrando...' : 'Registrar recebimento e iniciar fluxo'}
                </Button>
              ) : (
                <div className="text-sm text-gray-500">Apenas administradores/funcionários podem iniciar o fluxo.</div>
              )}
            </div>
          ) : (
            <>
              {openCases.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {openCases.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCase(c.id)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${selectedCase === c.id ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 hover:border-primary/50'}`}
                    >
                      #{c.caseNumber} — {c.productType || c.service?.name || 'Caso'}
                    </button>
                  ))}
                </div>
              )}

              {caseData && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                    <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">Pipeline — Caso #{caseData.caseNumber}</p>
                      <StatusBadge status={caseData.status} />
                    </div>
                    <div className="divide-y">
                      {WORKFLOW_STAGES.map(s => {
                        const event = events.find((e: any) => e.stage === s.n)
                        const done = !!event
                        const current = currentStage + 1 === s.n
                        return (
                          <div key={s.n} className={`flex items-center gap-3 px-4 py-2.5 ${done ? 'bg-green-50' : current ? 'bg-blue-50' : ''}`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done ? 'bg-green-500 text-white' : current ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>{s.n}</div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium ${done ? 'text-green-700' : current ? 'text-primary' : 'text-gray-400'}`}>{s.label}</p>
                              {event && <p className="text-xs text-gray-400">{event.performer?.name} · {new Date(event.createdAt).toLocaleDateString('pt-BR')}</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {isAdmin && currentStage < WORKFLOW_STAGES.length && (
                      <div className="p-4 space-y-2 border-t bg-gray-50">
                        <textarea
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          className="w-full border rounded text-xs px-3 py-2 resize-none"
                          rows={2}
                          placeholder="Observações (opcional)"
                        />
                        <Button size="sm" className="w-full" onClick={() => advanceMutation.mutate()} disabled={advanceMutation.isPending}>
                          {advanceMutation.isPending ? 'Avançando...' : `Avançar: ${WORKFLOW_STAGES.find(s => s.n === currentStage + 1)?.label || 'Próxima Etapa'}`}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {isAdmin && caseData?.status === 'APPROVED' && (
                      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b bg-gray-50">
                          <p className="text-sm font-semibold text-gray-700">Faturamento</p>
                        </div>
                        <div className="p-4 space-y-3">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Tipo *</label>
                            <div className="flex gap-3">
                              {['Unidade', 'MID', 'FULL'].map(t => (
                                <label key={t} className="flex items-center gap-1.5 cursor-pointer text-sm">
                                  <input type="radio" checked={billingForm.billingType === t} onChange={() => setBillingForm((f: any) => ({ ...f, billingType: t }))} className="accent-primary" />
                                  {t}
                                </label>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Parcelas</label>
                            <select className="w-full border rounded px-2 py-1.5 text-sm" value={billingForm.installmentOption || ''} onChange={e => setBillingForm((f: any) => ({ ...f, installmentOption: e.target.value }))}>
                              <option value="">Selecione</option>
                              {['1x', '2x', '3x', '4x', '5x', '6x', '10x', '12x', '18x', '24x'].map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-6">
                            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                              <input type="checkbox" checked={!!billingForm.dropoutInsurance} onChange={e => setBillingForm((f: any) => ({ ...f, dropoutInsurance: e.target.checked }))} className="accent-primary" />
                              Seguro de Abandono
                            </label>
                            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                              <input type="checkbox" checked={!!billingForm.packActive} onChange={e => setBillingForm((f: any) => ({ ...f, packActive: e.target.checked }))} className="accent-primary" />
                              Pack Ativo
                            </label>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Cupom de Desconto</label>
                            <input className="w-full border rounded px-2 py-1.5 text-sm" value={billingForm.discountCoupon || ''} onChange={e => setBillingForm((f: any) => ({ ...f, discountCoupon: e.target.value }))} placeholder="CUPOM" />
                          </div>
                          <Button size="sm" className="w-full" onClick={() => billingMutation.mutate()}>Salvar Faturamento</Button>
                        </div>
                      </div>
                    )}

                    {caseData?.planningFormData && (
                      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b bg-gray-50">
                          <p className="text-sm font-semibold text-gray-700">Ficha de Planejamento</p>
                        </div>
                        <div className="p-4">
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">{JSON.stringify(caseData.planningFormData, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function PhotosTab({ patientId, isPrivate }: { patientId: string; isPrivate?: boolean }) {
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const { data } = useQuery({
    queryKey: ['patient-photos', patientId, isPrivate],
    queryFn: () => api.get(`/patients/${patientId}/photos?isPrivate=${!!isPrivate}`).then(r => r.data),
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    const formData = new FormData()
    Array.from(files).forEach(f => formData.append('files', f))
    formData.append('isPrivate', String(!!isPrivate))
    try {
      await api.post(`/patients/${patientId}/photos`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      qc.invalidateQueries({ queryKey: ['patient-photos', patientId] })
    } catch { toast({ variant: 'destructive', title: 'Erro ao enviar fotos' }) }
    finally { setUploading(false) }
  }

  const photos = data?.photos || []

  return (
    <div className="space-y-4">
      <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-colors hover:bg-gray-50 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <Plus className="w-4 h-4" />
        {uploading ? 'Enviando...' : `Adicionar ${isPrivate ? 'Fotos Restritas' : 'Fotos'}`}
        <input type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
      </label>
      {photos.length === 0 && <p className="text-sm text-gray-400 py-4">Nenhuma foto</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((p: any) => (
          <a key={p.id} href={p.url} target="_blank" rel="noreferrer"
            className="aspect-square rounded-lg overflow-hidden border bg-gray-100 hover:opacity-90 transition-opacity">
            <img src={p.url} alt={p.filename} className="w-full h-full object-cover" />
          </a>
        ))}
      </div>
    </div>
  )
}

function FilesTab({ patientId, type }: { patientId: string; type: 'stl' | 'work' }) {
  const qc = useQueryClient()
  const endpoint = type === 'stl' ? 'digital-models' : 'work-files'
  const [uploading, setUploading] = useState(false)
  const [kind, setKind] = useState('upper')

  const { data } = useQuery({
    queryKey: ['patient-files', patientId, type],
    queryFn: () => api.get(`/patients/${patientId}/${endpoint}`).then(r => r.data),
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    if (type === 'stl') formData.append('kind', kind)
    try {
      await api.post(`/patients/${patientId}/${endpoint}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      qc.invalidateQueries({ queryKey: ['patient-files', patientId, type] })
    } catch { toast({ variant: 'destructive', title: 'Erro ao enviar arquivo' }) }
    finally { setUploading(false) }
  }

  const files = data?.files || []

  return (
    <div className="space-y-4">
      {type === 'stl' && (
        <div className="flex gap-3 items-center">
          {['upper', 'lower'].map(k => (
            <label key={k} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" checked={kind === k} onChange={() => setKind(k)} className="accent-primary" />
              {k === 'upper' ? 'Superior' : 'Inferior'}
            </label>
          ))}
        </div>
      )}
      <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm font-medium hover:bg-gray-50 ${uploading ? 'opacity-50' : ''}`}>
        <Plus className="w-4 h-4" />
        {uploading ? 'Enviando...' : type === 'stl' ? 'Enviar arquivo STL' : 'Enviar arquivo de trabalho'}
        <input type="file" accept={type === 'stl' ? '.stl,.obj,.zip' : '*'} className="hidden" onChange={handleUpload} disabled={uploading} />
      </label>
      {files.length === 0 && <p className="text-sm text-gray-400 py-4">Nenhum arquivo</p>}
      <div className="space-y-2">
        {files.map((f: any) => (
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer"
            className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
            <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center text-xs font-bold text-primary">
              {type === 'stl' ? (f.kind === 'upper' ? 'SUP' : 'INF') : 'ARQ'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{f.filename}</p>
              <p className="text-xs text-gray-400">{new Date(f.createdAt).toLocaleDateString('pt-BR')}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

function FormsTab({ patientId }: { patientId: string }) {
  const navigate = useNavigate()
  const { data: planning } = useQuery({
    queryKey: ['forms-planning', patientId],
    queryFn: () => api.get(`/forms/planning/${patientId}`).then(r => r.data),
  })
  const { data: completion } = useQuery({
    queryKey: ['forms-completion', patientId],
    queryFn: () => api.get(`/forms/completion/${patientId}`).then(r => r.data),
  })
  const { data: otherServices } = useQuery({
    queryKey: ['forms-other-services', patientId],
    queryFn: () => api.get(`/forms/other-services/${patientId}`).then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <FormSection title="Fichas de Planejamento" items={planning} onAdd={() => navigate(`/patients/${patientId}/forms/planning/new`)} />
      <FormSection title="Fichas de Finalização" items={completion} onAdd={() => navigate(`/patients/${patientId}/forms/completion/new`)} />
      <FormSection title="Outros Serviços (EA GUARD / SPLINT / MIO / AIR)" items={otherServices} onAdd={() => navigate(`/patients/${patientId}/forms/other-services/new`)} />
    </div>
  )
}

function FormSection({ title, items, onAdd }: { title: string; items: any[]; onAdd: () => void }) {
  return (
    <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        <Button size="sm" variant="outline" onClick={onAdd} className="gap-1"><Plus className="w-3 h-3" /> Nova Ficha</Button>
      </div>
      <div className="divide-y">
        {(!items || items.length === 0) && (
          <p className="px-5 py-4 text-sm text-gray-400">Nenhuma ficha</p>
        )}
        {items?.map((f: any) => (
          <div key={f.id} className="px-5 py-3 flex items-center justify-between text-sm">
            <span className="text-gray-700">{new Date(f.createdAt).toLocaleDateString('pt-BR')} — {f.dentist?.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ClinicalRecordsTab({ patientId }: { patientId: string }) {
  const navigate = useNavigate()
  const { data } = useQuery({
    queryKey: ['clinical-records', patientId],
    queryFn: () => api.get(`/clinical-records?patientId=${patientId}`).then(r => r.data),
  })
  const records = data?.records || []

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => navigate(`/patients/${patientId}/clinical-records/new`)} className="gap-1">
          <Plus className="w-3 h-3" /> Nova Ficha Clínica
        </Button>
      </div>
      {records.length === 0 && <p className="text-sm text-gray-400 py-4">Nenhuma ficha clínica</p>}
      <div className="border rounded-lg bg-white shadow-sm divide-y">
        {records.map((r: any) => (
          <div key={r.id} className="px-5 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{new Date(r.consultationAt).toLocaleDateString('pt-BR')}</span>
              <span className="text-xs text-gray-400">{r.dentist?.name}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{r.evaluation}</p>
            {r.observations && <p className="text-xs text-gray-400 mt-0.5">{r.observations}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PatientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('Workflow')
  const { user } = useAuthStore()
  const isAdminOrSupport = user?.role !== 'DENTIST'

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => api.get(`/patients/${id}`).then(r => r.data),
  })

  if (isLoading) return <div className="p-6 text-gray-400">Carregando...</div>
  if (!patient) return <div className="p-6 text-red-500">Paciente não encontrado</div>

  const isCreatorDentist = user?.role === 'DENTIST' && patient.dentistId === user.id
  const tabs = isAdminOrSupport
    ? TABS
    : isCreatorDentist
      ? ['Workflow', 'Fotos', 'Modelos Digitais', 'Fichas', 'Ficha Clínica']
      : ['Workflow', 'Fotos', 'Fichas', 'Ficha Clínica']

  const activeCase = patient.cases?.find(c => c.totvsOrderId)

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/patients')} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{patient.name}</h1>
          <p className="text-sm text-gray-400">{patient.dentist?.name}{patient.dentist?.clinic ? ` · ${patient.dentist.clinic}` : ''}</p>
          {activeCase?.totvsOrderId && <p className="text-sm text-blue-600 font-medium">Nº de Caixa: {activeCase.totvsOrderId}</p>}
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => navigate(`/patients/${id}/edit`)}>Editar</Button>
      </div>

      <div className="border-b flex gap-0 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'Workflow' && <WorkflowTab cases={patient.cases || []} patientId={id!} />}
        {activeTab === 'Fotos' && <PhotosTab patientId={id!} />}
        {activeTab === 'Fotos Restritas' && <PhotosTab patientId={id!} isPrivate />}
        {activeTab === 'Modelos Digitais' && <FilesTab patientId={id!} type="stl" />}
        {activeTab === 'Relatório' && <FilesTab patientId={id!} type="work" />}
        {activeTab === 'Fichas' && <FormsTab patientId={id!} />}
        {activeTab === 'Ficha Clínica' && <ClinicalRecordsTab patientId={id!} />}
      </div>
    </div>
  )
}
