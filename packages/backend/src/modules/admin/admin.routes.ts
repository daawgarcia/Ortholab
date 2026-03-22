import { FastifyInstance } from 'fastify'
import { requireRole, JwtPayload } from '../../plugins/auth'
import { Role, UserStatus } from '@prisma/client'

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.post('/users', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const bcrypt = require('bcryptjs')
    const { name, email, password, role, cro, clinic, cnpj, phone, address, city, state, zipCode } = request.body as any

    const existing = await fastify.prisma.user.findUnique({ where: { email } })
    if (existing) return reply.status(400).send({ error: 'E-mail já cadastrado' })

    const hash = await bcrypt.hash(password, 12)
    const user = await fastify.prisma.user.create({
      data: { name, email, password: hash, role: role || 'DENTIST', status: 'ACTIVE', emailVerified: true, cro, clinic, cnpj, phone, address, city, state, zipCode },
      select: { id: true, name: true, email: true, role: true, status: true },
    })
    return reply.status(201).send({ user })
  })

  fastify.get('/users', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { role, status, search, page = '1', limit = '20' } = request.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = {}
    
    // Support multiple roles separated by comma
    if (role) {
      const roles = role.split(',').map((r: string) => r.trim())
      if (roles.length > 1) {
        where.role = { in: roles }
      } else {
        where.role = roles[0]
      }
    }
    
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

  fastify.post('/impersonate/:userId', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const user = await fastify.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, status: true },
    })
    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado' })
    if (user.status !== UserStatus.ACTIVE) return reply.status(400).send({ error: 'Usuário inativo' })

    const payload = { id: user.id, email: user.email, role: user.role, name: user.name }
    const accessToken = fastify.jwt.sign(payload, { expiresIn: '2h' })
    return { accessToken, user: payload, impersonated: true }
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

  fastify.get('/dentists', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { search } = request.query as any
    const where: any = { role: Role.DENTIST, status: UserStatus.ACTIVE }
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { clinic: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
    const dentists = await fastify.prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, clinic: true, cro: true },
      orderBy: { name: 'asc' },
      take: 20,
    })
    return { dentists }
  })

  fastify.get('/coupons', { preHandler: requireRole(Role.ADMIN) }, async () => {
    const coupons = await fastify.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } })
    return { coupons }
  })

  fastify.post('/coupons', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { code, description, type, value, active } = request.body as any
    if (!code || !type || value === undefined) return reply.status(400).send({ error: 'code, type e value são obrigatórios' })

    const existing = await fastify.prisma.coupon.findUnique({ where: { code } })
    if (existing) return reply.status(400).send({ error: 'Cupom já existe' })

    const coupon = await fastify.prisma.coupon.create({ data: { code, description, type, value: Number(value), active: active ?? true } })
    return reply.status(201).send({ coupon })
  })

  fastify.patch('/coupons/:id', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { id } = request.params as { id: string }
    const { code, description, type, value, active } = request.body as any
    const coupon = await fastify.prisma.coupon.update({
      where: { id },
      data: { code, description, type, value: value !== undefined ? Number(value) : undefined, active },
    })
    return { coupon }
  })

  fastify.delete('/coupons/:id', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { id } = request.params as { id: string }
    await fastify.prisma.coupon.delete({ where: { id } })
    return { ok: true }
  })
}
