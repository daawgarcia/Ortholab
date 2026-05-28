import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'
import { ensureSelectedServiceInList, filterServicesForProduct, getAllowedInstallments, getServiceDisplayName, inferProductType, isAlignerType, normalizeServiceKind, sortBillingServices } from '@/lib/billing'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRightLeft, ChevronLeft, FileText, Plus, Trash2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { StatusBadge } from '@/components/status-badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

function isVideoFile(filename: string) {
  return /\.(mp4|webm|mov)$/i.test(filename)
}

const TABS = ['Workflow', 'Fotos', 'Fotos Restritas', 'Modelos Digitais', 'Relatório', 'Checagem Virtual 3D', 'Fichas', 'Ficha Clínica', 'Informações Importantes']
const DENTIST_TABS = ['Workflow', 'Fotos', 'Modelos Digitais', 'Relatório', 'Checagem Virtual 3D', 'Fichas', 'Ficha Clínica']
const IMPORTANT_NOTES_POPUP_ROLES = ['ADMIN', 'LAB_TECH', 'FINANCIAL']
const PRODUCT_TYPE_LABELS: Record<string, string> = {
  ALINHADORES: 'Alinhadores',
  FINALIZACAO: 'Contenção',
  PLACA_MIORRELAXANTE: 'Placa Miorrelaxante',
  EA_AIR2: 'EA Air²',
}

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
  const draftCases = cases.filter(c => ['DRAFT', 'SUBMITTED'].includes(c.status) && (!c.workflowEvents || c.workflowEvents.length === 0))
  const openCases = cases.filter(c => !['COMPLETED', 'DRAFT', 'SUBMITTED'].includes(c.status))
  const completedCases = cases.filter(c => c.status === 'COMPLETED')
  const [selectedCase, setSelectedCase] = useState<string>(openCases[0]?.id || '')
  const [notes, setNotes] = useState('')
  const [revisionNotes, setRevisionNotes] = useState('')
  const [billingForm, setBillingForm] = useState<any>({})

  const canStartWorkflow = user?.role === 'ADMIN' || user?.role === 'LAB_TECH' || user?.role === 'FINANCIAL'
  const canApproveForDentist = user?.role === 'ADMIN' || user?.role === 'SELLER'

  const invalidateRelatedQueries = () => {
    qc.invalidateQueries({ queryKey: ['patient', patientId] })
    qc.invalidateQueries({ queryKey: ['cases-summary'] })
    qc.invalidateQueries({ queryKey: ['admin-stats'] })
    qc.invalidateQueries({ queryKey: ['seller-cases'] })
    qc.invalidateQueries({ queryKey: ['financial'] })
    qc.invalidateQueries({ queryKey: ['dentist-invoices'] })
  }

  const { data: servicesData } = useQuery({
    queryKey: ['services-billing-options'],
    queryFn: () => api.get('/services').then(r => r.data),
  })

  const startWorkflowMutation = useMutation({
    mutationFn: () => api.post(`/patients/${patientId}/open-workflow`),
    onSuccess: () => {
      invalidateRelatedQueries()
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

  useEffect(() => {
    if (workflowTab === 'Em Aberto' && openCases.length && !openCases.some(c => c.id === selectedCase)) {
      setSelectedCase(openCases[0].id)
    }
  }, [workflowTab, openCases, selectedCase])

  const advanceMutation = useMutation({
    mutationFn: () => api.post(`/workflow/case/${selectedCase}/advance`, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow', selectedCase] })
      invalidateRelatedQueries()
      setNotes('')
      toast({ title: 'Etapa salva com sucesso', description: 'O caso foi avançado no fluxo.' })
    },
  })

  const billingMutation = useMutation({
    mutationFn: () => api.patch(`/workflow/case/${selectedCase}/billing`, billingForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow', selectedCase] })
      invalidateRelatedQueries()
      toast({ title: 'Faturamento atualizado' })
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Erro', description: error?.response?.data?.error || 'Falha ao atualizar faturamento' })
    },
  })

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/workflow/case/${selectedCase}/approve`, billingForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow', selectedCase] })
      invalidateRelatedQueries()
      toast({ title: 'Caso aprovado', description: 'O workflow seguiu para Impressão 3D.' })
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Erro', description: error?.response?.data?.error || 'Falha ao aprovar caso' })
    },
  })

  const revisionMutation = useMutation({
    mutationFn: () => api.post(`/cases/${selectedCase}/request-revision`, { notes: revisionNotes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow', selectedCase] })
      invalidateRelatedQueries()
      setRevisionNotes('')
      toast({ title: 'Revisão solicitada' })
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Erro', description: error?.response?.data?.error || 'Falha ao solicitar revisão' })
    },
  })

  const caseData = workflowData?.case
  const events = caseData?.workflowEvents || []
  const currentStage = events[events.length - 1]?.stage || 0
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'LAB_TECH' || user?.role === 'FINANCIAL'
  const canManageBilling = ['ADMIN', 'LAB_TECH', 'FINANCIAL'].includes(user?.role || '')
  const availableServices = servicesData?.services || []
  const effectiveProductType = useMemo(
    () => inferProductType(caseData?.productType, caseData?.planningFormData, caseData?.service, caseData?.billingType),
    [caseData?.productType, caseData?.planningFormData, caseData?.service, caseData?.billingType],
  )
  const filteredServices = useMemo(() => filterServicesForProduct(availableServices, effectiveProductType), [availableServices, effectiveProductType])
  const orderedServices = useMemo(() => sortBillingServices(filteredServices), [filteredServices])
  const serviceOptions = useMemo(() => ensureSelectedServiceInList(orderedServices, caseData?.service), [orderedServices, caseData?.service])
  const selectedService = useMemo(() => {
    return serviceOptions.find((service: any) => service.id === billingForm.serviceId)
      || serviceOptions.find((service: any) => service.id === caseData?.service?.id)
      || availableServices.find((service: any) => service.id === billingForm.serviceId)
      || availableServices.find((service: any) => service.id === caseData?.service?.id)
      || caseData?.service
  }, [serviceOptions, availableServices, billingForm.serviceId, caseData?.service])
  const hasUnidadeOption = useMemo(
    () => serviceOptions.some((service: any) => normalizeServiceKind(service) === 'UNIDADE'),
    [serviceOptions],
  )
  const allowedInstallments = useMemo(() => getAllowedInstallments(selectedService), [selectedService])
  const couponAllowed = isAlignerType(selectedService)
  const showBillingSection = ['WAITING_APPROVAL', 'APPROVED', 'PRINTING_3D', 'LABORATORY', 'EXPEDITION', 'SHIPPED', 'COMPLETED'].includes(caseData?.status)

  useEffect(() => {
    if (!caseData) return
    setBillingForm((prev: any) => {
      const currentServiceId = caseData.service?.id || ''
      const prevServiceId = prev?.serviceId || ''
      const preferredServiceId =
        (prevServiceId && serviceOptions.some((service: any) => service.id === prevServiceId) && prevServiceId)
        || (currentServiceId && serviceOptions.some((service: any) => service.id === currentServiceId) && currentServiceId)
        || serviceOptions[0]?.id
        || currentServiceId
        || ''
      const preferredService =
        serviceOptions.find((service: any) => service.id === preferredServiceId)
        || availableServices.find((service: any) => service.id === preferredServiceId)
        || caseData.service
      const nextInstallments = getAllowedInstallments(preferredService)
      const installmentFromCase = caseData.installmentOption || ''
      const prevInstallment = prev?.installmentOption || ''
      const nextInstallment =
        (prevInstallment && nextInstallments.includes(prevInstallment) && prevInstallment)
        || (installmentFromCase && nextInstallments.includes(installmentFromCase) && installmentFromCase)
        || nextInstallments[0]
        || '1x'
      const couponEnabled = isAlignerType(preferredService)
      return {
        serviceId: preferredServiceId,
        billingType: preferredService?.name || prev?.billingType || caseData.billingType || '',
        installmentOption: nextInstallment,
        dropoutInsurance: typeof prev?.dropoutInsurance === 'boolean' ? prev.dropoutInsurance : !!caseData.dropoutInsurance,
        discountCoupon: couponEnabled ? (prev?.discountCoupon ?? caseData.discountCoupon ?? '') : '',
        packActive: typeof prev?.packActive === 'boolean' ? prev.packActive : !!caseData.packActive,
      }
    })
  }, [caseData, serviceOptions, availableServices])

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['Em Aberto', 'Concluídos'].map(tab => (
          <button key={tab} onClick={() => setWorkflowTab(tab as 'Em Aberto' | 'Concluídos')}
            className={`px-4 py-2 text-sm rounded-lg font-medium border transition ${workflowTab === tab ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
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
              {draftCases.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg text-blue-700 p-4">
                    Paciente criado com sucesso. Próximo passo: adicione as fotos, os modelos digitais e as fichas. Quando a caixa for aberta, o fluxo entra em preparo de modelos automaticamente.
                  </div>
                  <div className="border rounded-lg bg-white p-4 text-sm text-gray-600 space-y-2">
                    <p className="font-medium text-gray-800">Checklist recomendado</p>
                    <p>1. Enviar fotos do paciente</p>
                    <p>2. Enviar modelos digitais</p>
                    <p>3. Preencher as fichas necessárias</p>
                    <p>4. Registrar o recebimento para iniciar o workflow</p>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg text-blue-700 p-4">Nenhum fluxo em aberto. Registre o recebimento dos modelos para iniciar o processo.</div>
              )}
              {canStartWorkflow ? (
                <Button size="sm" className="w-full" onClick={() => startWorkflowMutation.mutate()} disabled={startWorkflowMutation.isLoading}>
                  {startWorkflowMutation.isLoading ? 'Registrando...' : 'Registrar recebimento e iniciar fluxo'}
                </Button>
              ) : (
                <div className="text-sm text-gray-500">A abertura do fluxo é feita pelo time interno após o recebimento da caixa.</div>
              )}
            </div>
          ) : (
            <>
              {openCases.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {openCases.map((c: any) => (
                    <button key={c.id} onClick={() => setSelectedCase(c.id)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${selectedCase === c.id ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 hover:border-primary/50'}`}>
                      #{c.caseNumber} — {c.productType || c.service?.name || 'Caso'}
                    </button>
                  ))}
                </div>
              )}
              {caseData && (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-start">
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
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full border rounded text-xs px-3 py-2 resize-none" rows={2} placeholder="Observações (opcional)" />
                        <Button size="sm" className="w-full" onClick={() => advanceMutation.mutate()} disabled={advanceMutation.isPending}>
                          {advanceMutation.isPending ? 'Avançando...' : `Avançar: ${WORKFLOW_STAGES.find(s => s.n === currentStage + 1)?.label || 'Próxima Etapa'}`}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {caseData?.status === 'WAITING_APPROVAL' && (
                      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b bg-gray-50">
                          <p className="text-sm font-semibold text-gray-700">Aprovação</p>
                          <p className="text-xs text-gray-400 mt-0.5">O dentista pode aprovar diretamente ou o time interno pode aprovar em nome dele.</p>
                        </div>
                        <div className="p-4 space-y-3">
                          {user?.role === 'DENTIST' && (
                            <>
                              <textarea value={revisionNotes} onChange={e => setRevisionNotes(e.target.value)} className="w-full border rounded text-xs px-3 py-2 resize-none" rows={3} placeholder="Se precisar, descreva aqui o pedido de revisão" />
                              <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" size="sm" onClick={() => revisionMutation.mutate()} disabled={!revisionNotes.trim() || revisionMutation.isPending}>
                                  {revisionMutation.isPending ? 'Enviando...' : 'Solicitar revisão'}
                                </Button>
                                <Button size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                                  {approveMutation.isPending ? 'Aprovando...' : 'Aprovar setup'}
                                </Button>
                              </div>
                            </>
                          )}
                          {canApproveForDentist && (
                            <div className="space-y-2">
                              <p className="text-xs text-gray-500">Admin e vendedor podem aprovar para o dentista. Se for vendedor, é obrigatório ter uma foto na área restrita comprovando a solicitação.</p>
                              <Button size="sm" className="w-full" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                                {approveMutation.isPending ? 'Aprovando...' : 'Aprovar para o dentista'}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {showBillingSection && canManageBilling && (
                      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b bg-gray-50">
                          <p className="text-sm font-semibold text-gray-700">Faturamento</p>
                          <p className="text-xs text-gray-400 mt-0.5">Preenchimento interno — centralizado no Financeiro</p>
                        </div>
                        <div className="p-4 space-y-3">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Tipo de produto/pacote</label>
                            <select className="w-full border rounded px-2 py-1.5 text-sm" value={billingForm.serviceId || ''}
                              onChange={e => {
                                const nextService = orderedServices.find((service: any) => service.id === e.target.value) || availableServices.find((service: any) => service.id === e.target.value)
                                const nextInstallments = getAllowedInstallments(nextService)
                                setBillingForm((f: any) => ({ ...f, serviceId: e.target.value, billingType: nextService?.name || '', installmentOption: nextInstallments[0] || '1x', discountCoupon: isAlignerType(nextService) ? f.discountCoupon : '' }))
                              }}>
                              <option value="">Selecione o produto/pacote</option>
                              {serviceOptions.map((service: any) => <option key={service.id} value={service.id}>{getServiceDisplayName(service)}</option>)}
                            </select>
                            {serviceOptions.length === 0 && <p className="text-xs text-gray-400 mt-1">Nenhum produto/pacote compatível foi configurado para este tipo de tratamento.</p>}
                            {effectiveProductType === 'ALINHADORES' && !hasUnidadeOption && <p className="text-xs text-amber-600 mt-1">Produto UNIDADE não encontrado no catálogo ativo.</p>}
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Parcelas</label>
                            <select className="w-full border rounded px-2 py-1.5 text-sm" value={billingForm.installmentOption || ''} onChange={e => setBillingForm((f: any) => ({ ...f, installmentOption: e.target.value }))}>
                              {allowedInstallments.map(option => <option key={option} value={option}>{option}</option>)}
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
                            <input className="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                              value={billingForm.discountCoupon || ''} onChange={e => setBillingForm((f: any) => ({ ...f, discountCoupon: e.target.value.toUpperCase() }))}
                              placeholder={couponAllowed ? 'CUPOM' : 'Disponível apenas para alinhadores'} disabled={!couponAllowed} />
                            {!couponAllowed && <p className="text-xs text-gray-400 mt-1">Cupons não podem ser aplicados em placas e outros serviços não alinhadores.</p>}
                          </div>
                          <Button size="sm" className="w-full" onClick={() => billingMutation.mutate()} disabled={billingMutation.isPending}>
                            {billingMutation.isPending ? 'Salvando...' : 'Salvar Faturamento'}
                          </Button>
                          <p className="text-xs text-gray-400">Ao salvar, o valor já fica disponível no painel financeiro do dentista.</p>
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
    formData.append('isPrivate', String(!!isPrivate))
    Array.from(files).forEach(f => formData.append('files', f))
    try {
      await api.post(`/patients/${patientId}/photos`, formData, { headers: { 'Content-Type': undefined } })
      qc.invalidateQueries({ queryKey: ['patient-photos', patientId] })
      toast({ title: isPrivate ? 'Mídias restritas enviadas' : 'Mídias enviadas' })
    } catch { toast({ variant: 'destructive', title: 'Erro ao enviar mídias' }) }
    finally { setUploading(false) }
  }
  const photos = data?.photos || []
  return (
    <div className="space-y-4">
      <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-colors hover:bg-gray-50 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <Plus className="w-4 h-4" />
        {uploading ? 'Enviando...' : `Adicionar ${isPrivate ? 'Fotos/Vídeos Restritos' : 'Fotos/Vídeos'}`}
        <input type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime" className="hidden" onChange={handleUpload} disabled={uploading} />
      </label>
      {photos.length === 0 && <p className="text-sm text-gray-400 py-4">Nenhuma mídia</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((p: any) => (
          <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden border bg-gray-100 hover:opacity-90 transition-opacity">
            {isVideoFile(p.filename) ? <video src={p.url} className="w-full h-full object-cover" controls /> : <img src={p.url} alt={p.filename} className="w-full h-full object-cover" />}
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
      await api.post(`/patients/${patientId}/${endpoint}`, formData, { headers: { 'Content-Type': undefined } })
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
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
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

function RelatorioTab({ patientId, cases }: { patientId: string; cases: any[] }) {
  const { user } = useAuthStore()
  const [uploading, setUploading] = useState(false)
  const isLabOrAdmin = ['ADMIN', 'LAB_TECH', 'EXPEDITION'].includes(user?.role || '')
  const uploadCaseId = cases.find(c => !['COMPLETED', 'DRAFT', 'SUBMITTED'].includes(c.status))?.id || cases[0]?.id

  const { data, refetch } = useQuery({
    queryKey: ['patient-approvals', patientId],
    queryFn: () => api.get(`/cases/patient/${patientId}/approvals`).then(r => r.data),
  })
  const documents = data?.documents || []

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadCaseId) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      await api.post(`/cases/${uploadCaseId}/upload-pdf`, formData, { headers: { 'Content-Type': undefined } })
      toast({ title: 'Relatório enviado com sucesso!' })
      refetch()
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao enviar PDF', description: err?.response?.data?.error })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleView = async (docId: string) => {
    try { await api.post(`/cases/document/${docId}/view`) } catch { /* silent */ }
  }

  return (
    <div className="space-y-4">
      {isLabOrAdmin && (
        <div>
          {!uploadCaseId && <p className="text-xs text-amber-600 mb-2">Nenhum caso ativo encontrado para este paciente.</p>}
          <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm font-medium hover:bg-gray-50 ${uploading || !uploadCaseId ? 'opacity-50 pointer-events-none' : ''}`}>
            <Plus className="w-4 h-4" />
            {uploading ? 'Enviando...' : 'Enviar PDF de Relatório'}
            <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleUpload} disabled={uploading || !uploadCaseId} />
          </label>
        </div>
      )}
      {documents.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">Nenhum relatório disponível</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc: any) => (
            <a key={doc.id} href={doc.fileUrl} target="_blank" rel="noreferrer"
              onClick={() => handleView(doc.id)}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center shrink-0 border border-red-100">
                <FileText className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.title || doc.fileName}</p>
                <p className="text-xs text-gray-400">
                  Caso #{doc.case?.caseNumber} · {doc.uploader?.name} · {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${doc.status === 'VIEWED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {doc.status === 'VIEWED' ? 'Visualizado' : 'Novo'}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

const VIDEO_API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : 'http://localhost:3001/api'

function CheckagemVirtual3DTab({ patientId, cases }: { patientId: string; cases: any[] }) {
  const { user, accessToken } = useAuthStore()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const isLabOrAdmin = ['ADMIN', 'LAB_TECH', 'EXPEDITION'].includes(user?.role || '')
  const uploadCaseId = cases.find(c => !['COMPLETED', 'DRAFT', 'SUBMITTED'].includes(c.status))?.id || cases[0]?.id

  const { data, refetch } = useQuery({
    queryKey: ['patient-approvals', patientId],
    queryFn: () => api.get(`/cases/patient/${patientId}/approvals`).then(r => r.data),
  })
  const videos = data?.videos || []

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadCaseId) return
    setUploading(true)
    setProgress(0)
    const formData = new FormData()
    formData.append('file', file)
    try {
      await api.post(`/cases/${uploadCaseId}/upload-video`, formData, {
        headers: { 'Content-Type': undefined },
        onUploadProgress: (evt: any) => setProgress(Math.round((evt.loaded / (evt.total || 1)) * 100)),
      })
      toast({ title: 'Vídeo enviado com sucesso!' })
      refetch()
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao enviar vídeo', description: err?.response?.data?.error })
    } finally {
      setUploading(false)
      setProgress(0)
      e.target.value = ''
    }
  }

  const handleView = async (videoId: string) => {
    try { await api.post(`/cases/video/${videoId}/view`) } catch { /* silent */ }
  }

  return (
    <div className="space-y-5">
      {isLabOrAdmin && (
        <div className="space-y-2">
          {!uploadCaseId && <p className="text-xs text-amber-600">Nenhum caso ativo encontrado para este paciente.</p>}
          <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm font-medium hover:bg-gray-50 ${uploading || !uploadCaseId ? 'opacity-50 pointer-events-none' : ''}`}>
            <Plus className="w-4 h-4" />
            {uploading ? `Enviando... ${progress}%` : 'Enviar Vídeo MP4'}
            <input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.mov" className="hidden" onChange={handleUpload} disabled={uploading || !uploadCaseId} />
          </label>
          {uploading && (
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
              <div className="bg-primary h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}
      {videos.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">Nenhum vídeo de checagem disponível</p>
      ) : (
        <div className="space-y-5">
          {videos.map((video: any) => (
            <div key={video.id} className="border rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{video.title}</p>
                  <p className="text-xs text-gray-400">
                    Caso #{video.case?.caseNumber} · Enviado por {video.uploader?.name} · {new Date(video.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${video.status === 'VIEWED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {video.status === 'VIEWED' ? 'Visualizado' : 'Novo'}
                </span>
              </div>
              <video
                src={`${VIDEO_API_BASE}/cases/video/${video.id}/stream?token=${encodeURIComponent(accessToken || '')}`}
                controls
                className="w-full max-h-[500px] bg-black"
                onPlay={() => handleView(video.id)}
                playsInline
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FormsTab({ patientId }: { patientId: string }) {
  const navigate = useNavigate()
  const { data: planning } = useQuery({ queryKey: ['forms-planning', patientId], queryFn: () => api.get(`/forms/planning/${patientId}`).then(r => r.data) })
  const { data: completion } = useQuery({ queryKey: ['forms-completion', patientId], queryFn: () => api.get(`/forms/completion/${patientId}`).then(r => r.data) })
  const { data: otherServices } = useQuery({ queryKey: ['forms-other-services', patientId], queryFn: () => api.get(`/forms/other-services/${patientId}`).then(r => r.data) })
  return (
    <div className="space-y-6">
      <FormSection title="Fichas de Planejamento" items={planning} onAdd={() => navigate(`/patients/${patientId}/forms/planning/new`)} />
      <FormSection title="Fichas de Finalização" items={completion} onAdd={() => navigate(`/patients/${patientId}/forms/completion/new`)} />
      <FormSection title="Outros Serviços (Placa Miorrelaxante / AIR)" items={otherServices} onAdd={() => navigate(`/patients/${patientId}/forms/other-services/new`)} />
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
        {(!items || items.length === 0) && <p className="px-5 py-4 text-sm text-gray-400">Nenhuma ficha</p>}
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
  const { data } = useQuery({ queryKey: ['clinical-records', patientId], queryFn: () => api.get(`/clinical-records?patientId=${patientId}`).then(r => r.data) })
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

function ImportantNotesTab({ patientId, initialValue }: { patientId: string; initialValue?: string | null }) {
  const qc = useQueryClient()
  const [notes, setNotes] = useState(initialValue || '')
  useEffect(() => { setNotes(initialValue || '') }, [initialValue])
  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/patients/${patientId}/important-notes`, { importantNotes: notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', patientId] })
      qc.invalidateQueries({ queryKey: ['patients'] })
      toast({ title: 'Informações importantes atualizadas' })
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error?.response?.data?.error || 'Falha ao salvar informações importantes' })
    },
  })
  return (
    <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b bg-gray-50">
        <p className="text-sm font-semibold text-gray-700">Informações internas para preparo e movimentação</p>
        <p className="text-xs text-gray-500 mt-1">Esse conteúdo é visível apenas para a equipe interna e nunca para o dentista.</p>
      </div>
      <div className="p-5 space-y-4">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={8}
          className="w-full border rounded-md px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Adicione aqui orientações importantes para o time que prepara e movimenta o caso..." />
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setNotes(initialValue || '')} disabled={saveMutation.isPending}>Restaurar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || notes === (initialValue || '')}>
            {saveMutation.isPending ? 'Salvando...' : 'Salvar informações'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function PatientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('Workflow')
  const [transferDentistId, setTransferDentistId] = useState('')
  const [importantNotesOpen, setImportantNotesOpen] = useState(false)
  const { user } = useAuthStore()
  const isAdminOrSupport = user?.role !== 'DENTIST'
  const qc = useQueryClient()

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => api.get(`/patients/${id}`).then(r => r.data),
  })

  const { data: dentistsData } = useQuery({
    queryKey: ['patient-transfer-dentists'],
    queryFn: () => api.get('/admin/dentists').then(r => r.data),
    enabled: user?.role === 'ADMIN',
    staleTime: 30000,
  })

  const transferMutation = useMutation({
    mutationFn: () => api.post(`/patients/${id}/transfer`, { dentistId: transferDentistId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', id] })
      qc.invalidateQueries({ queryKey: ['patients'] })
      setTransferDentistId('')
      toast({ title: 'Paciente transferido com sucesso' })
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Erro ao transferir', description: error?.response?.data?.error || 'Falha ao transferir paciente' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/patients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
      toast({ title: 'Paciente apagado com sucesso' })
      navigate('/patients')
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Erro ao apagar', description: error?.response?.data?.error || 'Falha ao apagar paciente' })
    },
  })

  const shouldOpenImportantNotesPopup = IMPORTANT_NOTES_POPUP_ROLES.includes(user?.role || '') && !!patient?.importantNotes?.trim()

  useEffect(() => {
    if (shouldOpenImportantNotesPopup) setImportantNotesOpen(true)
  }, [patient?.id, patient?.updatedAt, shouldOpenImportantNotesPopup])

  if (isLoading) return <div className="p-6 text-gray-400">Carregando...</div>
  if (!patient) return <div className="p-6 text-red-500">Paciente não encontrado</div>

  const availableDentists = (dentistsData?.dentists || []).filter((dentist: any) => dentist.id !== patient.dentistId)
  const hasImportantNotes = Boolean(patient.importantNotes?.trim())
  const canRenderImportantNotesPopup = IMPORTANT_NOTES_POPUP_ROLES.includes(user?.role || '') && hasImportantNotes

  const isCreatorDentist = user?.role === 'DENTIST' && patient.dentistId === user.id
  const tabs = isAdminOrSupport
    ? TABS
    : isCreatorDentist
      ? DENTIST_TABS
      : ['Workflow', 'Fotos', 'Fichas', 'Ficha Clínica']

  const activeCase = patient.cases?.find((c: any) => c.totvsOrderId)
  const caseForServiceBadge = activeCase || patient.cases?.[0]
  const treatmentLabel = caseForServiceBadge?.productType
    ? PRODUCT_TYPE_LABELS[caseForServiceBadge.productType] || caseForServiceBadge.productType
    : caseForServiceBadge?.service?.name || caseForServiceBadge?.service?.type || ''

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {canRenderImportantNotesPopup && importantNotesOpen && (
        <Dialog open={importantNotesOpen} onOpenChange={setImportantNotesOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Informações Importantes</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Este paciente possui instruções internas para a equipe de preparo e movimentação.</p>
              <div className="rounded-lg border bg-amber-50 border-amber-200 p-4 text-sm text-amber-950 whitespace-pre-wrap">{patient.importantNotes}</div>
              <div className="flex justify-end"><Button onClick={() => setImportantNotesOpen(false)}>Fechar</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/patients')} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 flex-wrap">
            <span>{patient.name}</span>
            {treatmentLabel && <Badge variant="secondary">{treatmentLabel}</Badge>}
          </h1>
          <p className="text-sm text-gray-400">{patient.dentist?.name}{patient.dentist?.clinic ? ` · ${patient.dentist.clinic}` : ''}</p>
          {activeCase?.totvsOrderId && <p className="text-sm text-blue-600 font-medium">Nº de Caixa: {activeCase.totvsOrderId}</p>}
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => navigate(`/patients/${id}/edit`)}>Editar</Button>
      </div>

      {user?.role === 'ADMIN' && (
        <div className="border rounded-lg bg-white shadow-sm p-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-800">Ações administrativas</p>
            <p className="text-xs text-gray-500">Você pode transferir este paciente para outro dentista ou apagar o cadastro junto com os arquivos e histórico relacionados.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <select value={transferDentistId} onChange={(e) => setTransferDentistId(e.target.value)} className="border rounded-md px-3 py-2 text-sm text-gray-700 bg-white min-w-[260px]">
                <option value="">Selecione o dentista de destino</option>
                {availableDentists.map((dentist: any) => (
                  <option key={dentist.id} value={dentist.id}>{dentist.name}{dentist.clinic ? ` - ${dentist.clinic}` : ''}</option>
                ))}
              </select>
              <Button variant="outline" className="gap-2" disabled={!transferDentistId || transferMutation.isPending} onClick={() => transferMutation.mutate()}>
                <ArrowRightLeft className="w-4 h-4" />
                {transferMutation.isPending ? 'Transferindo...' : 'Transferir paciente'}
              </Button>
            </div>
          </div>
          <Button variant="destructive" className="gap-2" disabled={deleteMutation.isPending}
            onClick={() => { if (window.confirm('Isso apagará o paciente e todo o histórico relacionado. Deseja continuar?')) deleteMutation.mutate() }}>
            <Trash2 className="w-4 h-4" />
            {deleteMutation.isPending ? 'Apagando...' : 'Apagar paciente'}
          </Button>
        </div>
      )}

      <div className="border-b flex gap-0 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors inline-flex items-center gap-2 ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab}
            {tab === 'Informações Importantes' && hasImportantNotes && (
              <Badge variant="warning" className="px-2 py-0 text-[10px] leading-5">Aviso</Badge>
            )}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'Workflow' && <WorkflowTab cases={patient.cases || []} patientId={id!} />}
        {activeTab === 'Fotos' && <PhotosTab patientId={id!} />}
        {activeTab === 'Fotos Restritas' && <PhotosTab patientId={id!} isPrivate />}
        {activeTab === 'Modelos Digitais' && <FilesTab patientId={id!} type="stl" />}
        {activeTab === 'Relatório' && <RelatorioTab patientId={id!} cases={patient.cases || []} />}
        {activeTab === 'Checagem Virtual 3D' && <CheckagemVirtual3DTab patientId={id!} cases={patient.cases || []} />}
        {activeTab === 'Fichas' && <FormsTab patientId={id!} />}
        {activeTab === 'Ficha Clínica' && <ClinicalRecordsTab patientId={id!} />}
        {activeTab === 'Informações Importantes' && isAdminOrSupport && <ImportantNotesTab patientId={id!} initialValue={patient.importantNotes} />}
      </div>
    </div>
  )
}
