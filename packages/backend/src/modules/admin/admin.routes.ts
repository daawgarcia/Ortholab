import { FastifyInstance } from 'fastify'
import { requireRole } from '../../plugins/auth'
import { Role, UserStatus } from '@prisma/client'

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.get('/users', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { role, status, search, page = '1', limit = '20' } = request.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = {}
    if (role) where.role = role
    if (status) where.status = status
    if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }]

    const [users, total] = await Promise.all([
      fastify.prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, role: true, status: true, cro: true, clinic: true, phone: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      fastify.prisma.user.count({ where }),
    ])
    return { users, total }
  })

  fastify.patch('/users/:id/status', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: UserStatus }
    const user = await fastify.prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, name: true, email: true, status: true },
    })
    return { user }
  })

  fastify.patch('/users/:id/role', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { id } = request.params as { id: string }
    const { role } = request.body as { role: Role }
    const user = await fastify.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    })
    return { user }
  })

  fastify.get('/stats', { preHandler: requireRole(Role.ADMIN) }, async () => {
    const [totalCases, totalUsers, pendingUsers, casesByStatus] = await Promise.all([
      fastify.prisma.case.count(),
      fastify.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      fastify.prisma.user.count({ where: { status: UserStatus.PENDING } }),
      fastify.prisma.case.groupBy({ by: ['status'], _count: { _all: true } }),
    ])
    return { totalCases, totalUsers, pendingUsers, casesByStatus }
  })
}
