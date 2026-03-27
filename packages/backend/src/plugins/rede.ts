import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    rede: RedeService
  }
}

interface RedeTransactionResponse {
  returnCode: string
  returnMessage: string
  tid: string
  nsu: string
  authorizationCode?: string
  status?: string
  [key: string]: unknown
}

interface RedeCreateTransactionParams {
  amount: number           // em reais (ex: 199.90)
  installments: number     // 1 = à vista, 2-21 = parcelado
  cardNumber: string
  cardHolder: string
  expirationMonth: string  // "01"-"12"
  expirationYear: string   // "2027"
  securityCode: string
  softDescriptor?: string
  reference: string        // ID interno (paymentId ou invoicePaymentId)
  capture?: boolean        // default true
}

class RedeService {
  private pv: string
  private token: string
  private baseUrl: string

  constructor() {
    this.pv = process.env.REDE_PV || ''
    this.token = process.env.REDE_TOKEN || ''

    const env = (process.env.REDE_ENV || 'sandbox').toLowerCase()
    this.baseUrl = env === 'production'
      ? 'https://api.userede.com.br/erede/v1'
      : 'https://api.userede.com.br/desenvolvedores/v1'
  }

  get isConfigured(): boolean {
    return !!this.pv && !!this.token
  }

  private get authHeader(): string {
    return 'Basic ' + Buffer.from(`${this.pv}:${this.token}`).toString('base64')
  }

  /**
   * Cria uma transação de crédito (à vista ou parcelada)
   */
  async createTransaction(params: RedeCreateTransactionParams): Promise<RedeTransactionResponse> {
    if (!this.isConfigured) throw new Error('Rede não configurada (REDE_PV/REDE_TOKEN ausentes)')

    const amountInCents = Math.round(params.amount * 100)

    const body: Record<string, unknown> = {
      capture: params.capture ?? true,
      reference: params.reference,
      amount: amountInCents,
      installments: params.installments,
      cardholderName: params.cardHolder,
      cardNumber: params.cardNumber.replace(/\s/g, ''),
      expirationMonth: params.expirationMonth.padStart(2, '0'),
      expirationYear: params.expirationYear,
      securityCode: params.securityCode,
      softDescriptor: params.softDescriptor || 'ESTHETIC ALIG',
    }

    // Parcelado loja (seller) - lojista assume juros
    if (params.installments > 1) {
      body.kind = 'credit'
    }

    const response = await fetch(`${this.baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json() as RedeTransactionResponse

    if (!response.ok || (data.returnCode && data.returnCode !== '00')) {
      const msg = data.returnMessage || `Erro Rede HTTP ${response.status}`
      throw new Error(`Rede: ${data.returnCode || response.status} - ${msg}`)
    }

    return data
  }

  /**
   * Consulta uma transação pelo TID
   */
  async getTransaction(tid: string): Promise<RedeTransactionResponse> {
    if (!this.isConfigured) throw new Error('Rede não configurada')

    const response = await fetch(`${this.baseUrl}/transactions/${tid}`, {
      method: 'GET',
      headers: { 'Authorization': this.authHeader },
    })

    return response.json() as Promise<RedeTransactionResponse>
  }

  /**
   * Cancela/estorna uma transação
   */
  async cancelTransaction(tid: string, amount?: number): Promise<RedeTransactionResponse> {
    if (!this.isConfigured) throw new Error('Rede não configurada')

    const url = amount
      ? `${this.baseUrl}/transactions/${tid}/refunds`
      : `${this.baseUrl}/transactions/${tid}`

    const options: RequestInit = {
      method: amount ? 'POST' : 'DELETE',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
    }

    if (amount) {
      options.body = JSON.stringify({ amount: Math.round(amount * 100) })
    }

    const response = await fetch(url, options)
    return response.json() as Promise<RedeTransactionResponse>
  }
}

const redePlugin: FastifyPluginAsync = fp(async (server) => {
  server.decorate('rede', new RedeService())
})

export { redePlugin, RedeService }
