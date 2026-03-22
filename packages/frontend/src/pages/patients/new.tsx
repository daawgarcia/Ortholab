import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

const PRODUCTS = [
  { key: 'ALINHADORES', label: 'Alinhadores' },
  { key: 'FINALIZACAO', label: 'Finalização' },
  { key: 'PLACA_MIORRELAXANTE', label: 'Placa Miorrelaxante' },
  { key: 'EA_AIR2', label: 'EA Air²' },
]

function ToothSVG({ number, selected, onClick }: { number: number; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 group"
    >
      <span className={`text-xs font-medium transition-colors ${selected ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'}`}>
        {number}
      </span>
      <div className={`w-7 h-10 rounded border-2 transition-all ${
        selected
          ? 'border-primary bg-primary/10'
          : 'border-gray-200 bg-gray-50 group-hover:border-gray-300'
      }`} />
    </button>
  )
}

function AlignerForm({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const set = (field: string, val: any) => onChange({ ...value, [field]: val })
  const radio = (field: string, options: string[]) => (
    <div className="flex gap-4">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
          <input type="radio" name={field} checked={value[field] === opt} onChange={() => set(field, opt)} className="accent-primary" />
          <span className="text-sm">{opt}</span>
        </label>
      ))}
    </div>
  )

  const [selectedTeeth, setSelectedTeeth] = useState<number[]>(value.selectedTeeth || [])
  const toggleTooth = (n: number) => {
    const next = selectedTeeth.includes(n) ? selectedTeeth.filter(t => t !== n) : [...selectedTeeth, n]
    setSelectedTeeth(next)
    set('selectedTeeth', next)
  }

  return (
    <div className="space-y-0 divide-y border rounded-lg bg-white">
      <FormRow label="Arcadas a serem tratadas *">
        {radio('arcadas', ['Superior', 'Inferior', 'Ambas'])}
      </FormRow>
      <FormRow label="Expansão superior *">
        {radio('expansaoSuperior', ['Sim', 'Não', 'Se necessário'])}
      </FormRow>
      <FormRow label="Expansão inferior *">
        {radio('expansaoInferior', ['Sim', 'Não', 'Se necessário'])}
      </FormRow>
      <FormRow label="Desgaste interproximal *">
        {radio('desgaste', ['Aceita', 'Não aceita'])}
      </FormRow>
      <FormRow label="Comprimento de arco superior *">
        {radio('arcoSuperior', ['Manter', 'Aumentar', 'Reduzir'])}
      </FormRow>
      <FormRow label="Comprimento de arco inferior *">
        {radio('arcoInferior', ['Manter', 'Aumentar', 'Reduzir'])}
      </FormRow>

      <div className="px-5 py-4">
        <p className="text-sm text-gray-700 mb-3">Melhorar os seguintes dentes:</p>
        <div className="space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            {UPPER_TEETH.map(n => <ToothSVG key={n} number={n} selected={selectedTeeth.includes(n)} onClick={() => toggleTooth(n)} />)}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {LOWER_TEETH.map(n => <ToothSVG key={n} number={n} selected={selectedTeeth.includes(n)} onClick={() => toggleTooth(n)} />)}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        <p className="text-sm text-gray-500 italic">Linha média (correções maiores que 2mm, desgaste ou mudança do comp. de arco podem ser necessárias):</p>
        <div className="grid grid-cols-[80px_1fr_1fr_1fr] items-center gap-3">
          <span className="text-sm text-gray-700">Superior *</span>
          {radio('linhaSuperiorMov', ['Manter', 'Mover'])}
          {value.linhaSuperiorMov === 'Mover' && radio('linhaSuperiorDir', ['D', 'E'])}
          {value.linhaSuperiorMov === 'Mover' && radio('linhaSuperiorMm', ['1-2mm', '+2mm'])}
        </div>
        <div className="grid grid-cols-[80px_1fr_1fr_1fr] items-center gap-3">
          <span className="text-sm text-gray-700">Inferior *</span>
          {radio('linhaInferiorMov', ['Manter', 'Mover'])}
          {value.linhaInferiorMov === 'Mover' && radio('linhaInferiorDir', ['D', 'E'])}
          {value.linhaInferiorMov === 'Mover' && radio('linhaInferiorMm', ['1-2mm', '+2mm'])}
        </div>
      </div>

      <FormRow label="Relação sagital *">
        {radio('relacaoSagital', ['Manter', 'Melhorar Classe II', 'Melhorar Classe III'])}
      </FormRow>
      <FormRow label="Sobremordida *">
        {radio('sobremordida', ['Manter', 'Melhorar'])}
      </FormRow>
      <FormRow label="Sobressaliência *">
        {radio('sobressaliencia', ['Manter', 'Melhorar'])}
      </FormRow>
      <FormRow label="Espaço superior *">
        {radio('espacoSuperior', ['Manter', 'Fechar espaços possíveis', 'Criar espaços possíveis'])}
      </FormRow>
      <FormRow label="Espaço inferior *">
        {radio('espacoInferior', ['Manter', 'Fechar espaços possíveis', 'Criar espaços possíveis'])}
      </FormRow>

      <div className="px-5 py-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Attachments *</p>
        <div className="space-y-2">
          <div className="flex items-center gap-6">
            <span className="text-sm text-gray-600 w-48">Aceita attachments anteriores</span>
            {radio('attachAnt', ['Sim', 'Não'])}
          </div>
          <div className="flex items-center gap-6">
            <span className="text-sm text-gray-600 w-48">Aceita attachments posteriores</span>
            {radio('attachPost', ['Sim', 'Não'])}
          </div>
          <p className="text-xs text-gray-400 italic">A não realização de attachments impedem a realização de certos movimentos</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-2">
        <p className="text-sm font-medium text-gray-700">Acessórios *</p>
        <div className="flex items-center gap-6">
          <span className="text-sm text-gray-600 w-80">Aceita botões ortodônticos e a mecânica dos elásticos (sempre se necessário):</span>
          {radio('acessorios', ['Sim', 'Não'])}
        </div>
        <p className="text-xs text-gray-400 italic">A não realização dos mesmos impedem a realização de certos movimentos</p>
      </div>

      <FormRow label="Tipo do caso *">
        {radio('tipoCaso', ['Convencional', 'Periodontal'])}
      </FormRow>

      <div className="px-5 py-4">
        <label className="text-sm text-gray-700 block mb-2">Observações</label>
        <textarea
          value={value.observacoes || ''}
          onChange={e => set('observacoes', e.target.value)}
          rows={3}
          className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Observações adicionais..."
        />
      </div>
    </div>
  )
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[280px_1fr] items-center gap-4 px-5 py-3">
      <span className="text-sm text-gray-700">{label}</span>
      <div>{children}</div>
    </div>
  )
}

export default function NewPatientPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [planningForm, setPlanningForm] = useState<any>({})

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { name: '', gender: 'M', dob: '', dentistId: '', active: true },
  })

  const { data: dentistsData } = useQuery({
    queryKey: ['dentists-select'],
    queryFn: () => api.get('/admin/dentists').then(r => r.data),
    enabled: user?.role !== 'DENTIST',
  })

  const toggleTooth = (n: number) => {
    setSelectedTeeth(prev => prev.includes(n) ? prev.filter(t => t !== n) : [...prev, n])
  }

  const createMutation = useMutation({
    mutationFn: async (formData: any) => {
      const patient = await api.post('/patients', {
        ...formData,
        teethData: { present: selectedTeeth },
        dentistId: user?.role === 'DENTIST' ? user.id : formData.dentistId,
      })

      if (selectedProduct) {
        await api.post('/cases', {
          patientName: formData.name,
          patientId: patient.data.id,
          productType: selectedProduct,
          planningFormData: selectedProduct === 'ALINHADORES' ? planningForm : {},
          status: 'DRAFT',
        })
      }
      return patient.data
    },
    onSuccess: (patient) => {
      toast({ title: 'Paciente cadastrado com sucesso' })
      navigate(`/patients/${patient.id}`)
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Erro', description: err.response?.data?.error || 'Erro ao cadastrar' })
    },
  })

  const onSubmit = (data: any) => createMutation.mutate(data)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/patients')} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-500 uppercase">Paciente — Novo</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <p className="text-sm font-semibold text-gray-700">Novo paciente</p>
          </div>
          <div className="p-5 grid grid-cols-2 gap-5">
            <div className="col-span-2 grid grid-cols-[1fr_auto_auto] gap-5 items-end">
              <div>
                <Label>Nome *</Label>
                <Input {...register('name', { required: true })} placeholder="Nome completo" className="mt-1" />
              </div>
              <div>
                <Label>Sexo</Label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="radio" value="M" {...register('gender')} className="accent-primary" />
                    Masc
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="radio" value="F" {...register('gender')} className="accent-primary" />
                    Fem
                  </label>
                </div>
              </div>
              <div>
                <Label>Data de Nascimento</Label>
                <Input type="date" {...register('dob')} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-5 items-end col-span-2">
              {user?.role !== 'DENTIST' && dentistsData?.dentists ? (
                <div>
                  <Label>Dentista *</Label>
                  <select {...register('dentistId', { required: user?.role !== 'DENTIST' })}
                    className="mt-1 w-full border rounded-md px-3 py-2 text-sm">
                    <option value="">Selecione o dentista</option>
                    {dentistsData.dentists.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name}{d.clinic ? ` — ${d.clinic}` : ''}</option>
                    ))}
                  </select>
                </div>
              ) : <div />}
              <div>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                  <input type="checkbox" {...register('active')} defaultChecked className="accent-primary w-4 h-4" />
                  Ativo
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <p className="text-sm font-semibold text-gray-700">Dentes</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex gap-2 flex-wrap justify-center">
              {UPPER_TEETH.map(n => <ToothSVG key={n} number={n} selected={selectedTeeth.includes(n)} onClick={() => toggleTooth(n)} />)}
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              {LOWER_TEETH.map(n => <ToothSVG key={n} number={n} selected={selectedTeeth.includes(n)} onClick={() => toggleTooth(n)} />)}
            </div>
          </div>
        </div>

        <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <p className="text-sm font-semibold text-gray-700">Tipo de Tratamento (opcional)</p>
          </div>
          <div className="p-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PRODUCTS.map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => setSelectedProduct(prev => prev === p.key ? '' : p.key)}
                className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all text-center ${
                  selectedProduct === p.key
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-200 text-gray-600 hover:border-primary/50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {selectedProduct === 'ALINHADORES' && (
          <div className="space-y-3">
            <h2 className="font-bold text-gray-500 uppercase tracking-wide">Planejamento Alinhadores</h2>
            <AlignerForm value={planningForm} onChange={setPlanningForm} />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/patients')}>Cancelar</Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </div>
  )
}
