import { FastifyInstance } from 'fastify'
import { Prisma, UserStatus } from '@prisma/client'
import { authenticate, JwtPayload } from '../../plugins/auth'
import { gerarToken, verificarToken, primeiroNome, soDigitos, SSO_PORTAL_URL, SSO_REWARDS_URL, SSO_SECRET } from './sso'

/**
 * GET  /api/auth/sso/entrar?t=...   chega do Portal/Rewards: acha o dentista e abre a sessão no Ortholab.
 * POST /api/auth/sso/link           (logado) gera o link para abrir o Portal ou o Rewards já logado.
 */
export async function ssoRoutes(fastify: FastifyInstance, opts: { concluirLogin: (user: any, request: any) => Promise<any> }) {
  fastify.get('/entrar', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { t } = request.query as { t?: string }
    const p = verificarToken(String(t || ''), 'ortholab')
    if (!p) return reply.redirect('/login?sso=expirado')

    const ativos = { status: UserStatus.ACTIVE, role: 'DENTIST' as any }
    let user = p.e ? await fastify.prisma.user.findFirst({ where: { ...ativos, email: { equals: p.e, mode: 'insensitive' } } }) : null
    if (!user && p.cpf && p.cpf.length === 11) {
      const ids = await fastify.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM "User" WHERE role = 'DENTIST' AND status = 'ACTIVE' AND regexp_replace(coalesce(cpf,''), '\\D', '', 'g') = ${p.cpf} LIMIT 2`)
      if (ids.length === 1) user = await fastify.prisma.user.findUnique({ where: { id: ids[0].id } })
    }
    if (!user && p.cro && p.cro.length >= 3 && p.nm) {
      const cand = await fastify.prisma.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`SELECT id, name FROM "User" WHERE role = 'DENTIST' AND status = 'ACTIVE' AND regexp_replace(coalesce(cro,''), '\\D', '', 'g') = ${p.cro} LIMIT 20`)
      const pn = primeiroNome(p.nm)
      const bate = cand.filter((c) => primeiroNome(c.name) === pn)
      if (bate.length === 1) user = await fastify.prisma.user.findUnique({ where: { id: bate[0].id } })
    }
    if (!user) return reply.redirect('/login?sso=nao-encontrado')

    const sessao = await opts.concluirLogin(user, request)
    await fastify.audit.log(request, { action: 'auth.sso', status: 'OK', resource: 'User', resourceId: user.id, metadata: { origem: p.o } })
    // tokens vão no fragmento (#), que não é enviado a servidores nem fica em logs
    return reply.redirect(`/sso#a=${encodeURIComponent(sessao.accessToken)}&r=${encodeURIComponent(sessao.refreshToken)}`)
  })

  fastify.post('/link', { preHandler: authenticate }, async (request, reply) => {
    if (!SSO_SECRET) return reply.status(503).send({ error: 'Login único ainda não configurado' })
    const { destino } = (request.body || {}) as { destino?: string }
    if (destino !== 'portal' && destino !== 'rewards') return reply.status(400).send({ error: 'Destino inválido' })
    const eu = await fastify.prisma.user.findUnique({ where: { id: (request.user as JwtPayload).id }, select: { email: true, name: true, cpf: true, cro: true } })
    if (!eu) return reply.status(404).send({ error: 'Usuário não encontrado' })
    const t = gerarToken({ email: eu.email, nome: eu.name, cpf: soDigitos(eu.cpf).length === 11 ? eu.cpf : '', cro: eu.cro, destino })
    const url = destino === 'portal' ? `${SSO_PORTAL_URL}/?eap_sso=${encodeURIComponent(t)}` : `${SSO_REWARDS_URL}/sso?t=${encodeURIComponent(t)}`
    return { url }
  })
}
