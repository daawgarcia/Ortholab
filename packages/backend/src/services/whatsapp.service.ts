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
      const url = `${this.config.baseUrl}/api/sendText`
      const response = await axios.post(url, { session: this.config.sessionName, chatId: `${formattedPhone}@c.us`, text: message }, { timeout: 30000, headers: this.headers() })
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
    const state = await this.getSessionState()
    return state === 'WORKING' || state === 'CONNECTED'
  }

  async getSessionState(): Promise<string> {
    const { baseUrl, sessionName } = this.config
    // Tenta primeiro GET /api/sessions/{name} (WAHA Plus)
    try {
      const res = await axios.get(`${baseUrl}/api/sessions/${sessionName}`, { timeout: 10000, headers: this.headers() })
      if (res.status === 200 && res.data) {
        return res.data.status || res.data.state || 'UNKNOWN'
      }
    } catch { /* tenta listar todas */ }
    // Fallback: GET /api/sessions (lista todas - WAHA free)
    try {
      const res = await axios.get(`${baseUrl}/api/sessions`, { timeout: 10000, headers: this.headers() })
      const sessions: any[] = Array.isArray(res.data) ? res.data : []
      const found = sessions.find((s: any) => s.name === sessionName)
      if (!found) return 'NOT_FOUND'
      return found.status || found.state || 'UNKNOWN'
    } catch {
      return 'ERROR'
    }
  }

  async startSession(): Promise<any> {
    const { baseUrl, sessionName } = this.config

    const state = await this.getSessionState()
    console.log(`[WhatsApp] Estado atual da sessão: ${state}`)

    if (state === 'WORKING' || state === 'CONNECTED') {
      return { status: 'already_connected' }
    }

    if (state === 'SCAN_QR_CODE' || state === 'STARTING') {
      return { status: 'already_starting', state }
    }

    if (state === 'STOPPED' || state === 'FAILED') {
      try {
        const res = await axios.post(`${baseUrl}/api/sessions/${sessionName}/start`, {}, { timeout: 15000, headers: this.headers() })
        return res.data
      } catch (startErr: any) {
        if (startErr.response?.status === 422 || startErr.response?.status === 400) {
          return { status: 'already_starting' }
        }
        throw startErr
      }
    }

    // Sessão não existe → cria e inicia
    try {
      const res = await axios.post(`${baseUrl}/api/sessions`, { name: sessionName, start: true }, { timeout: 15000, headers: this.headers() })
      return res.data
    } catch (err: any) {
      const status = err.response?.status
      if (status === 422 || status === 409) {
        try {
          const res = await axios.post(`${baseUrl}/api/sessions/${sessionName}/start`, {}, { timeout: 15000, headers: this.headers() })
          return res.data
        } catch (startErr: any) {
          if (startErr.response?.status === 422 || startErr.response?.status === 400) {
            return { status: 'already_starting' }
          }
          throw startErr
        }
      }
      console.error('[WhatsApp] Erro ao criar sessão:', err.response?.data || err.message)
      throw err
    }
  }

  async forceRestartSession(): Promise<any> {
    const { baseUrl, sessionName } = this.config
    // Para a sessão atual (ignora erros)
    try { await axios.post(`${baseUrl}/api/sessions/${sessionName}/stop`, {}, { timeout: 10000, headers: this.headers() }) } catch { /* silent */ }
    // Tenta deletar (WAHA Plus) — ignora se não suportado
    try { await axios.delete(`${baseUrl}/api/sessions/${sessionName}`, { timeout: 10000, headers: this.headers() }) } catch { /* silent */ }
    // Tenta criar e iniciar
    try {
      const res = await axios.post(`${baseUrl}/api/sessions`, { name: sessionName, start: true }, { timeout: 15000, headers: this.headers() })
      return res.data
    } catch (err: any) {
      // Sessão ainda existe (delete não suportado no WAHA free) → apenas inicia
      if (err.response?.status === 422 || err.response?.status === 409) {
        try {
          const res = await axios.post(`${baseUrl}/api/sessions/${sessionName}/start`, {}, { timeout: 15000, headers: this.headers() })
          return res.data
        } catch (startErr: any) {
          if (startErr.response?.status === 422 || startErr.response?.status === 400) {
            return { status: 'already_starting' }
          }
          throw startErr
        }
      }
      throw err
    }
  }

  async stopSession(): Promise<boolean> {
    const { baseUrl, sessionName } = this.config
    try {
      await axios.post(`${baseUrl}/api/sessions/${sessionName}/stop`, {}, { timeout: 10000, headers: this.headers() })
      return true
    } catch {
      return false
    }
  }

  async getQrCode(): Promise<string | null> {
    const { baseUrl, sessionName } = this.config
    const url = `${baseUrl}/api/${sessionName}/auth/qr`
    // Tenta como imagem binária
    try {
      const res = await axios.get(url, { timeout: 10000, responseType: 'arraybuffer', headers: this.headers() })
      const mime = res.headers['content-type'] || 'image/png'
      if (mime.startsWith('image/')) {
        return `data:${mime};base64,${Buffer.from(res.data).toString('base64')}`
      }
    } catch { /* tenta JSON */ }
    // Tenta como JSON
    try {
      const res = await axios.get(url, { timeout: 10000, headers: this.headers() })
      if (res.data?.value) return res.data.value
      if (res.data?.qr) return res.data.qr
    } catch { /* sem QR disponível */ }
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