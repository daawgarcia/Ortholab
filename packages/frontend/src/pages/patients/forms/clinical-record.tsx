import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { ChevronLeft, FileDown } from 'lucide-react'

const EVALUATIONS = [
  'Sem alinhadores',
  'Não trouxe',
  'Bem adaptado',
  'Quase adaptado',
  'Mal adaptado',
]

const ACTIVITIES = [
  'Ativação de elásticos',
  'Anexar botões',
  'Consulta de emergência',
  'Finalizar caso',
  'Impressões',
  'Inserção de attachment',
  'Inserção de botão',
  'Marcar caso como concluído',
  'Novas plaquinhas',
  'Redefinir caso',
]

export default function NewClinicalRecordPage() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState({
    consultationAt: new Date().toISOString().split('T')[0],
    evaluation: '',
    activities: [] as string[],
    observations: '',
  })

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => api.get(`/patients/${patientId}`).then(r => r.data),
  })

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const toggleActivity = (act: string) => {
    setForm(f => ({
      ...f,
      activities: f.activities.includes(act)
        ? f.activities.filter(a => a !== act)
        : [...f.activities, act],
    }))
  }

  const mutation = useMutation({
    mutationFn: () => api.post('/clinical-records', {
      patientId,
      consultationAt: form.consultationAt,
      evaluation: form.evaluation,
      activities: form.activities,
      observations: form.observations,
    }),
    onSuccess: () => {
      toast({ title: 'Ficha clínica registrada' })
      qc.invalidateQueries({ queryKey: ['clinical-records', patientId] })
      navigate(`/patients/${patientId}`)
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Erro', description: e.response?.data?.error }),
  })

  const exportCSV = async () => {
    const res = await api.get(`/export/clinical-records?patientId=${patientId}`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `ficha-clinica-${patient?.name || patientId}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/patients/${patientId}`)} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-500 uppercase">Nova Ficha Clínica</h1>
          {patient && <p className="text-sm text-gray-400">{patient.name}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <FileDown className="w-4 h-4" /> Exportar
        </Button>
      </div>

      <div className="border rounded-lg bg-white shadow-sm overflow-hidden space-y-0 divide-y">
        <div className="grid grid-cols-[200px_1fr] items-center gap-4 px-5 py-3">
          <span className="text-sm text-gray-700">Data da Consulta *</span>
          <input
            type="date"
            value={form.consultationAt}
            onChange={e => set('consultationAt', e.target.value)}
            className="border rounded-md px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="grid grid-cols-[200px_1fr] items-start gap-4 px-5 py-3">
          <span className="text-sm text-gray-700 pt-0.5">Avaliação *</span>
          <div className="space-y-1.5">
            {EVALUATIONS.map(ev => (
              <label key={ev} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="evaluation"
                  checked={form.evaluation === ev}
                  onChange={() => set('evaluation', ev)}
                  className="accent-primary"
                />
                <span className="text-sm text-gray-700">{ev}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[200px_1fr] items-start gap-4 px-5 py-3">
          <span className="text-sm text-gray-700 pt-0.5">Atividades</span>
          <div className="grid grid-cols-2 gap-1.5">
            {ACTIVITIES.map(act => (
              <label key={act} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.activities.includes(act)}
                  onChange={() => toggleActivity(act)}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm text-gray-700">{act}</span>
              </label>
            ))}
          </div>
        </div>

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
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.evaluation}>
          {mutation.isPending ? 'Salvando...' : 'Salvar Ficha Clínica'}
        </Button>
      </div>
    </div>
  )
}
