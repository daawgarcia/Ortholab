import { FastifyInstance } from 'fastify'
import { authenticate } from '../../plugins/auth'

export async function notificationRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: authenticate }, async (request) => {
    const notifications = await fastify.prisma.notification.findMany({
      where: { userId: request.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const unreadCount = await fastify.prisma.notification.count({
      where: { userId: request.user.id, read: false },
    })
    return { notifications, unreadCount }
  })

  fastify.patch('/:id/read', { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string }
    await fastify.prisma.notification.update({ where: { id }, data: { read: true } })
    return { success: true }
  })

  fastify.patch('/read-all', { preHandler: authenticate }, async (request) => {
    await fastify.prisma.notification.updateMany({
      where: { userId: request.user.id, read: false },
      data: { read: true },
    })
    return { success: true }
  })
}
