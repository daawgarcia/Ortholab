import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/status-badge'
import { formatDate } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { FlaskConical, Send, Loader2 } from 'lucide-react'

export default function PlanningPage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState({ notes: '', alignerUpper: '', alignerLower: '', setupUrl: '' })

  const { data } = useQuery({
    queryKey: ['cases-planning'],
    queryFn: () => api.get('/cases?status=SUBMITTED&limit=50').then(r => r.data),
  })

  const { data: inPlanningData } = useQuery({
    queryKey: ['cases-in-planning'],
    queryFn: () => api.get('/cases?status=IN_PLANNING&limit=50').then(r => r.data),
  })

  const startPlanning = useMutation({
    mutationFn: (caseId: string) => api.post('/plannings', { caseId, notes: form.notes, alignerUpper: form.alignerUpper ? parseInt(form.alignerUpper) : undefined, alignerLower: form.alignerLower ? parseInt(form.alignerLower) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cases-planning'] }); qc.invalidateQueries({ queryKey: ['cases-in-planning'] }); setSelected(null); toast({ title: 'Planejamento iniciado!' }) },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao iniciar planejamento' }),
  })

  const submitSetup = useMutation({
    mutationFn: ({ planningId }: { planningId: string }) => api.patch(`/plannings/${planningId}/submit-setup`, { setupUrl: form.setupUrl }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cases-in-planning'] }); setSelected(null); toast({ title: 'Setup enviado para aprovação!' }) },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao enviar setup' }),
  })

  const submitted = data?.cases || []
  const inPlanning = inPlanningData?.cases || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Planejamento</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{submitted.length} caso{submitted.length !== 1 ? 's' : ''} aguardando planejamento</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base text-orange-700">Aguardando Início ({submitted.length})</CardTitle></CardHeader>
          <CardContent className="divide-y p-0">
            {submitted.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">Nenhum caso aguardando</p>}
            {submitted.map((c: any) => (
              <div key={c.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">#{c.caseNumber} — {c.patientName}</p>
                  <p className="text-xs text-muted-foreground">{c.dentist?.name} · {formatDate(c.createdAt)}</p>
                </div>
                <Button size="sm" onClick={() => { setSelected(c); setForm({ notes: '', alignerUpper: '', alignerLower: '', setupUrl: '' }) }}>Iniciar</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base text-blue-700">Em Planejamento ({inPlanning.length})</CardTitle></CardHeader>
          <CardContent className="divide-y p-0">
            {inPlanning.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">Nenhum caso em planejamento</p>}
            {inPlanning.map((c: any) => (
              <div key={c.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">#{c.caseNumber} — {c.patientName}</p>
                  <p className="text-xs text-muted-foreground">{c.dentist?.name} · {c.service?.name}</p>
                </div>
                <div className="flex gap-2">
                  <Link to={`/cases/${c.id}`}><Button size="sm" variant="outline">Ver</Button></Link>
                  <Button size="sm" onClick={() => { setSelected({ ...c, mode: 'setup' }); setForm({ notes: '', alignerUpper: '', alignerLower: '', setupUrl: '' }) }}>Enviar Setup</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>{selected.mode === 'setup' ? 'Enviar Setup' : 'Iniciar Planejamento'} — #{selected.caseNumber}</CardTitle>
              <p className="text-sm text-muted-foreground">{selected.patientName}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {selected.mode !== 'setup' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><label className="text-xs font-medium">Alinhadores Superior</label><Input type="number" placeholder="ex: 24" value={form.alignerUpper} onChange={e => setForm(f => ({ ...f, alignerUpper: e.target.value }))} /></div>
                    <div className="space-y-1"><label className="text-xs font-medium">Alinhadores Inferior</label><Input type="number" placeholder="ex: 24" value={form.alignerLower} onChange={e => setForm(f => ({ ...f, alignerLower: e.target.value }))} /></div>
                  </div>
                  <div className="space-y-1"><label className="text-xs font-medium">Notas de planejamento</label><textarea className="w-full min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" placeholder="Observações técnicas..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                </>
              )}
              {selected.mode === 'setup' && (
                <div className="space-y-1"><label className="text-xs font-medium">URL do Setup (vídeo/imagem)</label><Input placeholder="https://..." value={form.setupUrl} onChange={e => setForm(f => ({ ...f, setupUrl: e.target.value }))} /></div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
                <Button
                  onClick={() => selected.mode === 'setup' ? submitSetup.mutate({ planningId: selected.plannings?.[0]?.id }) : startPlanning.mutate(selected.id)}
                  disabled={startPlanning.isPending || submitSetup.isPending}>
                  {(startPlanning.isPending || submitSetup.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Send className="w-4 h-4 mr-2" /> {selected.mode === 'setup' ? 'Enviar para Aprovação' : 'Confirmar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
