import axios from 'axios'

interface WhatsAppConfig {
  baseUrl: string
  sessionName: string
}

class WhatsAppService {
  private config: WhatsAppConfig

  constructor() {
    this.config = {
      baseUrl: process.env.WAHA_API_URL || 'http://localhost:3000',
      sessionName: process.env.WAHA_SESSION_NAME || 'ortholab',
    }
  }

  async sendTextMessage(phone: string, message: string): Promise<boolean> {
    try {
      const cleanPhone = phone.replace(/\D/g, '')
      const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
      const url = `${this.config.baseUrl}/api/${this.config.sessionName}/sendText`
      const response = await axios.post(url, { chatId: `${formattedPhone}@c.us`, text: message }, { timeout: 30000 })
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
    try {
      const url = `${this.config.baseUrl}/api/${this.config.sessionName}/status`
      const response = await axios.get(url, { timeout: 10000 })
      return response.data?.state === 'CONNECTED'
    } catch {
      return false
    }
  }

  async startSession(): Promise<any> {
    try {
      const url = `${this.config.baseUrl}/api/${this.config.sessionName}/start`
      const response = await axios.post(url, {}, { timeout: 10000 })
      return response.data
    } catch (error: any) {
      console.error('[WhatsApp] Erro ao iniciar sessão:', error.message)
      throw error
    }
  }

  async stopSession(): Promise<boolean> {
    try {
      const url = `${this.config.baseUrl}/api/${this.config.sessionName}/stop`
      await axios.post(url, {}, { timeout: 10000 })
      return true
    } catch {
      return false
    }
  }

  async getQrCode(): Promise<string | null> {
    try {
      // WAHA returns QR as base64 image via /auth/qr endpoint
      const url = `${this.config.baseUrl}/api/${this.config.sessionName}/auth/qr`
      const response = await axios.get(url, { timeout: 10000, responseType: 'arraybuffer' })
      const base64 = Buffer.from(response.data).toString('base64')
      const mimeType = response.headers['content-type'] || 'image/png'
      return `data:${mimeType};base64,${base64}`
    } catch {
      try {
        // Fallback: some WAHA versions return JSON with value field
        const url = `${this.config.baseUrl}/api/${this.config.sessionName}/auth/qr`
        const response = await axios.get(url, { timeout: 10000 })
        if (response.data?.value) return response.data.value
        if (response.data?.qr) return response.data.qr
        return null
      } catch {
        return null
      }
    }
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