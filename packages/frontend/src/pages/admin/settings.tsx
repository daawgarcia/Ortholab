import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { Settings, Mail, Link2, Webhook } from 'lucide-react'
import { api } from '@/lib/api'

export default function AdminSettingsPage() {
  const [registeringWebhook, setRegisteringWebhook] = useState(false)

  const save = () => toast({ title: 'Configurações salvas!', description: 'Aplique via variáveis de ambiente no servidor.' })

  const registerPixWebhook = async () => {
    setRegisteringWebhook(true)
    try {
      const res = await api.post('/dentist-financial/webhooks/pix/register')
      toast({ title: 'Webhook PIX registrado!', description: `URL: ${res.data.webhookUrl}` })
    } catch (err: any) {
      toast({ title: 'Erro ao registrar webhook', description: err.response?.data?.error || err.message, variant: 'destructive' })
    } finally {
      setRegisteringWebhook(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Mail className="w-4 h-4" /> SMTP / E-mail</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {[['SMTP_HOST','Servidor SMTP'],['SMTP_PORT','Porta'],['SMTP_USER','Usuário'],['SMTP_PASS','Senha'],['SMTP_FROM','Remetente']].map(([k, l]) => (
            <div key={k} className="space-y-2"><Label>{l}</Label><Input placeholder={`ex: ${k}`} /></div>
          ))}
          <div className="col-span-2 flex justify-end"><Button onClick={save}>Salvar SMTP</Button></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Link2 className="w-4 h-4" /> Integração TOTVS</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {[['TOTVS_BASE_URL','URL Base'],['TOTVS_API_KEY','API Key'],['TOTVS_WEBHOOK_SECRET','Webhook Secret']].map(([k, l]) => (
            <div key={k} className="col-span-2 space-y-2"><Label>{l}</Label><Input placeholder={k} /></div>
          ))}
          <div className="col-span-2 flex justify-end"><Button onClick={save}>Salvar TOTVS</Button></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Settings className="w-4 h-4" /> Pagamentos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Configure as credenciais dos gateways de pagamento no arquivo <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.env</code> do servidor:</p>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs space-y-1 text-gray-700">
            <p>REDE_PV=seu-pv</p>
            <p>REDE_TOKEN=seu-token</p>
            <p>REDE_ENV=sandbox|production</p>
            <p>SAUDE_SERVICE_URL=https://api...</p>
            <p>SAUDE_SERVICE_KEY=sua-chave</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Webhook className="w-4 h-4" /> Webhook PIX (Rede)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Registra a URL de notificação PIX na Rede. Faça isso <strong>uma única vez</strong> após o deploy em cada ambiente (sandbox/produção).
          </p>
          <Button onClick={registerPixWebhook} disabled={registeringWebhook} variant="outline">
            {registeringWebhook ? 'Registrando...' : 'Registrar Webhook PIX'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
