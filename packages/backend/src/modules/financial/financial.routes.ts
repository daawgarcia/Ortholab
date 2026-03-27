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
    const { invoiceNumber, amount, notes, dueDate } = request.body as any

    // Buscar dados do caso para criar o título do dentista
    const caseData = await fastify.prisma.case.findUnique({
      where: { id: caseId },
      include: { service: true, dentist: { select: { id: true, name: true } } },
    })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })

    const financial = await fastify.prisma.financial.upsert({
      where: { caseId },
      update: { invoiceNumber, amount, billedAt: new Date(), billedById: (request.user as JwtPayload).id, notes },
      create: { caseId, invoiceNumber, amount, billedAt: new Date(), billedById: (request.user as JwtPayload).id, notes },
    })

    // Criar título no painel financeiro do dentista
    const existingInvoice = await fastify.prisma.dentistInvoice.findFirst({
      where: { caseId, dentistId: caseData.dentistId },
    })

    const invoiceAmount = amount || 0
    const invoiceDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const serviceName = caseData.service?.name || caseData.productType || 'Serviço'
    const description = `Caso #${caseData.caseNumber} - ${caseData.patientName} - ${serviceName}`

    if (existingInvoice) {
      await fastify.prisma.dentistInvoice.update({
        where: { id: existingInvoice.id },
        data: { invoiceNumber: invoiceNumber || existingInvoice.invoiceNumber, amount: invoiceAmount, description },
      })
    } else {
      await fastify.prisma.dentistInvoice.create({
        data: {
          dentistId: caseData.dentistId,
          caseId,
          invoiceNumber: invoiceNumber || `NF-${caseData.caseNumber}`,
          description,
          amount: invoiceAmount,
          dueDate: invoiceDueDate,
        },
      })
    }

    return { financial }
  })
}
