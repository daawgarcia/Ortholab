import { FastifyInstance } from 'fastify'
import { authenticate, JwtPayload, requireRole } from '../../plugins/auth'
import { Role, UserStatus } from '@prisma/client'
import { buscarDentistas, ordenarPor } from '../busca/busca'
import { paisesDoUsuario, whereDentistaPais, dentistaNoEscopo } from '../acesso/escopo'

export async function dentistRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    // Dentista não pesquisa outros dentistas
    if (user.role === Role.DENTIST) return reply.status(403).send({ error: 'Acesso negado' })
    const { search, page = '1', limit = '30' } = request.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = { role: Role.DENTIST }
    const paises = await paisesDoUsuario(fastify.prisma, user)
    if (paises) Object.assign(where, whereDentistaPais(paises))
    const termo = String(search || '').trim()
    if (termo.length >= 2 && termo !== '**') {
      const r = await buscarDentistas(fastify.prisma, termo, { limit: parseInt(limit), offset: skip })
      where.id = { in: r.ids }
      const lista = await fastify.prisma.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, cro: true, clinic: true,
          cnpj: true, phone: true, status: true, totvsCode: true,
          firstCaseCouponEligible: true,
          deliveryCity: true, deliveryState: true, country: true,
          _count: { select: { cases: true, patients: true } },
        },
      })
      return { dentists: ordenarPor(r.ids, lista), total: r.total }
    }

    const [dentists, total] = await Promise.all([
      fastify.prisma.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, cro: true, clinic: true,
          cnpj: true, phone: true, status: true, totvsCode: true,
          firstCaseCouponEligible: true,
          deliveryCity: true, deliveryState: true, country: true,
          _count: { select: { cases: true, patients: true } },
        },
        orderBy: [{ patients: { _count: 'desc' } }, { name: 'asc' }], // quem tem mais pacientes primeiro
        skip,
        take: parseInt(limit),
      }),
      fastify.prisma.user.count({ where }),
    ])
    return { dentists, total }
  })

  fastify.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const eu = request.user as JwtPayload
    if (eu.role === Role.DENTIST ? eu.id !== id : !(await dentistaNoEscopo(fastify.prisma, eu, id))) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }
    const dentist = await fastify.prisma.user.findUnique({
      where: { id, role: Role.DENTIST },
      select: {
        id: true, name: true, email: true, cro: true, clinic: true,
        cnpj: true, phone: true, address: true, city: true, state: true, zipCode: true, country: true,
        deliveryStreet: true, deliveryNumber: true, deliveryComplement: true,
        deliveryNeighborhood: true, deliveryCity: true, deliveryState: true,
        deliveryZip: true, deliveryPhone: true, deliveryMobile: true,
        totvsCode: true, totvsChave: true, totvsLoja: true, status: true,
        firstCaseCouponEligible: true,
        createdAt: true,
        patients: {
          select: { id: true, name: true, active: true, _count: { select: { cases: true } } },
          orderBy: { name: 'asc' },
          take: 20,
        },
        cases: {
          where: { discountCoupon: { not: null } },
          select: {
            id: true,
            caseNumber: true,
            discountCoupon: true,
            status: true,
            createdAt: true,
            service: { select: { name: true, type: true } },
            financial: { select: { billedAt: true, amount: true, invoiceNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { cases: true, patients: true } },
      },
    })
    if (!dentist) return reply.status(404).send({ error: 'Dentista não encontrado' })
    return dentist
  })

  fastify.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const eu = request.user as JwtPayload
    if (eu.role === Role.DENTIST ? eu.id !== id : !(await dentistaNoEscopo(fastify.prisma, eu, id))) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }
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

  fastify.get('/:id/patients', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const eu = request.user as JwtPayload
    if (eu.role === Role.DENTIST ? eu.id !== id : !(await dentistaNoEscopo(fastify.prisma, eu, id))) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }
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
