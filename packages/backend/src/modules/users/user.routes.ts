import { FastifyInstance } from 'fastify'
import { authenticate, requireRole, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/profile', { preHandler: authenticate }, async (request) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: (request.user as JwtPayload).id },
      select: { id: true, name: true, email: true, role: true, status: true, cro: true, clinic: true, cnpj: true, phone: true, address: true, city: true, state: true, zipCode: true, deliveryAddress: true, totvsCode: true, createdAt: true },
    })
    return { user }
  })

  fastify.patch('/profile', { preHandler: authenticate }, async (request) => {
    const { password, role, status, ...data } = request.body as any
    const user = await fastify.prisma.user.update({
      where: { id: (request.user as JwtPayload).id },
      data,
      select: { id: true, name: true, email: true, role: true, clinic: true, cro: true, phone: true },
    })
    return { user }
  })
}
