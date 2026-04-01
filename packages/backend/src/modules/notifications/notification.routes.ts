import { FastifyInstance } from 'fastify'
import { authenticate, JwtPayload } from '../../plugins/auth'

export async function notificationRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: authenticate }, async (request) => {
    const userId = (request.user as JwtPayload).id
    const notifications = await fastify.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const unreadCount = await fastify.prisma.notification.count({
      where: { userId, read: false },
    })
    return { notifications, unreadCount }
  })

  fastify.patch('/:id/read', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const userId = (request.user as JwtPayload).id
    const updated = await fastify.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    })

    if (updated.count === 0) {
      return reply.status(404).send({ error: 'Notificação não encontrada' })
    }

    return { success: true }
  })

  fastify.patch('/read-all', { preHandler: authenticate }, async (request) => {
    const userId = (request.user as JwtPayload).id
    await fastify.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    })
    return { success: true }
  })

  fastify.delete('/clear', { preHandler: authenticate }, async (request) => {
    const userId = (request.user as JwtPayload).id
    await fastify.prisma.notification.deleteMany({ where: { userId } })
    return { success: true }
  })
}
