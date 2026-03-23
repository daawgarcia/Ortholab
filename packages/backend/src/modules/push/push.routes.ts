import { FastifyInstance } from 'fastify'
import { authenticate, requireRole, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'

async function getPendingPushes(fastify: FastifyInstance, user: JwtPayload) {
  return fastify.prisma.pushNotification.findMany({
    where: {
      AND: [
        { OR: [
          { targetType: 'ALL' },
          { targetType: 'ROLE', targetId: user.role },
          { targetType: 'USER', targetId: user.id },
          { targetType: 'SELLER_PORTFOLIO', createdBy: { sellerClients: { some: { clientId: user.id } } } },
        ]},
        { reads: { none: { userId: user.id } } },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      ]
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function pushRoutes(fastify: FastifyInstance) {
  fastify.get('/pending', { preHandler: authenticate }, async (request) => {
    const user = request.user as JwtPayload
    const pushes = await getPendingPushes(fastify, user)
    return { pendingPushes: pushes }
  })

  fastify.post('/', { preHandler: requireRole(Role.ADMIN, Role.SELLER) }, async (request, reply) => {
    const { title, body, link, level, targetType, targetId, expiresAt } = request.body as any

    if ((request.user as JwtPayload).role === Role.SELLER && targetType !== 'SELLER_PORTFOLIO' && targetType !== 'USER') {
      return reply.status(403).send({ error: 'Vendedor só pode enviar push para sua carteira' })
    }

    const push = await fastify.prisma.pushNotification.create({
      data: { createdById: (request.user as JwtPayload).id, title, body, link, level: level || 'INFO', targetType, targetId, expiresAt: expiresAt ? new Date(expiresAt) : undefined },
    })
    return reply.status(201).send({ push })
  })

  fastify.get('/', { preHandler: requireRole(Role.ADMIN, Role.SELLER) }, async (request) => {
    const where = (request.user as JwtPayload).role === Role.SELLER ? { createdById: (request.user as JwtPayload).id } : {}
    const pushes = await fastify.prisma.pushNotification.findMany({
      where,
      include: { _count: { select: { reads: true } }, createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return { pushes }
  })

  fastify.post('/:id/read', { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string }
    await fastify.prisma.pushRead.upsert({
      where: { pushId_userId: { pushId: id, userId: (request.user as JwtPayload).id } },
      update: {},
      create: { pushId: id, userId: (request.user as JwtPayload).id },
    })
    return { success: true }
  })
}
