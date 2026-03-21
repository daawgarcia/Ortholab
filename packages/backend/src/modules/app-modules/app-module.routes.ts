import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../plugins/auth'
import { Role } from '@prisma/client'

export async function appModuleRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: authenticate }, async (request) => {
    const modules = await fastify.prisma.appModule.findMany({
      where: { status: 'ACTIVE', roles: { has: request.user.role } },
      orderBy: { order: 'asc' },
    })
    return { modules }
  })

  fastify.get('/all', { preHandler: requireRole(Role.ADMIN) }, async () => {
    const modules = await fastify.prisma.appModule.findMany({ orderBy: { order: 'asc' } })
    return { modules }
  })

  fastify.post('/', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const data = request.body as any
    const module = await fastify.prisma.appModule.create({ data })
    return reply.status(201).send({ module })
  })

  fastify.patch('/:id', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { id } = request.params as { id: string }
    const module = await fastify.prisma.appModule.update({ where: { id }, data: request.body as any })
    return { module }
  })

  fastify.delete('/:id', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { id } = request.params as { id: string }
    await fastify.prisma.appModule.update({ where: { id }, data: { status: 'INACTIVE' } })
    return { success: true }
  })
}
