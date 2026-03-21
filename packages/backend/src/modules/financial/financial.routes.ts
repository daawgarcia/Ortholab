import { FastifyInstance } from 'fastify'
import { requireRole, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'

export async function financialRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireRole(Role.FINANCIAL, Role.ADMIN) }, async (request) => {
    const { billed, page = '1', limit = '20', search } = request.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = { status: { in: ['APPROVED', 'IN_PRODUCTION', 'SHIPPED', 'COMPLETED'] } }
    if (billed === 'true') where.financial = { invoiceNumber: { not: null } }
    if (billed === 'false') where.financial = { is: null }
    if (search) where.patientName = { contains: search, mode: 'insensitive' }

    const [cases, total] = await Promise.all([
      fastify.prisma.case.findMany({
        where,
        include: {
          dentist: { select: { name: true, clinic: true, cnpj: true, email: true } },
          service: true,
          payment: true,
          financial: { include: { billedBy: { select: { name: true } } } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      fastify.prisma.case.count({ where }),
    ])
    return { cases, total }
  })

  fastify.post('/:caseId/bill', { preHandler: requireRole(Role.FINANCIAL, Role.ADMIN) }, async (request, reply) => {
    const { caseId } = request.params as { caseId: string }
    const { invoiceNumber, amount, notes } = request.body as any

    const financial = await fastify.prisma.financial.upsert({
      where: { caseId },
      update: { invoiceNumber, amount, billedAt: new Date(), billedById: (request.user as JwtPayload).id, notes },
      create: { caseId, invoiceNumber, amount, billedAt: new Date(), billedById: (request.user as JwtPayload).id, notes },
    })
    return { financial }
  })
}
