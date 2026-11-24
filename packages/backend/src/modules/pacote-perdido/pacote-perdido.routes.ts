import { FastifyInstance } from 'fastify'
import { Role } from '@prisma/client'
import { authenticate, JwtPayload } from '../../plugins/auth'

/**
 * "Perdeu MID" / "Perdeu FULL" — o dentista perdeu o pacote do caso.
 * - Só a equipe interna vê (dentista nunca).
 * - Só ADMIN e LAB_TECH marcam ou desfazem.
 * - O financeiro é avisado e, enquanto a integração com o Protheus não estiver ligada,
 *   lança à mão e marca aqui como "lançado no Protheus".
 * Envio automático ao TOTVS: fica pronto para ligar com TOTVS_PACOTE_PERDIDO_URL (o parceiro informa o endpoint).
 */
const PODE_MARCAR: string[] = [Role.ADMIN, Role.LAB_TECH]
const PODE_VER: string[] = [Role.ADMIN, Role.LAB_TECH, Role.FINANCIAL, Role.SELLER, Role.EXPEDITION]
const PODE_LANCAR: string[] = [Role.ADMIN, Role.FINANCIAL]

async function enviarTotvs(fastify: FastifyInstance, registro: any, caso: any): Promise<{ status: string; info?: string }> {
  const url = process.env.TOTVS_PACOTE_PERDIDO_URL
  if (process.env.TOTVS_ENABLED !== 'true' || !url) return { status: 'MANUAL_PENDENTE' }
  const payload = {
    evento: 'PACOTE_PERDIDO', tipo: registro.tipo, caso: caso.caseNumber, caixa: caso.patient?.boxNumber || null,
    paciente: caso.patientName, cpfCnpjDentista: ((caso.dentist as any)?.cnpj || (caso.dentist as any)?.cpf || '').replace(/\D/g, ''),
    codigoTotvs: (caso.dentist as any)?.totvsCode || null, lojaTotvs: (caso.dentist as any)?.totvsLoja || null, motivo: registro.motivo || null, marcadoEm: registro.marcadoEm,
  }
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.TOTVS_API_KEY || ''}` }, body: JSON.stringify(payload) })
    const texto = await r.text()
    await fastify.prisma.totvsLog.create({ data: { direction: 'OUTBOUND', endpoint: '/pacote-perdido', payload: payload as any, status: r.ok ? 'SENT' : 'ERROR' } }).catch(() => {})
    return r.ok ? { status: 'ENVIADO', info: texto.slice(0, 300) } : { status: 'ERRO', info: `HTTP ${r.status}: ${texto.slice(0, 250)}` }
  } catch (e: any) {
    return { status: 'ERRO', info: String(e?.message || e).slice(0, 300) }
  }
}

async function nomes(fastify: FastifyInstance, ids: (string | null | undefined)[]) {
  const lista = [...new Set(ids.filter(Boolean) as string[])]
  if (!lista.length) return {} as Record<string, string>
  const us = await fastify.prisma.user.findMany({ where: { id: { in: lista } }, select: { id: true, name: true } })
  return Object.fromEntries(us.map(u => [u.id, u.name])) as Record<string, string>
}

export async function pacotePerdidoRoutes(fastify: FastifyInstance) {
  // histórico do caso (equipe)
  fastify.get('/caso/:caseId', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    if (!PODE_VER.includes(user.role)) return reply.status(403).send({ error: 'Acesso negado' })
    const { caseId } = request.params as { caseId: string }
    const itens = await fastify.prisma.pacotePerdido.findMany({ where: { caseId }, orderBy: { marcadoEm: 'desc' } })
    const n = await nomes(fastify, itens.flatMap(i => [i.marcadoPorId, i.desfeitoPorId, i.totvsPorId]))
    return {
      podeMarcar: PODE_MARCAR.includes(user.role), podeLancar: PODE_LANCAR.includes(user.role),
      itens: itens.map(i => ({ ...i, marcadoPor: n[i.marcadoPorId], desfeitoPor: i.desfeitoPorId ? n[i.desfeitoPorId] : null, totvsPor: i.totvsPorId ? n[i.totvsPorId] : null })),
    }
  })

  // marcar Perdeu MID / Perdeu FULL
  fastify.post('/caso/:caseId', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    if (!PODE_MARCAR.includes(user.role)) return reply.status(403).send({ error: 'Só admin e laboratório podem marcar pacote perdido' })
    const { caseId } = request.params as { caseId: string }
    const { tipo, motivo } = (request.body as any) || {}
    if (!['MID', 'FULL'].includes(tipo)) return reply.status(400).send({ error: 'Tipo inválido (MID ou FULL)' })
    const caso = await fastify.prisma.case.findUnique({ where: { id: caseId }, include: { patient: true, dentist: true } })
    if (!caso) return reply.status(404).send({ error: 'Caso não encontrado' })
    const ativo = await fastify.prisma.pacotePerdido.findFirst({ where: { caseId, desfeitoEm: null } })
    if (ativo) return reply.status(400).send({ error: `Este caso já está marcado como "Perdeu ${ativo.tipo}". Desfaça antes de marcar outro.` })

    let registro = await fastify.prisma.pacotePerdido.create({
      data: { caseId, tipo, motivo: motivo ? String(motivo).slice(0, 500) : null, marcadoPorId: user.id },
    })
    const envio = await enviarTotvs(fastify, registro, caso)
    if (envio.status !== 'MANUAL_PENDENTE') {
      registro = await fastify.prisma.pacotePerdido.update({ where: { id: registro.id }, data: { totvsStatus: envio.status, totvsEm: new Date(), totvsInfo: envio.info || null } })
    }
    // avisa o financeiro (e admins) dentro do Ortholab
    const fin = await fastify.prisma.user.findMany({ where: { role: { in: [Role.FINANCIAL, Role.ADMIN] }, status: 'ACTIVE' } as any, select: { id: true } }).catch(() => [] as { id: string }[])
    if (fin.length) {
      await fastify.prisma.notification.createMany({
        data: fin.filter(f => f.id !== user.id).map(f => ({
          userId: f.id, title: `Perdeu ${tipo}`,
          message: `${caso.patientName}${caso.patient?.boxNumber ? ` (caixa ${caso.patient.boxNumber})` : ''} — ${caso.dentist?.name || ''}. ${envio.status === 'ENVIADO' ? 'Já enviado ao Protheus.' : 'Lançar no Protheus.'}`,
          link: `/financial?aba=pacotes`,
        })),
      }).catch(() => {})
    }
    return { ok: true, registro }
  })

  // desfazer (marcado por engano)
  fastify.post('/:id/desfazer', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    if (!PODE_MARCAR.includes(user.role)) return reply.status(403).send({ error: 'Só admin e laboratório podem desfazer' })
    const { id } = request.params as { id: string }
    const r = await fastify.prisma.pacotePerdido.findUnique({ where: { id } })
    if (!r || r.desfeitoEm) return reply.status(404).send({ error: 'Registro não encontrado' })
    await fastify.prisma.pacotePerdido.update({ where: { id }, data: { desfeitoEm: new Date(), desfeitoPorId: user.id } })
    return { ok: true, avisoFinanceiro: r.totvsStatus === 'LANCADO_MANUAL' || r.totvsStatus === 'ENVIADO' ? 'Este registro já estava lançado no Protheus: avise o financeiro para estornar.' : null }
  })

  // financeiro: marca como lançado no Protheus (processo manual)
  fastify.post('/:id/lancado', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    if (!PODE_LANCAR.includes(user.role)) return reply.status(403).send({ error: 'Só o financeiro marca como lançado' })
    const { id } = request.params as { id: string }
    const { info } = (request.body as any) || {}
    await fastify.prisma.pacotePerdido.update({ where: { id }, data: { totvsStatus: 'LANCADO_MANUAL', totvsEm: new Date(), totvsPorId: user.id, totvsInfo: info ? String(info).slice(0, 300) : null } })
    return { ok: true }
  })

  // lista para o financeiro
  fastify.get('/', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    if (!PODE_VER.includes(user.role)) return reply.status(403).send({ error: 'Acesso negado' })
    const { status } = request.query as { status?: string }
    const where: any = { desfeitoEm: null }
    if (status === 'pendente') where.totvsStatus = { in: ['MANUAL_PENDENTE', 'ERRO'] }
    else if (status === 'lancado') where.totvsStatus = { in: ['LANCADO_MANUAL', 'ENVIADO'] }
    const itens = await fastify.prisma.pacotePerdido.findMany({
      where, orderBy: { marcadoEm: 'desc' }, take: 300,
      include: { case: { select: { id: true, caseNumber: true, patientName: true, patientId: true, dentist: { select: { name: true, cnpj: true, cpf: true, totvsCode: true, totvsLoja: true } }, patient: { select: { boxNumber: true } } } } },
    })
    const n = await nomes(fastify, itens.flatMap(i => [i.marcadoPorId, i.totvsPorId]))
    const pendentes = await fastify.prisma.pacotePerdido.count({ where: { desfeitoEm: null, totvsStatus: { in: ['MANUAL_PENDENTE', 'ERRO'] } } })
    return { pendentes, itens: itens.map(i => ({ ...i, marcadoPor: n[i.marcadoPorId], totvsPor: i.totvsPorId ? n[i.totvsPorId] : null })) }
  })
}
