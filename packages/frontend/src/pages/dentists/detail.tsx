import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { ChevronLeft, UserCircle } from 'lucide-react'

export default function DentistDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})

  const { data: dentist, isLoading } = useQuery({
    queryKey: ['dentist', id],
    queryFn: () => api.get(`/dentists/${id}`).then(r => r.data),
    onSuccess: (d: any) => setForm({
      deliveryStreet: d.deliveryStreet || '',
      deliveryNumber: d.deliveryNumber || '',
      deliveryComplement: d.deliveryComplement || '',
      deliveryNeighborhood: d.deliveryNeighborhood || '',
      deliveryCity: d.deliveryCity || '',
      deliveryState: d.deliveryState || '',
      deliveryZip: d.deliveryZip || '',
      deliveryPhone: d.deliveryPhone || '',
      deliveryMobile: d.deliveryMobile || '',
      phone: d.phone || '',
      clinic: d.clinic || '',
    }),
  } as any)

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/dentists/${id}`, form),
    onSuccess: () => {
      toast({ title: 'Endereço de envio atualizado' })
      qc.invalidateQueries({ queryKey: ['dentist', id] })
      setEditing(false)
    },
  })

  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }))

  if (isLoading) return <div className="p-6 text-gray-400">Carregando...</div>
  if (!dentist) return <div className="p-6 text-red-500">Dentista não encontrado</div>

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dentists')} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-500 uppercase">Dentista</h1>
        <button onClick={() => navigate(`/patients?dentistId=${id}`)} className="ml-auto text-sm text-primary hover:underline">
          Ver Pacientes →
        </button>
      </div>

      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
          <UserCircle className="w-4 h-4 text-gray-400" />
          <p className="text-sm font-semibold text-gray-700">Info do Dentista</p>
          {dentist.totvsCode && <span className="ml-auto text-xs text-gray-400">TOTVS: {dentist.totvsCode}</span>}
        </div>
        <div className="p-5 grid grid-cols-2 gap-4 text-sm">
          <Info label="Nome" value={dentist.name} />
          <Info label="E-mail" value={dentist.email} />
          <Info label="CRO" value={dentist.cro} />
          <Info label="Clínica" value={dentist.clinic} />
          <Info label="CNPJ" value={dentist.cnpj} />
          <Info label="País" value={dentist.country} />
          <Info label="Pacientes" value={`${dentist._count?.patients ?? 0}`} />
          <Info label="Casos" value={`${dentist._count?.cases ?? 0}`} />
        </div>
      </div>

      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Endereço de Envio</p>
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Editar</Button>
          )}
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          {editing ? (
            <>
              <Field label="Rua *" value={form.deliveryStreet} onChange={v => set('deliveryStreet', v)} />
              <Field label="Número *" value={form.deliveryNumber} onChange={v => set('deliveryNumber', v)} />
              <Field label="Complemento" value={form.deliveryComplement} onChange={v => set('deliveryComplement', v)} />
              <Field label="Bairro" value={form.deliveryNeighborhood} onChange={v => set('deliveryNeighborhood', v)} />
              <Field label="CEP *" value={form.deliveryZip} onChange={v => set('deliveryZip', v)} />
              <Field label="Cidade *" value={form.deliveryCity} onChange={v => set('deliveryCity', v)} />
              <Field label="UF" value={form.deliveryState} onChange={v => set('deliveryState', v)} />
              <Field label="Tel Comercial" value={form.deliveryPhone} onChange={v => set('deliveryPhone', v)} />
              <Field label="Celular" value={form.deliveryMobile} onChange={v => set('deliveryMobile', v)} />
              <div className="col-span-2 flex gap-3 justify-end pt-2">
                <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Info label="Rua" value={[dentist.deliveryStreet, dentist.deliveryNumber, dentist.deliveryComplement].filter(Boolean).join(', ')} />
              <Info label="Bairro" value={dentist.deliveryNeighborhood} />
              <Info label="CEP" value={dentist.deliveryZip} />
              <Info label="Cidade / UF" value={[dentist.deliveryCity, dentist.deliveryState].filter(Boolean).join(' / ')} />
              <Info label="Tel Comercial" value={dentist.deliveryPhone} />
              <Info label="Celular" value={dentist.deliveryMobile} />
            </>
          )}
        </div>
      </div>

      {dentist.patients?.length > 0 && (
        <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <p className="text-sm font-semibold text-gray-700">Últimos Pacientes</p>
          </div>
          <div className="divide-y">
            {dentist.patients.map((p: any) => (
              <button key={p.id} onClick={() => navigate(`/patients/${p.id}`)}
                className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-gray-50 transition-colors">
                <span className="text-sm font-medium">{p.name}</span>
                <span className="text-xs text-gray-400 ml-auto">{p._count?.cases ?? 0} caso(s)</span>
                <span className={`text-xs ${p.active ? 'text-green-600' : 'text-gray-400'}`}>{p.active ? 'Ativo' : 'Inativo'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800">{value || '—'}</p>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input className="mt-1" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}
