import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Download, Package, Clock, Eye, CheckCircle, 
  TrendingUp, Calendar, FileText, Truck
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export function ReportsPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  // Relatório de casos enviados
  const { data: shippedData } = useQuery({
    queryKey: ['reports-shipped', startDate, endDate],
    queryFn: () => api.get(`/reports/shipped?startDate=${startDate}&endDate=${endDate}`).then(r => r.data),
  })

  // Taxa de aprovação
  const { data: approvalData } = useQuery({
    queryKey: ['reports-approval', startDate, endDate],
    queryFn: () => api.get(`/reports/approval-rates?startDate=${startDate}&endDate=${endDate}`).then(r => r.data),
  })

  // Tempo médio por etapa
  const { data: stageData } = useQuery({
    queryKey: ['reports-stages', startDate, endDate],
    queryFn: () => api.get(`/reports/stage-times?startDate=${startDate}&endDate=${endDate}`).then(r => r.data),
  })

  // Tracking de visualizações
  const { data: trackingData } = useQuery({
    queryKey: ['reports-tracking'],
    queryFn: () => api.get('/reports/view-tracking').then(r => r.data),
  })

  const handleExport = (type: 'shipped' | 'approvals') => {
    window.open(`/api/reports/export?type=${type}&startDate=${startDate}&endDate=${endDate}`, '_blank')
    toast({ title: 'Download iniciado!' })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Relatórios
          </h1>
          <p className="text-gray-500 mt-1">Análise de desempenho e métricas do sistema</p>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
      </div>

      <Tabs defaultValue="shipped">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="shipped" className="gap-1">
            <Truck className="w-4 h-4" />
            Casos Enviados
          </TabsTrigger>
          <TabsTrigger value="approval" className="gap-1">
            <CheckCircle className="w-4 h-4" />
            Taxa de Aprovação
          </TabsTrigger>
          <TabsTrigger value="stages" className="gap-1">
            <Clock className="w-4 h-4" />
            Tempo por Etapa
          </TabsTrigger>
          <TabsTrigger value="tracking" className="gap-1">
            <Eye className="w-4 h-4" />
            Visualizações
          </TabsTrigger>
        </TabsList>

        {/* Casos Enviados */}
        <TabsContent value="shipped" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Casos Enviados
                </CardTitle>
                <CardDescription>
                  Total: {shippedData?.total || 0} casos enviados no período
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => handleExport('shipped')}>
                <Download className="w-4 h-4 mr-1" />
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {shippedData?.grouped && Object.entries(shippedData.grouped).map(([date, data]: [string, any]) => (
                  <div key={date} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">{new Date(date).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <span className="text-lg font-bold text-blue-600">{data.count} casos</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Taxa de Aprovação */}
        <TabsContent value="approval" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Taxa de Aprovação por Dentista
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {approvalData?.dentists?.map((d: any) => (
                  <div key={d.dentist.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">{d.dentist.name}</p>
                        <p className="text-sm text-gray-500">{d.dentist.clinic}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">{d.approvalRate}%</p>
                        <p className="text-sm text-gray-500">Taxa de aprovação</p>
                      </div>
                    </div>                    
                    <div className="flex gap-4 text-sm">
                      <span className="text-blue-600">✓ {d.approved} aprovados</span>
                      <span className="text-red-600">✗ {d.rejected} revisões</span>
                      <span className="text-amber-600">⏳ {d.pending} pendentes</span>
                      <span className="text-gray-500">Total: {d.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tempo por Etapa */}
        <TabsContent value="stages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Tempo Médio por Etapa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stageData?.stages && Object.entries(stageData.stages).map(([stage, data]: [string, any]) => (
                  <div key={stage} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">{stage}</span>
                    <div className="text-right">
                      <p className="text-lg font-bold">{data.avg.toFixed(1)}h</p>
                      <p className="text-xs text-gray-500">média de {data.count} casos</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Visualizações */}
        <TabsContent value="tracking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Tracking de Visualizações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h3 className="font-medium">Vídeos</h3>
                <div className="space-y-2">
                  {trackingData?.videos?.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{v.title}</p>
                        <p className="text-sm text-gray-500">
                          Caso #{v.case?.caseNumber} - {v.case?.patient?.name}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {v.viewed && <span className="text-green-600 text-sm">✓ Visualizado</span>}
                        {v.downloaded && <span className="text-blue-600 text-sm">⬇ Baixado</span>}
                        {!v.viewed && <span className="text-amber-600 text-sm">⏳ Pendente</span>}
                      </div>
                    </div>
                  ))}
                </div>

                <h3 className="font-medium mt-6">Documentos PDF</h3>
                <div className="space-y-2">
                  {trackingData?.documents?.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{d.title}</p>
                        <p className="text-sm text-gray-500">
                          Caso #{d.case?.caseNumber} - {d.case?.patient?.name}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {d.viewed && <span className="text-green-600 text-sm">✓ Visualizado</span>}
                        {d.downloaded && <span className="text-blue-600 text-sm">⬇ Baixado</span>}
                        {!d.viewed && <span className="text-amber-600 text-sm">⏳ Pendente</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}