import { FastifyInstance } from 'fastify'
import { requireRole, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'

export async function sellerRoutes(fastify: FastifyInstance) {
  fastify.get('/portfolio', { preHandler: requireRole(Role.SELLER) }, async (request) => {
    const clients = await fastify.prisma.sellerClient.findMany({
      where: { sellerId: (request.user as JwtPayload).id },
      include: {
        client: {
          select: { id: true, name: true, clinic: true, email: true, phone: true, status: true, createdAt: true,
            cases: { select: { id: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
            _count: { select: { cases: true } },
          },
        },
      },
    })
    return { clients: clients.map(c => c.client) }
  })

  fastify.get('/portfolio/cases', { preHandler: requireRole(Role.SELLER) }, async (request) => {
    const { status, page = '1', limit = '20' } = request.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const portfolio = await fastify.prisma.sellerClient.findMany({
      where: { sellerId: (request.user as JwtPayload).id },
      select: { clientId: true },
    })
    const clientIds = portfolio.map(p => p.clientId)

    const where: any = { dentistId: { in: clientIds } }
    if (status) where.status = status

    const [cases, total] = await Promise.all([
      fastify.prisma.case.findMany({
        where,
        include: { dentist: { select: { name: true, clinic: true } }, service: true, payment: { select: { status: true } } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      fastify.prisma.case.count({ where }),
    ])
    return { cases, total }
  })

  fastify.post('/portfolio/:clientId/add', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { clientId } = request.params as { clientId: string }
    const { sellerId } = request.body as { sellerId: string }
    await fastify.prisma.sellerClient.upsert({
      where: { sellerId_clientId: { sellerId, clientId } },
      update: {},
      create: { sellerId, clientId },
    })
    return reply.status(201).send({ message: 'Cliente adicionado à carteira' })
  })
}
