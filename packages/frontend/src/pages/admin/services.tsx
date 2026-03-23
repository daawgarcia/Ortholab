import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { Loader2, Pencil, Plus } from 'lucide-react'

type ServiceForm = {
  id?: string
  name: string
  description: string
  type: string
  productionDays: string
  maxRevisions: string
  prices: {
    cash: string
    installment2: string
    installment6: string
    installment12: string
    installment21: string
  }
}

const EMPTY_FORM: ServiceForm = {
  name: '',
  description: '',
  type: 'FULL',
  productionDays: '15',
  maxRevisions: '2',
  prices: {
    cash: '',
    installment2: '',
    installment6: '',
    installment12: '',
    installment21: '',
  },
}

const TYPE_OPTIONS = [
  { value: 'FULL', label: 'FULL' },
  { value: 'MID', label: 'MID' },
  { value: 'AIR', label: 'EA AIR²' },
  { value: 'EXPRESS', label: 'EXPRESS' },
  { value: 'REFINEMENT', label: 'REFINAMENTO' },
  { value: 'RETAINER', label: 'PLACA / CONTENÇÃO' },
  { value: 'OTHER', label: 'OUTRO' },
]

function toForm(service?: any): ServiceForm {
  if (!service) return EMPTY_FORM
  return {
    id: service.id,
    name: service.name || '',
    description: service.description || '',
    type: service.type || 'FULL',
    productionDays: String(service.productionDays || 15),
    maxRevisions: String(service.maxRevisions || 2),
    prices: {
      cash: service.latestPrices?.cash !== undefined ? String(service.latestPrices.cash) : '',
      installment2: service.latestPrices?.installment2 !== undefined ? String(service.latestPrices.installment2) : '',
      installment6: service.latestPrices?.installment6 !== undefined ? String(service.latestPrices.installment6) : '',
      installment12: service.latestPrices?.installment12 !== undefined ? String(service.latestPrices.installment12) : '',
      installment21: service.latestPrices?.installment21 !== undefined ? String(service.latestPrices.installment21) : '',
    },
  }
}

function cleanPayload(form: ServiceForm) {
  const normalize = (value: string) => {
    if (!value.trim()) return undefined
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    type: form.type,
    productionDays: Number(form.productionDays),
    maxRevisions: Number(form.maxRevisions),
    prices: {
      cash: normalize(form.prices.cash),
      installment2: normalize(form.prices.installment2),
      installment6: normalize(form.prices.installment6),
      installment12: normalize(form.prices.installment12),
      installment21: normalize(form.prices.installment21),
    },
  }
}

function PriceCard({ label, value }: { label: string; value?: number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2 text-center">
      <p className="text-lg font-bold text-primary">{value !== undefined ? formatCurrency(value) : '-'}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

export default function AdminServicesPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM)

  const { data } = useQuery({
    queryKey: ['services-all'],
    queryFn: () => api.get('/services').then((response) => response.data),
  })

  const services = data?.services || []
  const isFull = form.type === 'FULL'
  const isAir = form.type === 'AIR'
  const modalTitle = form.id ? 'Editar Serviço' : 'Novo Serviço'

  const mutation = useMutation({
    mutationFn: () => {
      const payload = cleanPayload(form)
      if (form.id) {
        return api.patch(`/services/${form.id}`, payload)
      }
      return api.post('/services', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services-all'] })
      setShowModal(false)
      setForm(EMPTY_FORM)
      toast({ title: form.id ? 'Serviço atualizado!' : 'Serviço criado!' })
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error?.response?.data?.error || 'Não foi possível salvar o serviço.',
        variant: 'destructive',
      })
    },
  })

  const cards = useMemo(() => services.map((service: any) => ({
    ...service,
    latestPrices: {
      cash: service.latestPrices?.cash !== undefined ? Number(service.latestPrices.cash) : undefined,
      installment2: service.latestPrices?.installment2 !== undefined ? Number(service.latestPrices.installment2) : undefined,
      installment6: service.latestPrices?.installment6 !== undefined ? Number(service.latestPrices.installment6) : undefined,
      installment12: service.latestPrices?.installment12 !== undefined ? Number(service.latestPrices.installment12) : undefined,
      installment21: service.latestPrices?.installment21 !== undefined ? Number(service.latestPrices.installment21) : undefined,
    },
  })), [services])

  function openCreate() {
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(service: any) {
    setForm(toForm(service))
    setShowModal(true)
  }

  function updateField<K extends keyof ServiceForm>(key: K, value: ServiceForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updatePriceField(key: keyof ServiceForm['prices'], value: string) {
    setForm((current) => ({
      ...current,
      prices: {
        ...current.prices,
        [key]: value,
      },
    }))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Serviços e Preços</h1>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo Serviço</Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {cards.map((service: any) => (
          <Card key={service.id}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-lg">{service.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{service.description || '-'}</p>
                  <p className="text-xs text-muted-foreground mt-2">Tipo: {service.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${service.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{service.active ? 'Ativo' : 'Inativo'}</span>
                  <Button size="sm" variant="outline" onClick={() => openEdit(service)} className="gap-2">
                    <Pencil className="w-4 h-4" /> Editar
                  </Button>
                </div>
              </div>

              <div className={`grid gap-2 ${service.type === 'FULL' ? 'grid-cols-4' : service.type === 'AIR' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                <PriceCard label="À vista" value={service.latestPrices.cash} />
                {service.type === 'AIR' ? (
                  <PriceCard label="2x" value={service.latestPrices.installment2} />
                ) : (
                  <>
                    <PriceCard label="6x" value={service.latestPrices.installment6} />
                    <PriceCard label="12x" value={service.latestPrices.installment12} />
                  </>
                )}
                {service.type === 'FULL' && <PriceCard label="21x" value={service.latestPrices.installment21} />}
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-lg font-bold">{service.productionDays}d</p>
                  <p className="text-xs text-muted-foreground">Produção</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-lg font-bold">{service.maxRevisions}</p>
                  <p className="text-xs text-muted-foreground">Revisões</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>{modalTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-medium">Nome do serviço</label>
                  <Input value={form.name} onChange={(event) => updateField('name', event.target.value)} />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-medium">Descrição</label>
                  <Input value={form.description} onChange={(event) => updateField('description', event.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Tipo</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.type}
                    onChange={(event) => {
                      const nextType = event.target.value
                      setForm((current) => ({
                        ...current,
                        type: nextType,
                        prices: {
                          ...current.prices,
                            installment2: nextType === 'AIR' ? current.prices.installment2 : '',
                            installment6: nextType === 'AIR' ? '' : current.prices.installment6,
                            installment12: nextType === 'AIR' ? '' : current.prices.installment12,
                          installment21: nextType === 'FULL' ? current.prices.installment21 : '',
                        },
                      }))
                    }}
                  >
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Prazo de produção (dias)</label>
                  <Input value={form.productionDays} onChange={(event) => updateField('productionDays', event.target.value)} type="number" min="0" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Máx. revisões</label>
                  <Input value={form.maxRevisions} onChange={(event) => updateField('maxRevisions', event.target.value)} type="number" min="0" />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold">Preços</p>
                  <p className="text-xs text-muted-foreground">EA AIR² aceita apenas à vista e 2x. Serviços padrão usam à vista, 6x e 12x. Apenas FULL pode ter 21x.</p>
                </div>
                <div className={`grid gap-3 ${isFull ? 'grid-cols-4' : isAir ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">À vista</label>
                    <Input value={form.prices.cash} onChange={(event) => updatePriceField('cash', event.target.value)} placeholder="0,00" />
                  </div>
                  {isAir ? (
                    <div className="space-y-1">
                      <label className="text-xs font-medium">2x</label>
                      <Input value={form.prices.installment2} onChange={(event) => updatePriceField('installment2', event.target.value)} placeholder="0,00" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">6x</label>
                        <Input value={form.prices.installment6} onChange={(event) => updatePriceField('installment6', event.target.value)} placeholder="0,00" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">12x</label>
                        <Input value={form.prices.installment12} onChange={(event) => updatePriceField('installment12', event.target.value)} placeholder="0,00" />
                      </div>
                    </>
                  )}
                  {isFull && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium">21x</label>
                      <Input value={form.prices.installment21} onChange={(event) => updatePriceField('installment21', event.target.value)} placeholder="0,00" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name.trim()}>
                  {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {form.id ? 'Salvar alterações' : 'Criar serviço'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
