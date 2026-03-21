import { FastifyInstance } from 'fastify'
import { requireRole } from '../../plugins/auth'
import { Role } from '@prisma/client'

export async function totvsRoutes(fastify: FastifyInstance) {
  fastify.post('/webhooks/clientes', async (request, reply) => {
    const secret = request.headers['x-totvs-secret']
    if (secret !== process.env.TOTVS_WEBHOOK_SECRET) return reply.status(401).send({ error: 'Unauthorized' })

    const body = request.body as any
    await fastify.prisma.totvsLog.create({
      data: { direction: 'INBOUND', endpoint: '/webhooks/clientes', payload: body, status: 'RECEIVED' },
    })

    return { received: true }
  })

  fastify.get('/cases/:id', { preHandler: requireRole(Role.ADMIN, Role.FINANCIAL) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const caseData = await fastify.prisma.case.findUnique({
      where: { id },
      include: { dentist: true, service: { include: { prices: { take: 1, orderBy: { validFrom: 'desc' } } } }, financial: true, payment: true },
    })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })
    return { case: caseData }
  })

  fastify.get('/logs', { preHandler: requireRole(Role.ADMIN) }, async () => {
    const logs = await fastify.prisma.totvsLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    return { logs }
  })
}
