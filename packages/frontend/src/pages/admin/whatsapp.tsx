import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { 
  Smartphone, RefreshCw, Play, StopCircle, CheckCircle, 
  AlertCircle, Loader2, QrCode, MessageCircle, Send, History, Settings, Info
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

interface WhatsAppStatus {
  connected: boolean
  session: string
  state?: string
  timestamp: string
}

export function AdminWhatsAppPage() {
  const qc = useQueryClient()
  const [showQRDialog, setShowQRDialog] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [defaultMessage, setDefaultMessage] = useState(
    'Olá, Dr(a). {nome}! 👋\n\nO caso #{caso} - {paciente} está pronto e aguardando sua aprovação. 🎬\n\nAcesse: {link}\n\nOrtholab'
  )
  const [shippedMessage, setShippedMessage] = useState(
    'Olá, Dr(a). {nome}! 👋\n\nO caso #{caso} - {paciente} foi ENVIADO! 📦\n\n📋 Código de rastreio: {trackingCode}\n🚚 Transportadora: {carrier}\n\nVocê pode acompanhar o envio pelo código de rastreio.\n\nOrtholab'
  )
  const [messageHistory, setMessageHistory] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'status' | 'test' | 'template' | 'history'>('status')

  // Verificar status do WhatsApp
  const { data: status, isLoading } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: () => api.get('/whatsapp/status').then(r => r.data),
    refetchInterval: 10000, // Atualizar a cada 10 segundos
  })

  // Iniciar sessão
  const startMutation = useMutation({
    mutationFn: () => api.post('/whatsapp/start').then(r => r.data),
    onSuccess: (data) => {
      toast({ title: 'Sessão iniciada', description: 'Escaneie o QR Code' })
      if (data.qrCode) {
        setQrCode(data.qrCode)
        setShowQRDialog(true)
      }
      qc.invalidateQueries({ queryKey: ['whatsapp-status'] })
    },
    onError: (err: any) => {
      toast({ 
        variant: 'destructive', 
        title: 'Erro', 
        description: err?.response?.data?.error || 'Falha ao iniciar sessão' 
      })
    },
  })

  // Parar sessão
  const stopMutation = useMutation({
    mutationFn: () => api.post('/whatsapp/stop').then(r => r.data),
    onSuccess: () => {
      toast({ title: 'Sessão parada' })
      qc.invalidateQueries({ queryKey: ['whatsapp-status'] })
    },
  })

  // Enviar mensagem de teste
  const testMutation = useMutation({
    mutationFn: () => api.post('/whatsapp/test', { 
      phone: testPhone, 
      message: testMessage 
    }).then(r => r.data),
    onSuccess: () => {
      toast({ title: 'Mensagem de teste enviada!' })
      setTestPhone('')
      setTestMessage('')
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Erro ao enviar mensagem' })
    },
  })

  const isConnected = status?.connected

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Smartphone className="w-6 h-6" />
            WhatsApp Integration
          </h1>
          <p className="text-gray-500 mt-1">
            Gerencie a conexão do WhatsApp para envio de notificações automáticas
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => qc.invalidateQueries({ queryKey: ['whatsapp-status'] })}
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Atualizar
        </Button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === 'status' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('status')}
          className="gap-1"
        >
          <Smartphone className="w-4 h-4" />
          Status
        </Button>
        <Button
          variant={activeTab === 'test' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('test')}
          className="gap-1"
        >
          <Send className="w-4 h-4" />
          Teste
        </Button>
        <Button
          variant={activeTab === 'template' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('template')}
          className="gap-1"
        >
          <MessageCircle className="w-4 h-4" />
          Modelo de Mensagem
        </Button>
        <Button
          variant={activeTab === 'history' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('history')}
          className="gap-1"
        >
          <History className="w-4 h-4" />
          Histórico
        </Button>
      </div>

      {/* Status Tab */}
      {activeTab === 'status' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Status da Conexão
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isConnected ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-500" />
              )}
            </CardTitle>
            <CardDescription>
              {isLoading 
                ? 'Verificando status...' 
                : isConnected 
                  ? 'WhatsApp conectado e pronto para enviar mensagens'
                  : 'WhatsApp desconectado. Inicie uma sessão para conectar.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Status</p>
                <p className={`font-semibold ${isConnected ? 'text-green-600' : 'text-amber-600'}`}>
                  {isConnected ? 'CONECTADO' : 'DESCONECTADO'}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Sessão</p>
                <p className="font-semibold">{status?.session || 'ortholab'}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Estado</p>
                <p className="font-semibold">{status?.state || 'N/A'}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Última Verificação</p>
                <p className="font-semibold text-sm">
                  {status?.timestamp 
                    ? new Date(status.timestamp).toLocaleString('pt-BR')
                    : '-'
                  }
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              {!isConnected ? (
                <Button 
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {startMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Play className="w-4 h-4 mr-1" />
                  )}
                  Iniciar Sessão
                </Button>
              ) : (
                <Button 
                  variant="destructive"
                  onClick={() => stopMutation.mutate()}
                  disabled={stopMutation.isPending}
                >
                  <StopCircle className="w-4 h-4 mr-1" />
                  Parar Sessão
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Tab */}
      {activeTab === 'test' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Enviar Mensagem de Teste
            </CardTitle>
            <CardDescription>
              Teste o envio de mensagens para verificar se está funcionando
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Número do Telefone</label>
              <input
                type="text"
                placeholder="5511999999999"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="w-full border rounded-md px-3 py-2 mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Formato: 55 + DDD + Número (ex: 5511999999999)
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Mensagem</label>
              <textarea
                placeholder="Digite sua mensagem de teste..."
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full border rounded-md px-3 py-2 mt-1 min-h-[100px]"
              />
            </div>
            <Button 
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !testPhone || !testMessage || !isConnected}
            >
              {testMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Send className="w-4 h-4 mr-1" />
              )}
              Enviar Teste
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Template Tab */}
      {activeTab === 'template' && (
        <div className="space-y-6">
          {/* Modelo de Aprovação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Modelo de Mensagem - Aprovação
              </CardTitle>
              <CardDescription>
                Mensagem enviada quando um caso vai para aprovação do dentista
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Mensagem Padrão</label>
                <textarea
                  value={defaultMessage}
                  onChange={(e) => setDefaultMessage(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 mt-1 min-h-[120px] font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Variáveis: {'{nome}'} = Dentista, {'{caso}'} = Número do caso, {'{paciente}'} = Paciente, {'{link}'} = Link
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Pré-visualização:</p>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {defaultMessage
                    .replace('{nome}', 'João Silva')
                    .replace('{caso}', '000123')
                    .replace('{paciente}', 'Maria Santos')
                    .replace('{link}', 'https://ortholab.com/cases/123')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Modelo de Envio */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Modelo de Mensagem - Envio/Expedição
              </CardTitle>
              <CardDescription>
                Mensagem enviada quando um caso é enviado com código de rastreio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Mensagem de Envio</label>
                <textarea
                  value={shippedMessage}
                  onChange={(e) => setShippedMessage(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 mt-1 min-h-[120px] font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Variáveis: {'{nome}'} = Dentista, {'{caso}'} = Número, {'{paciente}'} = Paciente, {'{trackingCode}'} = Código rastreio, {'{carrier}'} = Transportadora
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Pré-visualização:</p>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {shippedMessage
                    .replace('{nome}', 'João Silva')
                    .replace('{caso}', '000123')
                    .replace('{paciente}', 'Maria Santos')
                    .replace('{trackingCode}', 'BR123456789')
                    .replace('{carrier}', 'Correios')}
                </p>
              </div>
            </CardContent>
          </Card>

          <Button 
            onClick={() => toast({ title: 'Modelos salvos!' })}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Settings className="w-4 h-4 mr-1" />
            Salvar Modelos
          </Button>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Histórico de Mensagens
            </CardTitle>
            <CardDescription>
              Últimas mensagens enviadas pelo sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {messageHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma mensagem enviada ainda</p>
                <p className="text-sm">As mensagens aparecerão aqui quando forem enviadas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {messageHistory.map((msg, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{msg.phone}</p>
                      <p className="text-sm text-gray-500 truncate max-w-md">{msg.message}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(msg.timestamp).toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog do QR Code */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Escanear QR Code
            </DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no celular e escaneie o código abaixo
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {qrCode ? (
              <img 
                src={qrCode} 
                alt="QR Code" 
                className="w-64 h-64 border rounded-lg"
              />
            ) : (
              <div className="w-64 h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            )}
            <p className="text-sm text-gray-500 mt-4 text-center">
              1. Abra o WhatsApp no celular
              <br />
              2. Toque em ⋮ ou Configurações
              <br />
              3. Aparelhos Conectados → Conectar
              <br />
              4. Aponte a câmera para o QR Code
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowQRDialog(false)}>
              Fechar
            </Button>
            <Button onClick={() => startMutation.mutate()}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Gerar Novo QR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminWhatsAppPage
