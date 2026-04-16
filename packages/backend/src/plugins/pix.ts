import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    pix: PixService
  }
}

// CRC16-CCITT (0xFFFF) — algoritmo exigido pelo padrão BR Code do Banco Central
function crc16(str: string): string {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`
}

export interface PixGenerateParams {
  pixKey: string
  merchantName: string      // max 25 chars
  merchantCity: string      // max 15 chars
  amount: number            // em reais (ex: 199.90)
  txid?: string             // referência interna (max 25 chars alfanumérico)
  description?: string      // descrição (max 72 chars)
}

export class PixService {
  readonly isConfigured: boolean
  private pixKey: string
  private merchantName: string
  private merchantCity: string

  constructor() {
    this.pixKey = process.env.PIX_KEY || ''
    this.merchantName = (process.env.PIX_MERCHANT_NAME || 'ESTHETIC ALIGNER').substring(0, 25)
    this.merchantCity = (process.env.PIX_MERCHANT_CITY || 'SAO PAULO').substring(0, 15)
    this.isConfigured = !!this.pixKey
  }

  /**
   * Gera o payload EMV (copia-e-cola) para QR Code Pix estático com valor.
   * Segue o padrão BR Code v2.0.0 do Banco Central do Brasil.
   */
  generatePayload(amount: number, txid?: string, description?: string): string {
    return this.generateCustomPayload({
      pixKey: this.pixKey,
      merchantName: this.merchantName,
      merchantCity: this.merchantCity,
      amount,
      txid,
      description,
    })
  }

  generateCustomPayload(params: PixGenerateParams): string {
    const { pixKey, merchantName, merchantCity, amount, txid, description } = params

    const amountStr = amount.toFixed(2)

    // MAI — Merchant Account Information (ID 26)
    let maiContent = field('00', 'BR.GOV.BCB.PIX') + field('01', pixKey)
    if (description) maiContent += field('02', description.substring(0, 72))
    const mai = field('26', maiContent)

    // ADF — Additional Data Field (ID 62): referência obrigatória
    const cleanTxid = (txid || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || '***'
    const adf = field('62', field('05', cleanTxid))

    // Monta payload sem CRC
    const payload = [
      field('00', '01'),                            // Payload Format Indicator
      field('01', '12'),                            // Point of Initiation (12 = QR de uso único)
      mai,                                           // Merchant Account Info
      field('52', '0000'),                          // MCC genérico
      field('53', '986'),                           // Moeda BRL
      field('54', amountStr),                       // Valor
      field('58', 'BR'),                            // País
      field('59', merchantName.substring(0, 25)),   // Nome recebedor
      field('60', merchantCity.substring(0, 15)),   // Cidade recebedor
      adf,                                           // Dados adicionais
      '6304',                                        // Prefixo CRC (sem valor ainda)
    ].join('')

    return payload + crc16(payload)
  }
}

const pixPlugin: FastifyPluginAsync = fp(async (server) => {
  server.decorate('pix', new PixService())
})

export { pixPlugin }
