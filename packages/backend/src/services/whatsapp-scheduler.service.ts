import { FastifyInstance } from 'fastify'

interface ScheduledMessage {
  id: string
  phone: string
  message: string
  scheduledAt: Date
  status: 'pending' | 'sent' | 'failed'
}

export class WhatsAppScheduler {
  private fastify: FastifyInstance
  private scheduledMessages: ScheduledMessage[] = []
  private checkInterval: NodeJS.Timeout | null = null

  // Horário comercial padrão
  private businessHours = {
    start: 8,  // 8h
    end: 20,   // 20h
  }

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify
    this.startScheduler()
  }

  /**
   * Inicia o scheduler para verificar mensagens pendentes
   */
  private startScheduler() {
    // Verificar a cada minuto
    this.checkInterval = setInterval(() => {
      this.processScheduledMessages()
    }, 60000) // 1 minuto

    console.log('[WhatsAppScheduler] Scheduler iniciado')
  }

  /**
   * Para o scheduler
   */
  stopScheduler() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  /**
   * Verifica se está dentro do horário comercial
   */
  isBusinessHours(): boolean {
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDay() // 0 = Domingo, 6 = Sábado

    // Não enviar no domingo
    if (day === 0) return false

    // Sábado só até 12h
    if (day === 6 && hour >= 12) return false

    return hour >= this.businessHours.start && hour < this.businessHours.end
  }

  /**
   * Agenda uma mensagem para ser enviada
   */
  scheduleMessage(phone: string, message: string, scheduledAt?: Date): ScheduledMessage {
    // Se não especificar horário, envia no próximo horário comercial
    let sendAt = scheduledAt
    
    if (!sendAt) {
      sendAt = this.getNextBusinessTime()
    } else if (!this.isBusinessHours() || !this.isBusinessTime(sendAt)) {
      // Se o horário agendado for fora do comercial, ajusta para o próximo horário comercial
      sendAt = this.getNextBusinessTime(sendAt)
    }

    const scheduled: ScheduledMessage = {
      id: Math.random().toString(36).substring(7),
      phone,
      message,
      scheduledAt: sendAt,
      status: 'pending',
    }

    this.scheduledMessages.push(scheduled)
    
    console.log(`[WhatsAppScheduler] Mensagem agendada para ${sendAt.toISOString()}`)
    
    return scheduled
  }

  /**
   * Processa mensagens agendadas
   */
  private async processScheduledMessages() {
    const now = new Date()
    
    // Só processa se estiver em horário comercial
    if (!this.isBusinessHours()) {
      return
    }

    const pendingMessages = this.scheduledMessages.filter(
      m => m.status === 'pending' && m.scheduledAt <= now
    )

    for (const message of pendingMessages) {
      try {
        // Importar serviço de WhatsApp dinamicamente
        const { whatsappService } = await import('./whatsapp.service')
        
        const success = await whatsappService.sendTextMessage(
          message.phone,
          message.message
        )

        message.status = success ? 'sent' : 'failed'
        
        console.log(`[WhatsAppScheduler] Mensagem ${message.id} ${success ? 'enviada' : 'falhou'}`)
      } catch (error) {
        message.status = 'failed'
        console.error(`[WhatsAppScheduler] Erro ao enviar mensagem ${message.id}:`, error)
      }
    }

    // Limpar mensagens antigas (enviadas ou falhas há mais de 24h)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    this.scheduledMessages = this.scheduledMessages.filter(
      m => m.status === 'pending' || m.scheduledAt > oneDayAgo
    )
  }

  /**
   * Retorna o próximo horário comercial
   */
  private getNextBusinessTime(from?: Date): Date {
    let date = from ? new Date(from) : new Date()
    
    // Se for domingo, vai para segunda
    if (date.getDay() === 0) {
      date.setDate(date.getDate() + 1)
      date.setHours(this.businessHours.start, 0, 0, 0)
      return date
    }
    
    // Se for sábado após 12h, vai para segunda
    if (date.getDay() === 6 && date.getHours() >= 12) {
      date.setDate(date.getDate() + 2)
      date.setHours(this.businessHours.start, 0, 0, 0)
      return date
    }
    
    // Se for antes do horário comercial, ajusta para início
    if (date.getHours() < this.businessHours.start) {
      date.setHours(this.businessHours.start, 0, 0, 0)
      return date
    }
    
    // Se for após o horário comercial, vai para o próximo dia
    if (date.getHours() >= this.businessHours.end) {
      date.setDate(date.getDate() + 1)
      
      // Se for sábado, pula para segunda
      if (date.getDay() === 6) {
        date.setDate(date.getDate() + 2)
      }
      // Se for domingo, pula para segunda
      if (date.getDay() === 0) {
        date.setDate(date.getDate() + 1)
      }
      
      date.setHours(this.businessHours.start, 0, 0, 0)
      return date
    }
    
    return date
  }

  /**
   * Verifica se um horário específico é comercial
   */
  private isBusinessTime(date: Date): boolean {
    const hour = date.getHours()
    const day = date.getDay()

    if (day === 0) return false
    if (day === 6 && hour >= 12) return false

    return hour >= this.businessHours.start && hour < this.businessHours.end
  }

  /**
   * Retorna mensagens agendadas
   */
  getScheduledMessages(): ScheduledMessage[] {
    return this.scheduledMessages
  }

  /**
   * Cancela uma mensagem agendada
   */
  cancelMessage(id: string): boolean {
    const index = this.scheduledMessages.findIndex(m => m.id === id)
    if (index >= 0 && this.scheduledMessages[index].status === 'pending') {
      this.scheduledMessages.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Atualiza horário comercial
   */
  setBusinessHours(start: number, end: number) {
    this.businessHours = { start, end }
  }
}

// Singleton
let scheduler: WhatsAppScheduler | null = null

export function initWhatsAppScheduler(fastify: FastifyInstance): WhatsAppScheduler {
  if (!scheduler) {
    scheduler = new WhatsAppScheduler(fastify)
  }
  return scheduler
}

export function getWhatsAppScheduler(): WhatsAppScheduler | null {
  return scheduler
}