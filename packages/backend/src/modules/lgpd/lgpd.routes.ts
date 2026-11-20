import { FastifyInstance, FastifyRequest } from 'fastify'
import { Role } from '@prisma/client'
import { authenticate, requireRole, JwtPayload } from '../../plugins/auth'
import { MINUTAS } from './minutas'

const DOCUMENTOS = ['termos-de-uso', 'politica-de-privacidade'] as const

/** Cria as minutas dos textos (Termos e Política) se ainda não existirem — o admin edita em Conteúdo. */
export async function prepararLgpd(fastify: FastifyInstance) {
  for (const slug of DOCUMENTOS) {
    const existe = await fastify.prisma.contentPage.findUnique({ where: { slug } })
    if (!existe) {
      await fastify.prisma.contentPage.create({ data: { slug, title: MINUTAS[slug].title, body: MINUTAS[slug].body } })
    }
  }
}

/**
 * Registro de acesso a dados pessoais de pacientes (LGPD art. 37 — registro das operações de tratamento).
 * Grava quem abriu ficha, fotos, arquivos, prontuário ou exportou dados, de onde e quando.
 */
const ROTAS_SENSIVEIS: Array<{ re: RegExp; recurso: string }> = [
  { re: /^\/api\/patients\/([0-9a-f-]{36})(\/(photos|private-photos|digital-models|work-files|clinical-records|forms|cases))?(\?|$)/, recurso: 'Patient' },
  { re: /^\/api\/cases\/([0-9a-f-]{36})(\?|$)/, recurso: 'Case' },
  { re: /^\/api\/export\//, recurso: 'Export' },
  { re: /^\/api\/lgpd\/pacientes\/([0-9a-f-]{36})\/exportar/, recurso: 'Patient' },
]

export function registrarAuditoriaDeAcesso(fastify: FastifyInstance) {
  fastify.addHook('onResponse', async (request: FastifyRequest, reply) => {
    if (request.method !== 'GET' || reply.statusCode >= 400) return
    const user = request.user as JwtPayload | undefined
    if (!user) return
    const url = request.url
    for (const r of ROTAS_SENSIVEIS) {
      const m = url.match(r.re)
      if (m) {
        fastify.audit.log(request, {
          action: 'lgpd.acesso',
          resource: r.recurso,
          resourceId: m[1] && m[1].length === 36 ? m[1] : undefined,
          metadata: { rota: url.split('?')[0], parte: m[3] || null },
        }).catch(() => {})
        return
      }
    }
  })
}

function ipDe(request: FastifyRequest) {
  return (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || request.ip || null
}

export async function lgpdRoutes(fastify: FastifyInstance) {
  // ---------------------------------------------------------------- aceite de termos
  fastify.get('/termos/pendentes', { preHandler: authenticate }, async (request) => {
    const user = request.user as JwtPayload
    const docs = await fastify.prisma.contentPage.findMany({
      where: { slug: { in: [...DOCUMENTOS] } },
      select: { slug: true, title: true, body: true, updatedAt: true },
    })
    const aceites = await fastify.prisma.termsAcceptance.findMany({ where: { userId: user.id } })
    const pendentes = docs
      .map(d => ({ ...d, version: d.updatedAt.toISOString() }))
      .filter(d => !aceites.some(a => a.document === d.slug && a.version === d.version))
    return { pendentes }
  })

  fastify.post('/termos/aceitar', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { documentos } = request.body as { documentos: Array<{ slug: string; version: string }> }
    if (!Array.isArray(documentos) || !documentos.length) return reply.status(400).send({ error: 'Nada para aceitar' })
    for (const d of documentos) {
      if (!DOCUMENTOS.includes(d.slug as any)) continue
      await fastify.prisma.termsAcceptance.upsert({
        where: { userId_document_version: { userId: user.id, document: d.slug, version: d.version } },
        update: {},
        create: { userId: user.id, document: d.slug, version: d.version, ip: ipDe(request), userAgent: String(request.headers['user-agent'] || '') },
      })
    }
    await fastify.audit.log(request, { action: 'lgpd.aceite_termos', resource: 'User', resourceId: user.id, metadata: { documentos } })
    return { ok: true }
  })

  // ---------------------------------------------------------------- registro de acessos (admin)
  fastify.get('/acessos', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { pacienteId, usuario, de, ate, acao, page = '1' } = request.query as any
    const where: any = { action: { startsWith: 'lgpd.' } }
    if (acao) where.action = acao
    if (pacienteId) where.resourceId = pacienteId
    if (usuario) where.actorEmail = { contains: String(usuario), mode: 'insensitive' }
    if (de || ate) where.createdAt = { ...(de ? { gte: new Date(de) } : {}), ...(ate ? { lte: new Date(`${ate}T23:59:59`) } : {}) }
    const take = 50
    const [itens, total] = await Promise.all([
      fastify.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip: (Number(page) - 1) * take }),
      fastify.prisma.auditLog.count({ where }),
    ])
    // nomes dos pacientes para exibir
    const ids = [...new Set(itens.filter(i => i.resource === 'Patient' && i.resourceId).map(i => i.resourceId!))]
    const pacientes = ids.length ? await fastify.prisma.patient.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : []
    const nome = new Map(pacientes.map(p => [p.id, p.name]))
    return { itens: itens.map(i => ({ ...i, pacienteNome: i.resourceId ? nome.get(i.resourceId) || null : null })), total }
  })

  // ---------------------------------------------------------------- direitos do titular (admin)
  /** Exporta todos os dados de um paciente (direito de acesso/portabilidade — LGPD art. 18). */
  fastify.get('/pacientes/:id/exportar', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const p = await fastify.prisma.patient.findUnique({
      where: { id },
      include: {
        dentist: { select: { name: true, cro: true, email: true } },
        cases: { include: { workflowEvents: { orderBy: { createdAt: 'asc' } }, financial: true, payment: true } },
        photos: true, digitalModels: true, workFiles: true,
        planningForms: true, completionForms: true, otherServicesForms: true, clinicalRecords: true,
      },
    })
    if (!p) return reply.status(404).send({ error: 'Paciente não encontrado' })
    await fastify.audit.log(request, { action: 'lgpd.exportacao', resource: 'Patient', resourceId: id })
    reply.header('Content-Disposition', `attachment; filename="dados-paciente-${id}.json"`)
    return {
      geradoEm: new Date().toISOString(),
      observacao: 'Exportação de dados pessoais do paciente (LGPD art. 18). Os links de arquivos exigem acesso ao sistema.',
      paciente: p,
    }
  })

  /**
   * Anonimiza um paciente (LGPD art. 18, IV/VI). Mantém o histórico clínico e financeiro sem identificação.
   * Atenção: o prontuário odontológico tem guarda obrigatória — use apenas quando permitido.
   */
  fastify.post('/pacientes/:id/anonimizar', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { motivo, confirmacao } = request.body as { motivo?: string; confirmacao?: string }
    if (!motivo || motivo.trim().length < 10) return reply.status(400).send({ error: 'Descreva o motivo (mín. 10 caracteres)' })
    if (confirmacao !== 'ANONIMIZAR') return reply.status(400).send({ error: 'Digite ANONIMIZAR para confirmar' })
    const p = await fastify.prisma.patient.findUnique({ where: { id }, select: { id: true, legacyId: true } })
    if (!p) return reply.status(404).send({ error: 'Paciente não encontrado' })
    const rotulo = `Paciente anonimizado ${id.slice(0, 8)}`
    await fastify.prisma.$transaction([
      fastify.prisma.patient.update({ where: { id }, data: { name: rotulo, dob: null, gender: null, importantNotes: null, teethData: undefined, active: false } }),
      fastify.prisma.case.updateMany({ where: { patientId: id }, data: { patientName: rotulo, patientDob: null, gender: null } }),
      fastify.prisma.photo.deleteMany({ where: { patientId: id } }),
    ])
    await fastify.audit.log(request, { action: 'lgpd.anonimizacao', resource: 'Patient', resourceId: id, metadata: { motivo, legacyId: p.legacyId } })
    return { ok: true, nome: rotulo }
  })
}
