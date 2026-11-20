/**
 * Login único entre Portal do Credenciado (WordPress), Ortholab 2 e Esthetic Rewards.
 * Token curto assinado com o segredo compartilhado SSO_SECRET (o mesmo nos três sistemas):
 *   v1.<payload base64url>.<HMAC-SHA256 base64url>
 * payload: { e: e-mail, nm: nome, cpf, cro, o: origem, d: destino, iat, exp, n: nonce }
 * Quem recebe acha o cadastro por e-mail; senão CPF (11 dígitos); senão CRO + primeiro nome.
 */
import crypto from 'node:crypto'

export const SSO_SECRET = process.env.SSO_SECRET || ''
export const SSO_PORTAL_URL = (process.env.SSO_PORTAL_URL || 'https://portal2.estheticaligner.com.br').replace(/\/$/, '')
export const SSO_REWARDS_URL = (process.env.SSO_REWARDS_URL || 'https://pontos.estheticaligner.com.br').replace(/\/$/, '')

export type SsoPayload = { e: string; nm?: string; cpf?: string; cro?: string; o: string; d: string; iat: number; exp: number; n: string }

const usados = new Map<string, number>()

export const soDigitos = (v?: string | null) => String(v || '').replace(/\D/g, '')

export function primeiroNome(v?: string | null) {
  return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/^(dra?|dr\(a\))\.?\s+/, '').trim().split(/\s+/)[0] || ''
}

function assinar(payloadB64: string) {
  return crypto.createHmac('sha256', SSO_SECRET).update('v1.' + payloadB64).digest('base64url')
}

export function gerarToken(dados: { email?: string | null; nome?: string | null; cpf?: string | null; cro?: string | null; destino: string }, validadeSeg = 90) {
  if (!SSO_SECRET) throw new Error('SSO_SECRET não configurado')
  const agora = Math.floor(Date.now() / 1000)
  const p: SsoPayload = {
    e: String(dados.email || '').toLowerCase(), nm: dados.nome || '', cpf: soDigitos(dados.cpf), cro: soDigitos(dados.cro),
    o: 'ortholab', d: dados.destino, iat: agora, exp: agora + validadeSeg, n: crypto.randomBytes(12).toString('base64url'),
  }
  const b = Buffer.from(JSON.stringify(p)).toString('base64url')
  return `v1.${b}.${assinar(b)}`
}

export function verificarToken(token: string, destino: string): SsoPayload | null {
  if (!SSO_SECRET || typeof token !== 'string') return null
  const partes = token.split('.')
  if (partes.length !== 3 || partes[0] !== 'v1') return null
  const a = Buffer.from(assinar(partes[1]))
  const b = Buffer.from(partes[2])
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  let p: SsoPayload
  try { p = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')) } catch { return null }
  const agora = Math.floor(Date.now() / 1000)
  if ((!p.e && !p.cpf && !p.cro) || !p.exp || p.exp < agora || p.iat > agora + 30 || p.d !== destino) return null
  for (const [n, exp] of usados) if (exp < agora) usados.delete(n)
  if (usados.has(p.n)) return null
  usados.set(p.n, p.exp)
  return p
}
