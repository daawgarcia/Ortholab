import { PrismaClient, Role } from '@prisma/client'
import type { JwtPayload } from '../../plugins/auth'

/**
 * Escopo por país (laboratórios por país, como no Ortholab 1).
 *  - Admin e Vendas: veem tudo.
 *  - Funcionário do Brasil (ou sem país definido): vê tudo.
 *  - Funcionário estrangeiro: só o(s) seu(s) país(es).
 *  - Dentista: só o que é dele (tratado em cada rota).
 * Retorna null = sem restrição de país.
 */
export const PAISES = ['brasil', 'portugal', 'colombia', 'mexico', 'peru', 'espanha'] as const

const SINONIMOS: Record<string, string[]> = {
  brasil: ['brasil', 'br', 'brazil'],
  portugal: ['portugal', 'pt'],
  colombia: ['colombia', 'colômbia', 'co'],
  mexico: ['mexico', 'méxico', 'mx'],
  peru: ['peru', 'perú', 'pe'],
  espanha: ['espanha', 'españa', 'espana', 'es', 'spain'],
}

export function normalizarPais(v?: string | null): string {
  const s = String(v || '').trim().toLowerCase()
  if (!s) return 'brasil'
  for (const [pais, nomes] of Object.entries(SINONIMOS)) if (nomes.includes(s)) return pais
  return s
}

const cache = new Map<string, { em: number; paises: string[] }>()

export async function paisesDoUsuario(prisma: PrismaClient, user: JwtPayload): Promise<string[] | null> {
  if (user.role === Role.ADMIN || user.role === Role.SELLER || user.role === Role.DENTIST) return null
  const c = cache.get(user.id)
  let lista: string[]
  if (c && Date.now() - c.em < 60_000) lista = c.paises
  else {
    const eu = await prisma.user.findUnique({ where: { id: user.id }, select: { allowedCountries: true } })
    lista = (eu?.allowedCountries || []).map(normalizarPais)
    cache.set(user.id, { em: Date.now(), paises: lista })
  }
  if (!lista.length || lista.includes('brasil')) return null
  return lista
}

export function limparCacheEscopo(userId?: string) {
  if (userId) cache.delete(userId)
  else cache.clear()
}

/** Filtro Prisma para o campo country de um dentista (User). */
export function whereDentistaPais(paises: string[]) {
  const nomes = paises.flatMap(p => SINONIMOS[p] || [p])
  const ors: any[] = nomes.map(n => ({ country: { equals: n, mode: 'insensitive' } }))
  if (paises.includes('brasil')) ors.push({ country: null })
  return { OR: ors }
}

/** O dentista está no escopo do usuário? */
export async function dentistaNoEscopo(prisma: PrismaClient, user: JwtPayload, dentistId: string) {
  const paises = await paisesDoUsuario(prisma, user)
  if (!paises) return true
  const d = await prisma.user.findUnique({ where: { id: dentistId }, select: { country: true } })
  return paises.includes(normalizarPais(d?.country))
}

/** Idioma da interface pelo país: espanhol para México, Colômbia, Peru e Espanha. */
export function idiomaDoPais(pais?: string | null): 'pt' | 'es' {
  return ['colombia', 'mexico', 'peru', 'espanha'].includes(normalizarPais(pais)) ? 'es' : 'pt'
}
