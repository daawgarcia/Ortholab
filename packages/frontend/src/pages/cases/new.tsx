import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { ArrowLeft, Loader2 } from 'lucide-react'

function getServiceCashPrice(service: any) {
  if (service?.latestPrices?.cash !== undefined && service?.latestPrices?.cash !== null) {
    return Number(service.latestPrices.cash)
  }
  if (service?.prices?.[0]?.price !== undefined && service?.prices?.[0]?.price !== null) {
    return Number(service.prices[0].price)
  }
  return undefined
}

export default function NewCasePage() {
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm()

  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get('/services').then(r => r.data.services),
  })

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/cases', data),
    onSuccess: (res) => {
      toast({ title: 'Caso criado com sucesso!' })
      navigate(`/cases/${res.data.case.id}`)
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao criar caso' }),
  })

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">Novo Caso</h1>
          <p className="text-sm text-muted-foreground">Preencha os dados do paciente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(d => mutation.mutate(d))}>
        <Card>
          <CardHeader><CardTitle>Dados do Paciente</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Nome do paciente *</Label>
              <Input placeholder="Nome completo" {...register('patientName', { required: 'Obrigatório' })} />
              {errors.patientName && <p className="text-xs text-destructive">{String(errors.patientName.message)}</p>}
            </div>
            <div className="space-y-2">
              <Label>Data de nascimento</Label>
              <Input type="date" {...register('patientDob')} />
            </div>
            <div className="space-y-2">
              <Label>Gênero</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('gender')}>
                <option value="">Selecione</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Tipo de serviço</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('serviceId')}>
                <option value="">Selecione um serviço</option>
                {servicesData?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} {getServiceCashPrice(s) !== undefined ? `— R$ ${getServiceCashPrice(s)}` : ''}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Observações clínicas</Label>
              <textarea className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" placeholder="Informações relevantes para o planejamento..." {...register('notes')} />
            </div>
            <div className="col-span-2 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar Caso e Adicionar Documentos
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
