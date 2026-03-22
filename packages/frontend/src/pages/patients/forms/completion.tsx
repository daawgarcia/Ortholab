import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { ChevronLeft } from 'lucide-react'
import { DentalChart, ToothData } from '@/components/dental-chart'

const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
const UPPER_GAPS = [' ', '17-18', '16-17', '15-16', '14-15', '13-14', '12-13', '11-12', '21-22', '22-23', '23-24', '24-25', '25-26', '26-27', '27-28']
const LOWER_GAPS = [' ', '47-48', '46-47', '45-46', '44-45', '43-44', '42-43', '41-42', '31-32', '32-33', '33-34', '34-35', '35-36', '36-37', '37-38']

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[280px_1fr] items-start gap-4 px-5 py-3 border-b last:border-0">
      <span className="text-sm text-gray-700 pt-0.5">{label}</span>
      <div>{children}</div>
    </div>
  )
}

function Radio({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-4 flex-wrap">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
          <input type="radio" checked={value === opt} onChange={() => onChange(opt)} className="accent-primary" />
          <span className="text-sm">{opt}</span>
        </label>
      ))}
    </div>
  )
}

export default function CompletionFormPage() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    arcadas: '', teethMovements: {} as Record<number, string>,
    gaps: {} as Record<string, string>,
    contentionUpper: '', contentionLower: '',
    observations: '',
  })
  const [toothChart, setToothChart] = useState<ToothData>({})

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => api.get(`/patients/${patientId}`).then(r => r.data),
  })

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const setMovement = (tooth: number, v: string) => setForm(f => ({ ...f, teethMovements: { ...f.teethMovements, [tooth]: v } }))
  const setGap = (gap: string, v: string) => setForm(f => ({ ...f, gaps: { ...f.gaps, [gap]: v } }))

  const mutation = useMutation({
    mutationFn: () => api.post(`/forms/completion/${patientId}`, {
      formData: { ...form, teethChart: toothChart },
      contentionUpper: parseInt(form.contentionUpper) || null,
      contentionLower: parseInt(form.contentionLower) || null,
      observations: form.observations,
    }),
    onSuccess: () => {
      toast({ title: 'Ficha de finalização salva' })
      navigate(`/patients/${patientId}`)
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Erro', description: e.response?.data?.error }),
  })

  const activeTeeth = form.arcadas === 'Superior' ? UPPER
    : form.arcadas === 'Inferior' ? LOWER
    : [...UPPER, ...LOWER]

  const activeGaps = form.arcadas === 'Superior' ? UPPER_GAPS.filter(g => g !== ' ')
    : form.arcadas === 'Inferior' ? LOWER_GAPS.filter(g => g !== ' ')
    : [...UPPER_GAPS, ...LOWER_GAPS].filter(g => g !== ' ')

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/patients/${patientId}`)} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-500 uppercase">Ficha de Finalização</h1>
          {patient && <p className="text-sm text-gray-400">{patient.name}</p>}
        </div>
      </div>

      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <Row label="Arcadas a serem tratadas *">
          <Radio options={['Superior', 'Inferior', 'Ambas']} value={form.arcadas} onChange={v => set('arcadas', v)} />
        </Row>

        {form.arcadas && (
          <>
            <div className="px-5 py-4 border-b">
              <p className="text-sm text-gray-700 mb-3">Dentes (estado atual)</p>
              <DentalChart value={toothChart} onChange={setToothChart} />
            </div>

            <div className="px-5 py-4 border-b">
              <p className="text-sm text-gray-700 mb-3">Movimentos por dente</p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {activeTeeth.map(n => (
                  <div key={n} className="text-center">
                    <p className="text-xs text-gray-500 mb-1">{n}</p>
                    <select
                      value={form.teethMovements[n] || ''}
                      onChange={e => setMovement(n, e.target.value)}
                      className="w-full border rounded text-xs px-1 py-1"
                    >
                      <option value="">—</option>
                      <option>Intrusão</option>
                      <option>Extrusão</option>
                      <option>Vestibularização</option>
                      <option>Lingualização</option>
                      <option>Mesiação</option>
                      <option>Distalização</option>
                      <option>Rotação M</option>
                      <option>Rotação D</option>
                      <option>Torque +</option>
                      <option>Torque -</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-4 border-b">
              <p className="text-sm text-gray-700 mb-3">Espaços interproximais (mm)</p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {activeGaps.map(gap => (
                  <div key={gap} className="text-center">
                    <p className="text-[10px] text-gray-500 mb-1">{gap}</p>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      value={form.gaps[gap] || ''}
                      onChange={e => setGap(gap, e.target.value)}
                      className="w-full border rounded text-xs px-1 py-1 text-center"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-0 border-b">
              <Row label="Contenção Superior (nº alinhadores)">
                <input
                  type="number" min={0}
                  value={form.contentionUpper}
                  onChange={e => set('contentionUpper', e.target.value)}
                  className="border rounded px-2 py-1.5 text-sm w-24"
                  placeholder="0"
                />
              </Row>
              <Row label="Contenção Inferior (nº alinhadores)">
                <input
                  type="number" min={0}
                  value={form.contentionLower}
                  onChange={e => set('contentionLower', e.target.value)}
                  className="border rounded px-2 py-1.5 text-sm w-24"
                  placeholder="0"
                />
              </Row>
            </div>
          </>
        )}

        <div className="px-5 py-4">
          <Label className="text-sm text-gray-700 block mb-2">Observações</Label>
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
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.arcadas}>
          {mutation.isPending ? 'Salvando...' : 'Salvar Ficha'}
        </Button>
      </div>
    </div>
  )
}
