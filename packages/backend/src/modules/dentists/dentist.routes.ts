import { FastifyInstance } from 'fastify'
import { authenticate, JwtPayload, requireRole } from '../../plugins/auth'
import { Role, UserStatus } from '@prisma/client'

export async function dentistRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: authenticate }, async (request) => {
    const { search, page = '1', limit = '30' } = request.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = { role: Role.DENTIST }
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { clinic: { contains: search, mode: 'insensitive' } },
      { cro: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]

    const [dentists, total] = await Promise.all([
      fastify.prisma.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, cro: true, clinic: true,
          cnpj: true, phone: true, status: true, totvsCode: true,
          deliveryCity: true, deliveryState: true, country: true,
          _count: { select: { cases: true, patients: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: parseInt(limit),
      }),
      fastify.prisma.user.count({ where }),
    ])
    return { dentists, total }
  })

  fastify.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const dentist = await fastify.prisma.user.findUnique({
      where: { id, role: Role.DENTIST },
      select: {
        id: true, name: true, email: true, cro: true, clinic: true,
        cnpj: true, phone: true, address: true, city: true, state: true, zipCode: true, country: true,
        deliveryStreet: true, deliveryNumber: true, deliveryComplement: true,
        deliveryNeighborhood: true, deliveryCity: true, deliveryState: true,
        deliveryZip: true, deliveryPhone: true, deliveryMobile: true,
        totvsCode: true, totvsChave: true, totvsLoja: true, status: true,
        createdAt: true,
        patients: {
          select: { id: true, name: true, active: true, _count: { select: { cases: true } } },
          orderBy: { name: 'asc' },
          take: 20,
        },
        _count: { select: { cases: true, patients: true } },
      },
    })
    if (!dentist) return reply.status(404).send({ error: 'Dentista não encontrado' })
    return dentist
  })

  fastify.patch('/:id', { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string }
    const {
      deliveryStreet, deliveryNumber, deliveryComplement, deliveryNeighborhood,
      deliveryCity, deliveryState, deliveryZip, deliveryPhone, deliveryMobile,
      phone, clinic,
    } = request.body as any

    return fastify.prisma.user.update({
      where: { id },
      data: {
        deliveryStreet, deliveryNumber, deliveryComplement, deliveryNeighborhood,
        deliveryCity, deliveryState, deliveryZip, deliveryPhone, deliveryMobile,
        phone, clinic,
      },
      select: { id: true, name: true, deliveryCity: true, deliveryState: true },
    })
  })

  fastify.get('/:id/patients', { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string }
    const { search } = request.query as any
    const where: any = { dentistId: id }
    if (search) where.name = { contains: search, mode: 'insensitive' }

    return fastify.prisma.patient.findMany({
      where,
      include: { _count: { select: { cases: true } } },
      orderBy: { name: 'asc' },
      take: 50,
    })
  })
}
