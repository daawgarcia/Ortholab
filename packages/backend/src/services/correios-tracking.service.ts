import axios from 'axios'

interface TrackingEvent {
  date: string
  time: string
  location: string
  status: string
  description: string
}

interface TrackingResult {
  code: string
  delivered: boolean
  events: TrackingEvent[]
  lastEvent?: TrackingEvent
  estimatedDelivery?: string
}

export class CorreiosTracking {
  private apiUrl = 'https://api.linketrack.com/track/json'
  private user: string
  private token: string

  constructor() {
    this.user = process.env.LINKETRACK_USER || ''
    this.token = process.env.LINKETRACK_TOKEN || ''
  }

  /**
   * Consulta o rastreamento de um código
   */
  async track(trackingCode: string): Promise<TrackingResult | null> {
    try {
      // Se não tiver credenciais do LinkTrack, retorna mock
      if (!this.user || !this.token) {
        console.log('[CorreiosTracking] Credenciais não configuradas, retornando mock')
        return this.getMockTracking(trackingCode)
      }

      const response = await axios.get(this.apiUrl, {
        params: {
          user: this.user,
          token: this.token,
          codigo: trackingCode,
        },
        timeout: 10000,
      })

      if (response.data && response.data.eventos) {
        return this.parseTrackingResponse(trackingCode, response.data)
      }

      return null
    } catch (error: any) {
      console.error('[CorreiosTracking] Erro ao consultar:', error.message)
      return this.getMockTracking(trackingCode)
    }
  }

  /**
   * Gera link direto para rastreamento
   */
  getTrackingLink(trackingCode: string): string {
    return `https://rastreamento.correios.com.br/app/index.php?objeto=${trackingCode}`
  }

  /**
   * Gera link do LinkTrack (mais bonito)
   */
  getLinkTrackUrl(trackingCode: string): string {
    return `https://www.linketrack.com/track/?codigo=${trackingCode}`
  }

  /**
   * Parse da resposta da API
   */
  private parseTrackingResponse(code: string, data: any): TrackingResult {
    const events: TrackingEvent[] = data.eventos.map((e: any) => ({
      date: e.data,
      time: e.hora,
      location: e.local,
      status: e.status,
      description: e.descricao,
    }))

    const lastEvent = events[0]
    const delivered = lastEvent?.status?.toLowerCase().includes('entregue') || false

    return {
      code,
      delivered,
      events,
      lastEvent,
    }
  }

  /**
   * Mock para quando API não está configurada
   */
  private getMockTracking(code: string): TrackingResult {
    return {
      code,
      delivered: false,
      events: [
        {
          date: new Date().toLocaleDateString('pt-BR'),
          time: new Date().toLocaleTimeString('pt-BR'),
          location: 'São Paulo - SP',
          status: 'Em trânsito',
          description: 'Objeto postado',
        },
      ],
      lastEvent: {
        date: new Date().toLocaleDateString('pt-BR'),
        time: new Date().toLocaleTimeString('pt-BR'),
        location: 'São Paulo - SP',
        status: 'Em trânsito',
        description: 'Objeto postado',
      },
    }
  }

  /**
   * Verifica se código é válido (formato Correios)
   */
  isValidTrackingCode(code: string): boolean {
    // Formato: 2 letras + 9 números + 2 letras (BR)
    const regex = /^[A-Z]{2}\d{9}[A-Z]{2}$/i
    return regex.test(code.replace(/\s/g, ''))
  }

  /**
   * Formata código de rastreio
   */
  formatTrackingCode(code: string): string {
    const clean = code.replace(/\s/g, '').toUpperCase()
    if (clean.length === 13) {
      return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 11)} ${clean.slice(11)}`
    }
    return clean
  }
}

// Instância singleton
export const correiosTracking = new CorreiosTracking()

export default CorreiosTracking