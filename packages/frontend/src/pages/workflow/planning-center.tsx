import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { FileDown } from 'lucide-react'

const COLUMNS = [
  { key: 'IN_PLANNING', label: 'Casos a preparar' },
  { key: 'IN_MOVEMENT', label: 'Casos a movimentar' },
  { key: 'LAB_APPROVAL', label: 'Casos a aprovar resp. lab.' },
  { key: 'WAITING_APPROVAL', label: 'Aguardando aprovação' },
  { key: 'REVISION_REQUESTED', label: 'Casos a alterar (Solicitação dentista)' },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function PlanningCenterPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const advanceMutation = useMutation({
    mutationFn: (caseId: string) => api.post(`/workflow/case/${caseId}/advance`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-center'] });
      qc.invalidateQueries({ queryKey: ['cases'] });
      qc.invalidateQueries({ queryKey: ['case'] });
      toast({ title: 'Caso avançado', description: 'Status do caso atualizado.' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Erro ao avançar caso', description: error?.response?.data?.error || 'Não foi possível avançar o caso' });
    },
  });

  // Buscar todos os casos de todos os status
  const { data, isLoading } = useQuery({
    queryKey: ['planning-center', 'all'],
    queryFn: async () => {
      const results = await Promise.all(
        COLUMNS.map(col => api.get(`/cases?status=${col.key}&limit=200`).then(r => ({ key: col.key, cases: r.data.cases || [] })))
      );
      return results.reduce((acc, cur) => {
        acc[cur.key] = cur.cases;
        return acc;
      }, {} as Record<string, any[]>);
    },
  });

  const exportExcel = async () => {
    const res = await api.get(`/export/cases`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planning-center-todos.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-500 uppercase">Planning Center</h1>
        <Button variant="outline" size="sm" onClick={exportExcel} className="gap-2">
          <FileDown className="w-4 h-4" />
          Exportar Excel
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto bg-white shadow-sm">
        <div className="flex w-full min-w-[900px] divide-x">
          {COLUMNS.map(col => (
            <div key={col.key} className="flex-1 min-w-[220px]">
              <div className="px-4 py-3 font-semibold text-sm text-gray-700 bg-gray-50 border-b sticky top-0 z-10">{col.label}</div>
              <div className="divide-y">
                {isLoading && (
                  <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
                )}
                {!isLoading && (!data?.[col.key] || data[col.key].length === 0) && (
                  <div className="p-8 text-center text-gray-400 text-sm">Nenhum caso</div>
                )}
                {!isLoading && data?.[col.key]?.map((c: any, index: number) => (
                  <div key={c.id} className={`w-full px-3 py-2 flex flex-col gap-2 ${index < data[col.key].length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <button
                      onClick={() => navigate(`/cases/${c.id}`)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-primary font-medium">{new Date(c.createdAt).toLocaleDateString('pt-BR')} | {c.patientName} : {String(c.caseNumber).padStart(6, '0')}</span>
                        <span className="text-xs text-gray-500 ml-auto">{c.dentist?.name} {c.dentist?.clinic ? `• ${c.dentist?.clinic}` : ''}</span>
                      </div>

                    </button>
                    {user && user.role !== 'DENTIST' && (
                      <div className="flex gap-2">
                        <Button
                          size="xs"
                          onClick={() => advanceMutation.mutate(c.id)}
                          variant="outline"
                          disabled={advanceMutation.isLoading}
                        >
                          Avançar fluxo
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
