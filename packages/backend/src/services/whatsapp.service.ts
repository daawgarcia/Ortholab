import axios from 'axios'

interface WhatsAppConfig {
  baseUrl: string
  sessionName: string
}

interface WhatsAppMessage {
  phone: string
  message: string
}

class WhatsAppService {
  private config: WhatsAppConfig

  constructor() {
    this.config = {
      baseUrl: process.env.WAHA_API_URL || 'http://localhost:3000',
      sessionName: process.env.WAHA_SESSION_NAME || 'ortholab',
    }
  }

  /**
   * Envia mensagem de texto via WhatsApp usando WAHA
   */
  async sendTextMessage(phone: string, message: string): Promise<boolean> {
    try {
      // Limpar número de telefone (remover caracteres não numéricos)
      const cleanPhone = phone.replace(/\D/g, '')
      
      // Adicionar código do país se não tiver (Brasil = 55)
      const formattedPhone = cleanPhone.startsWith('55') 
        ? cleanPhone 
        : `55${cleanPhone}`

      const url = `${this.config.baseUrl}/api/${this.config.sessionName}/sendText`

      const response = await axios.post(url, {
        chatId: `${formattedPhone}@c.us`,
        text: message,
      }, {
        timeout: 30000, // 30 segundos timeout
      })

      if (response.status === 200 || response.status === 201) {
        console.log(`[WhatsApp] Mensagem enviada para ${formattedPhone}`)
        return true
      }

      return false
    } catch (error: any) {
      console.error('[WhatsApp] Erro ao enviar mensagem:', error.message)
      
      // Log detalhado do erro
      if (error.response) {
        console.error('[WhatsApp] Status:', error.response.status)
        console.error('[WhatsApp] Data:', error.response.data)
      }
      
      return false
    }
  }

  /**
   * Verifica se a sessão do WAHA está ativa
   */
  async checkSession(): Promise<boolean> {
    try {
      const url = `${this.config.baseUrl}/api/${this.config.sessionName}/status`
      const response = await axios.get(url, { timeout: 10000 })
      
      return response.data?.state === 'CONNECTED'
    } catch (error) {
      console.error('[WhatsApp] Sessão não está ativa')
      return false
    }
  }

  /**
   * Inicia sessão do WhatsApp (gera QR code para scan)
   */
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

  /**
   * Para a sessão do WhatsApp
   */
  async stopSession(): Promise<boolean> {
    try {
      const url = `${this.config.baseUrl}/api/${this.config.sessionName}/stop`
      await axios.post(url, {}, { timeout: 10000 })
      return true
    } catch (error) {
      console.error('[WhatsApp] Erro ao parar sessão')
      return false
    }
  }

  /**
   * Envia mensagem de aprovação de caso
   */
  async sendCaseApprovalNotification(
    phone: string,
    dentistName: string,
    caseNumber: number,
    patientName: string,
    frontendUrl: string
  ): Promise<boolean> {
    const message = `Olá, Dr(a). ${dentistName}! 👋\n\n` +
      `O caso *#${String(caseNumber).padStart(6, '0')}* - ${patientName} está pronto e aguardando sua aprovação. 🎬\n\n` +
      `Acesse a plataforma para visualizar o vídeo e aprovar o caso:\n` +
      `${frontendUrl}\n\n` +
      `Ortholab - Esthetic Aligner`

    return this.sendTextMessage(phone, message)
  }

  /**
   * Envia mensagem de caso aprovado
   */
  async sendCaseApprovedNotification(
    phone: string,
    dentistName: string,
    caseNumber: number,
    patientName: string
  ): Promise<boolean> {
    const message = `Olá, Dr(a). ${dentistName}! 👋\n\n` +
      `O caso *#${String(caseNumber).padStart(6, '0')}* - ${patientName} foi *APROVADO*! ✅\n\n` +
      `O caso seguirá para produção.\n\n` +
      `Ortholab - Esthetic Aligner`

    return this.sendTextMessage(phone, message)
  }

  /**
   * Envia notificação de caso enviado (expedição)
   */
  async sendCaseShippedNotification(
    phone: string,
    dentistName: string,
    caseNumber: number,
    patientName: string,
    trackingCode: string,
    carrier?: string
  ): Promise<boolean> {
    const message = `Olá, Dr(a). ${dentistName}! 👋\n\n` +
      `O caso *#${String(caseNumber).padStart(6, '0')}* - ${patientName} foi *ENVIADO*! 📦\n\n` +
      `📋 Código de rastreio: *${trackingCode}*\n` +
      `${carrier ? `🚚 Transportadora: ${carrier}\n` : ''}\n` +
      `Você pode acompanhar o envio pelo código de rastreio.\n\n` +
      `Ortholab - Esthetic Aligner`

    return this.sendTextMessage(phone, message)
  }

  /**
   * Envia mensagem de revisão solicitada
   */
  async sendRevisionRequestedNotification(
    phone: string,
    dentistName: string,
    caseNumber: number,
    patientName: string,
    notes?: string
  ): Promise<boolean> {
    let message = `Olá, Dr(a). ${dentistName}! 👋\n\n` +
      `O caso *#${String(caseNumber).padStart(6, '0')}* - ${patientName} teve uma *REVISÃO SOLICITADA*. 📝\n\n`
    
    if (notes) {
      message += `Observações: ${notes}\n\n`
    }
    
    message += `Entre em contato conosco para mais detalhes.\n\n` +
      `Ortholab - Esthetic Aligner`

    return this.sendTextMessage(phone, message)
  }
}

// Exportar instância singleton
export const whatsappService = new WhatsAppService()

// Função auxiliar para uso em rotas
export async function sendWhatsAppNotification(
  phone: string | null | undefined,
  message: string
): Promise<boolean> {
  if (!phone) {
    console.log('[WhatsApp] Telefone não fornecido, pulando envio')
    return false
  }

  return whatsappService.sendTextMessage(phone, message)
}

export default WhatsAppService