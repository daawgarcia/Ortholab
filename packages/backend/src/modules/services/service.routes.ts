import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../plugins/auth'
import { Role } from '@prisma/client'

export async function serviceRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: authenticate }, async () => {
    const services = await fastify.prisma.service.findMany({
      where: { active: true },
      include: { prices: { orderBy: { validFrom: 'desc' }, take: 1 } },
      orderBy: { name: 'asc' },
    })
    return { services }
  })

  fastify.post('/', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { name, description, type, productionDays, maxRevisions, price } = request.body as any
    const service = await fastify.prisma.service.create({ data: { name, description, type, productionDays, maxRevisions } })
    if (price) await fastify.prisma.price.create({ data: { serviceId: service.id, price } })
    return reply.status(201).send({ service })
  })

  fastify.patch('/:id', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { id } = request.params as { id: string }
    const { price, ...data } = request.body as any
    const service = await fastify.prisma.service.update({ where: { id }, data })
    if (price !== undefined) await fastify.prisma.price.create({ data: { serviceId: id, price } })
    return { service }
  })

  fastify.delete('/:id', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { id } = request.params as { id: string }
    await fastify.prisma.service.update({ where: { id }, data: { active: false } })
    return { success: true }
  })
}
