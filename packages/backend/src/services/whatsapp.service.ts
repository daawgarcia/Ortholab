import axios from 'axios'

interface WhatsAppConfig {
  baseUrl: string
  sessionName: string
  apiKey: string
}

class WhatsAppService {
  private config: WhatsAppConfig

  constructor() {
    this.config = {
      baseUrl: process.env.WAHA_API_URL || 'http://localhost:3000',
      sessionName: process.env.WAHA_SESSION_NAME || 'ortholab',
      apiKey: process.env.WAHA_API_KEY || '',
    }
  }

  private headers() {
    const h: Record<string, string> = {}
    if (this.config.apiKey) h['X-Api-Key'] = this.config.apiKey
    return h
  }

  async sendTextMessage(phone: string, message: string): Promise<boolean> {
    try {
      const cleanPhone = phone.replace(/\D/g, '')
      const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
      const url = `${this.config.baseUrl}/api/${this.config.sessionName}/sendText`
      const response = await axios.post(url, { chatId: `${formattedPhone}@c.us`, text: message }, { timeout: 30000, headers: this.headers() })
      if (response.status === 200 || response.status === 201) {
        console.log(`[WhatsApp] Mensagem enviada para ${formattedPhone}`)
        return true
      }
      return false
    } catch (error: any) {
      console.error('[WhatsApp] Erro ao enviar mensagem:', error.message)
      if (error.response) {
        console.error('[WhatsApp] Status:', error.response.status)
        console.error('[WhatsApp] Data:', error.response.data)
      }
      return false
    }
  }

  async checkSession(): Promise<boolean> {
    const { baseUrl, sessionName } = this.config
    // WAHA 2024+: GET /api/sessions/{name}
    try {
      const res = await axios.get(`${baseUrl}/api/sessions/${sessionName}`, { timeout: 10000, headers: this.headers() })
      const s = res.data?.status || res.data?.state || ''
      return s === 'WORKING' || s === 'CONNECTED'
    } catch {
      // fallback API antiga
      try {
        const res = await axios.get(`${baseUrl}/api/${sessionName}/status`, { timeout: 10000, headers: this.headers() })
        return res.data?.state === 'CONNECTED'
      } catch {
        return false
      }
    }
  }

  async startSession(): Promise<any> {
    const { baseUrl, sessionName } = this.config
    // WAHA 2024+: criar sessão primeiro se não existir, depois iniciar
    try {
      await axios.post(`${baseUrl}/api/sessions`, { name: sessionName, config: {} }, { timeout: 15000, headers: this.headers() })
    } catch (err: any) {
      // 422 = sessão já existe — tudo bem, continua
      if (err.response?.status !== 422) {
        // API antiga: tentar direto
        console.warn('[WhatsApp] POST /api/sessions falhou, tentando API antiga:', err.message)
      }
    }
    // Iniciar a sessão (nova API: /api/sessions/{name}/start  |  antiga: /api/{name}/start)
    try {
      const res = await axios.post(`${baseUrl}/api/sessions/${sessionName}/start`, {}, { timeout: 15000, headers: this.headers() })
      return res.data
    } catch (err: any) {
      // fallback API antiga
      const res = await axios.post(`${baseUrl}/api/${sessionName}/start`, {}, { timeout: 15000, headers: this.headers() })
      return res.data
    }
  }

  async stopSession(): Promise<boolean> {
    const { baseUrl, sessionName } = this.config
    try {
      await axios.post(`${baseUrl}/api/sessions/${sessionName}/stop`, {}, { timeout: 10000, headers: this.headers() })
      return true
    } catch {
      try {
        await axios.post(`${baseUrl}/api/${sessionName}/stop`, {}, { timeout: 10000, headers: this.headers() })
        return true
      } catch {
        return false
      }
    }
  }

  async getQrCode(): Promise<string | null> {
    const { baseUrl, sessionName } = this.config
    // Tenta obter QR como imagem binária
    for (const url of [
      `${baseUrl}/api/sessions/${sessionName}/auth/qr`,
      `${baseUrl}/api/${sessionName}/auth/qr`,
    ]) {
      try {
        const res = await axios.get(url, { timeout: 10000, responseType: 'arraybuffer', headers: this.headers() })
        const mime = res.headers['content-type'] || 'image/png'
        if (mime.startsWith('image/')) {
          return `data:${mime};base64,${Buffer.from(res.data).toString('base64')}`
        }
      } catch { /* tenta próximo */ }
      // Tenta como JSON
      try {
        const res = await axios.get(url, { timeout: 10000, headers: this.headers() })
        if (res.data?.value) return res.data.value
        if (res.data?.qr) return res.data.qr
      } catch { /* tenta próximo */ }
    }
    return null
  }

  async sendCaseApprovalNotification(phone: string, dentistName: string, caseNumber: number, patientName: string, frontendUrl: string): Promise<boolean> {
    const message = `Olá, Dr(a). ${dentistName}! 👋\n\nO caso *#${String(caseNumber).padStart(6, '0')}* - ${patientName} está pronto e aguardando sua aprovação. 🎬\n\nAcesse a plataforma para visualizar o vídeo e aprovar o caso:\n${frontendUrl}\n\nOrtholab - Esthetic Aligner`
    return this.sendTextMessage(phone, message)
  }

  async sendCaseApprovedNotification(phone: string, dentistName: string, caseNumber: number, patientName: string): Promise<boolean> {
    const message = `Olá, Dr(a). ${dentistName}! 👋\n\nO caso *#${String(caseNumber).padStart(6, '0')}* - ${patientName} foi *APROVADO*! ✅\n\nO caso seguirá para produção.\n\nOrtholab - Esthetic Aligner`
    return this.sendTextMessage(phone, message)
  }

  async sendCaseShippedNotification(phone: string, dentistName: string, caseNumber: number, patientName: string, trackingCode: string, carrier?: string): Promise<boolean> {
    const message = `Olá, Dr(a). ${dentistName}! 👋\n\nO caso *#${String(caseNumber).padStart(6, '0')}* - ${patientName} foi *ENVIADO*! 📦\n\n📋 Código de rastreio: *${trackingCode}*\n${carrier ? `🚚 Transportadora: ${carrier}\n` : ''}\nVocê pode acompanhar o envio pelo código de rastreio.\n\nOrtholab - Esthetic Aligner`
    return this.sendTextMessage(phone, message)
  }

  async sendRevisionRequestedNotification(phone: string, dentistName: string, caseNumber: number, patientName: string, notes?: string): Promise<boolean> {
    let message = `Olá, Dr(a). ${dentistName}! 👋\n\nO caso *#${String(caseNumber).padStart(6, '0')}* - ${patientName} teve uma *REVISÃO SOLICITADA*. 📝\n\n`
    if (notes) message += `Observações: ${notes}\n\n`
    message += `Entre em contato conosco para mais detalhes.\n\nOrtholab - Esthetic Aligner`
    return this.sendTextMessage(phone, message)
  }
}

export const whatsappService = new WhatsAppService()

export async function sendWhatsAppNotification(phone: string | null | undefined, message: string): Promise<boolean> {
  if (!phone) return false
  return whatsappService.sendTextMessage(phone, message)
}

export default WhatsAppService