import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { ChevronLeft } from 'lucide-react'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[260px_1fr] items-center gap-4 px-5 py-3 border-b last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <div>{children}</div>
    </div>
  )
}

export default function OtherServicesFormPage() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    eaSplint: false, eaAir: false, observations: '',
  })

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => api.get(`/patients/${patientId}`).then(r => r.data),
  })

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const mutation = useMutation({
    mutationFn: () => api.post(`/forms/other-services/${patientId}`, form),
    onSuccess: () => {
      toast({ title: 'Ficha de outros serviços salva' })
      navigate(`/patients/${patientId}`)
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Erro', description: e.response?.data?.error }),
  })

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/patients/${patientId}`)} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-500 uppercase">Outros Serviços</h1>
          {patient && <p className="text-sm text-gray-400">{patient.name}</p>}
        </div>
      </div>

      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50">
          <p className="text-sm font-semibold text-gray-700">Selecione os serviços solicitados</p>
        </div>

        <Row label="EA SPLINT">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.eaSplint} onChange={e => set('eaSplint', e.target.checked)}
              className="w-4 h-4 accent-primary" />
            <span className="text-sm text-gray-600">Solicitar EA SPLINT</span>
          </label>
        </Row>

        <Row label="EA Air²">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.eaAir} onChange={e => set('eaAir', e.target.checked)}
              className="w-4 h-4 accent-primary" />
            <span className="text-sm text-gray-600">Solicitar EA Air²</span>
          </label>
        </Row>

        <div className="px-5 py-4">
          <label className="text-sm text-gray-700 block mb-2">Observações</label>
          <textarea
            value={form.observations}
            onChange={e => set('observations', e.target.value)}
            rows={3}
            className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Observações adicionais..."
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(`/patients/${patientId}`)}>Cancelar</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}
