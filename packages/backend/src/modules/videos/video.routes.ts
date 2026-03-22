import { FastifyInstance } from 'fastify'
import { requireRole } from '../../plugins/auth'
import { Role } from '@prisma/client'

export async function videoRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request) => {
    const { category } = request.query as { category?: string }
    const videos = await fastify.prisma.video.findMany({
      where: { active: true, ...(category ? { category: category as any } : {}) },
      orderBy: { order: 'asc' },
    })
    return { videos }
  })

  fastify.post('/', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const body = request.body as any
    const video = await fastify.prisma.video.create({ data: body })
    return reply.status(201).send({ video })
  })

  fastify.put('/:id', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as any
    const video = await fastify.prisma.video.update({ where: { id }, data: body })
    return { video }
  })

  fastify.delete('/:id', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await fastify.prisma.video.delete({ where: { id } })
    return { ok: true }
  })
}
