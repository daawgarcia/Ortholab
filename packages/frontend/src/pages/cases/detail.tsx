import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'
import { ensureSelectedServiceInList, filterServicesForProduct, getAllowedInstallments, getServiceDisplayName, inferProductType, isAlignerType, normalizeServiceKind, sortBillingServices } from '@/lib/billing'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { formatDate, formatDateTime } from '@/lib/utils'
import { ArrowLeft, Upload, CheckCircle, RefreshCw, Send, FileText, X, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useDropzone } from 'react-dropzone'

function DocUploader({ caseId, type, label, onDone }: any) {
  const [uploading, setUploading] = useState(false)
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: type.includes('STL') ? { 'model/stl': ['.stl'], 'application/octet-stream': ['.stl'] } : { 'image/*': [] },
    onDrop: async (files) => {
      setUploading(true)
      const form = new FormData()
      form.append('file', files[0])
      try {
        await api.post(`/documents/upload/${caseId}?type=${type}`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
        toast({ title: `${label} enviado com sucesso!` })
        onDone()
      } catch { toast({ variant: 'destructive', title: 'Erro no upload' }) }
      finally { setUploading(false) }
    },
  })

  return (
    <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors text-center ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50'}`}>
      <input {...getInputProps()} />
      {uploading ? <Loader2 className="w-5 h-5 mx-auto animate-spin text-primary" /> : <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />}
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

const docTypes = [
  { type: 'PHOTO_EXTRA', label: 'Fotos Extrabucais' },
  { type: 'PHOTO_INTRA', label: 'Fotos Intrabucais' },
  { type: 'STL_UPPER', label: 'STL Superior' },
  { type: 'STL_LOWER', label: 'STL Inferior' },
  { type: 'XRAY_PANORAMIC', label: 'Rx Panorâmica' },
  { type: 'XRAY_CEPHALOMETRIC', label: 'Rx Cefalométrica' },
]

export default function CaseDetailPage() {
  const { id } = useParams()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [revisionNotes, setRevisionNotes] = useState('')
  const [showRevision, setShowRevision] = useState(false)
  const [billingForm, setBillingForm] = useState<any>({})

  const { data: servicesData } = useQuery({
    queryKey: ['services-billing-options'],
    queryFn: () => api.get('/services').then(r => r.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['case', id],
    queryFn: () => api.get(`/cases/${id}`).then(r => r.data.case),
  })

  const availableServices = servicesData?.services || []
  const effectiveProductType = useMemo(
    () => inferProductType(data?.productType, data?.planningFormData, data?.service, data?.billingType),
    [data?.productType, data?.planningFormData, data?.service, data?.billingType],
  )
  const filteredServices = useMemo(() => filterServicesForProduct(availableServices, effectiveProductType), [availableServices, effectiveProductType])
  const orderedServices = useMemo(() => sortBillingServices(filteredServices), [filteredServices])
  const serviceOptions = useMemo(() => ensureSelectedServiceInList(orderedServices, data?.service), [orderedServices, data?.service])
  const selectedService = useMemo(() => {
    return serviceOptions.find((service: any) => service.id === billingForm.serviceId)
      || serviceOptions.find((service: any) => service.id === data?.service?.id)
      || availableServices.find((service: any) => service.id === billingForm.serviceId)
      || availableServices.find((service: any) => service.id === data?.service?.id)
      || data?.service
  }, [serviceOptions, availableServices, billingForm.serviceId, data?.service])
  const hasUnidadeOption = useMemo(
    () => serviceOptions.some((service: any) => normalizeServiceKind(service) === 'UNIDADE'),
    [serviceOptions],
  )
  const allowedInstallments = useMemo(() => getAllowedInstallments(selectedService), [selectedService])
  const couponAllowed = isAlignerType(selectedService)
  const showBillingSection = ['WAITING_APPROVAL', 'APPROVED', 'PRINTING_3D', 'LABORATORY', 'EXPEDITION', 'SHIPPED', 'COMPLETED'].includes(data?.status)

  useEffect(() => {
    if (!data) return
    const currentServiceId = data.service?.id || ''
    const currentServiceAllowed = !currentServiceId || serviceOptions.some((service: any) => service.id === currentServiceId)
    const fallbackServiceId = currentServiceAllowed ? currentServiceId : (serviceOptions[0]?.id || '')
    const fallbackService = serviceOptions.find((service: any) => service.id === fallbackServiceId) || data.service
    setBillingForm({
      serviceId: fallbackServiceId,
      billingType: data.billingType || fallbackService?.name || '',
      installmentOption: allowedInstallments.includes(data.installmentOption || '') ? data.installmentOption : (allowedInstallments[0] || '1x'),
      dropoutInsurance: !!data.dropoutInsurance,
      discountCoupon: couponAllowed ? (data.discountCoupon || '') : '',
      packActive: !!data.packActive,
    })
  }, [data, serviceOptions, allowedInstallments, couponAllowed])

  const billingMutation = useMutation({
    mutationFn: () => api.patch(`/workflow/case/${id}/billing`, billingForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['case', id] })
      qc.invalidateQueries({ queryKey: ['dentist-invoices'] })
      qc.invalidateQueries({ queryKey: ['financial'] })
      toast({ title: 'Faturamento salvo!' })
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Erro', description: err?.response?.data?.error || 'Falha ao salvar faturamento' }),
  })

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/cases/${id}/submit`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['case', id] }); toast({ title: 'Caso submetido!' }) },
  })

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/workflow/case/${id}/approve`, billingForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['case', id] })
      qc.invalidateQueries({ queryKey: ['dentist-invoices'] })
      qc.invalidateQueries({ queryKey: ['financial'] })
      toast({ title: 'Planejamento aprovado!' })
    },
    onError: (err: any) => toast({ variant: 'destructive', title: 'Erro', description: err?.response?.data?.error || 'Falha ao aprovar caso' }),
  })

  const revisionMutation = useMutation({
    mutationFn: () => api.post(`/cases/${id}/request-revision`, { notes: revisionNotes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['case', id] }); setShowRevision(false); toast({ title: 'Revisão solicitada!' }) },
  })

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Carregando...</div>
  if (!data) return <div className="py-20 text-center text-muted-foreground">Caso não encontrado</div>

  const c = data
  const latestPlanning = c.plannings?.[0]
  const isDentist = user?.role === 'DENTIST'
  const canSubmit = isDentist && c.status === 'DRAFT'
  const canApprove = isDentist && c.status === 'WAITING_APPROVAL'

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">Caso #{c.caseNumber} — {c.patientName}</h1>
              <StatusBadge status={c.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">Criado em {formatDate(c.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canSubmit && (
            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} className="gap-2">
              {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submeter Caso
            </Button>
          )}
          {canApprove && (
            <>
              <Button variant="outline" onClick={() => setShowRevision(true)} className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50">
                <RefreshCw className="w-4 h-4" /> Solicitar Revisão
              </Button>
              <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} className="gap-2 bg-green-600 hover:bg-green-700">
                {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Aprovar Setup
              </Button>
            </>
          )}
        </div>
      </div>

      {showRevision && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="p-4 space-y-3">
            <p className="font-medium text-sm text-orange-800">Descreva o ajuste necessário:</p>
            <textarea className="w-full min-h-20 rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm resize-none" placeholder="Explique o que precisa ser ajustado no planejamento..." value={revisionNotes} onChange={e => setRevisionNotes(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowRevision(false)}>Cancelar</Button>
              <Button size="sm" onClick={() => revisionMutation.mutate()} disabled={!revisionNotes.trim() || revisionMutation.isPending} className="bg-orange-600 hover:bg-orange-700">
                {revisionMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Enviar Revisão
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Informações do Caso</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-muted-foreground text-xs">Dentista</p><p className="font-medium">{c.dentist?.name}</p></div>
              <div><p className="text-muted-foreground text-xs">Clínica</p><p className="font-medium">{c.dentist?.clinic || '-'}</p></div>
              <div><p className="text-muted-foreground text-xs">Data de nascimento</p><p className="font-medium">{c.patientDob ? formatDate(c.patientDob) : '-'}</p></div>
              <div><p className="text-muted-foreground text-xs">Gênero</p><p className="font-medium">{c.gender === 'M' ? 'Masculino' : c.gender === 'F' ? 'Feminino' : '-'}</p></div>
              <div><p className="text-muted-foreground text-xs">Serviço</p><p className="font-medium">{c.service?.name || '-'}</p></div>
              {c.notes && <div className="col-span-2"><p className="text-muted-foreground text-xs">Observações</p><p className="font-medium">{c.notes}</p></div>}
            </CardContent>
          </Card>

          {latestPlanning && (
            <Card>
              <CardHeader><CardTitle className="text-base">Planejamento</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Alinhadores Superior</p><p className="font-bold text-lg">{latestPlanning.alignerUpper || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Alinhadores Inferior</p><p className="font-bold text-lg">{latestPlanning.alignerLower || '-'}</p></div>
                </div>
                {latestPlanning.notes && <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-muted-foreground mb-1">Notas do laboratório</p><p>{latestPlanning.notes}</p></div>}
                {latestPlanning.setupUrl && (
                  <a href={latestPlanning.setupUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline text-sm">
                    <FileText className="w-4 h-4" /> Visualizar Setup
                  </a>
                )}
                {latestPlanning.revisions?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Histórico de revisões</p>
                    {latestPlanning.revisions.map((r: any) => (
                      <div key={r.id} className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-xs">
                        <p className="font-medium text-orange-800">{r.requester?.name} · {formatDateTime(r.createdAt)}</p>
                        <p className="mt-0.5 text-orange-700">{r.notes}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Documentos ({c.documents?.length || 0})</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {(c.status === 'DRAFT' || isDentist) && (
                <div className="grid grid-cols-3 gap-3">
                  {docTypes.map(dt => (
                    <DocUploader key={dt.type} caseId={c.id} type={dt.type} label={dt.label} onDone={() => qc.invalidateQueries({ queryKey: ['case', id] })} />
                  ))}
                </div>
              )}
              <div className="grid grid-cols-4 gap-2">
                {c.documents?.map((doc: any) => (
                  <div key={doc.id} className="relative group rounded-lg overflow-hidden border bg-gray-50">
                    {doc.type.includes('PHOTO') || doc.type.includes('XRAY') ? (
                      <img src={doc.url} alt={doc.fileName} className="w-full h-20 object-cover" />
                    ) : (
                      <div className="h-20 flex flex-col items-center justify-center">
                        <FileText className="w-6 h-6 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground mt-1">{doc.type}</p>
                      </div>
                    )}
                    <p className="text-xs text-center p-1 truncate text-muted-foreground">{doc.fileName}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          {showBillingSection && (
            <Card className="border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-blue-700">Faturamento</CardTitle>
                <p className="text-xs text-blue-500">Opcional — pode ser preenchido pelo dentista ou pelo nosso time</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tipo de produto/pacote</label>
                  <select
                    className="w-full border rounded px-2 py-1.5 text-sm"
                    value={billingForm.serviceId || ''}
                    onChange={e => {
                      const nextService = orderedServices.find((service: any) => service.id === e.target.value)
                        || availableServices.find((service: any) => service.id === e.target.value)
                      const nextInstallments = getAllowedInstallments(nextService)
                      setBillingForm((f: any) => ({
                        ...f,
                        serviceId: e.target.value,
                        billingType: nextService?.name || '',
                        installmentOption: nextInstallments[0] || '1x',
                        discountCoupon: isAlignerType(nextService) ? f.discountCoupon : '',
                      }))
                    }}
                  >
                    <option value="">Selecione o produto/pacote</option>
                    {serviceOptions.map((service: any) => (
                      <option key={service.id} value={service.id}>{getServiceDisplayName(service)}</option>
                    ))}
                  </select>
                  {serviceOptions.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">Nenhum produto/pacote compatível foi configurado para este tipo de tratamento.</p>
                  )}
                  {effectiveProductType === 'ALINHADORES' && !hasUnidadeOption && (
                    <p className="text-xs text-amber-600 mt-1">Produto UNIDADE não encontrado no catálogo ativo. Cadastre um serviço com tipo UNIDADE ou EXPRESS em Admin &gt; Serviços.</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Parcelas</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm" value={billingForm.installmentOption || ''} onChange={e => setBillingForm((f: any) => ({ ...f, installmentOption: e.target.value }))}>
                    {allowedInstallments.map(opt => <option key={opt} value={opt}>{opt}</option>)}
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
                {couponAllowed && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Cupom de Desconto</label>
                    <input
                      className="w-full border rounded px-2 py-1.5 text-sm"
                      value={billingForm.discountCoupon || ''}
                      onChange={e => setBillingForm((f: any) => ({ ...f, discountCoupon: e.target.value.toUpperCase() }))}
                      placeholder="CUPOM"
                    />
                  </div>
                )}
                <Button size="sm" className="w-full" onClick={() => billingMutation.mutate()} disabled={billingMutation.isPending}>
                  {billingMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  Salvar Faturamento
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {c.activities?.map((a: any, i: number) => (
                  <div key={a.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0" />
                      {i < c.activities.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                    </div>
                    <div className="pb-3">
                      <p className="text-xs font-medium">{a.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(a.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {c.production && (
            <Card>
              <CardHeader><CardTitle className="text-base">Produção / Envio</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                {c.production.trackingCode && (
                  <div><p className="text-xs text-muted-foreground">Rastreamento</p><p className="font-bold text-primary">{c.production.trackingCode}</p></div>
                )}
                {c.production.carrier && <div><p className="text-xs text-muted-foreground">Transportadora</p><p>{c.production.carrier}</p></div>}
                {c.production.shippedAt && <div><p className="text-xs text-muted-foreground">Enviado em</p><p>{formatDate(c.production.shippedAt)}</p></div>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
