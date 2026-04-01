import { FastifyInstance } from 'fastify'
import { requireRole, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'
import { getCasePricingSnapshot, getProgressiveAlignerDiscountRate } from '../services/pricing.utils'

export async function financialRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireRole(Role.FINANCIAL, Role.ADMIN) }, async (request) => {
    const { billed, page = '1', limit = '20', search } = request.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = {
      status: {
        notIn: ['DRAFT', 'SUBMITTED'],
      },
    }

    if (billed === 'true') {
      where.financial = { invoiceNumber: { not: null } }
    }

    if (billed === 'false') {
      where.OR = [
        { financial: { is: null } },
        { financial: { invoiceNumber: null } },
      ]
    }

    if (search) where.patientName = { contains: search, mode: 'insensitive' }

    const [cases, total] = await Promise.all([
      fastify.prisma.case.findMany({
        where,
        include: {
          dentist: { select: { name: true, clinic: true, cnpj: true, email: true } },
          service: { include: { prices: { orderBy: { validFrom: 'desc' } } } },
          payment: true,
          financial: { include: { billedBy: { select: { name: true } } } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      fastify.prisma.case.count({ where }),
    ])

    const couponCodes = [...new Set(cases.map((caseItem) => caseItem.discountCoupon).filter(Boolean))] as string[]
    const coupons = couponCodes.length > 0
      ? await fastify.prisma.coupon.findMany({ where: { code: { in: couponCodes } } })
      : []
    const couponMap = new Map(coupons.map((coupon) => [coupon.code, coupon]))

    const dentistIds = [...new Set(cases.map((caseItem) => caseItem.dentistId))]
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const nextMonthStart = new Date(monthStart)
    nextMonthStart.setMonth(nextMonthStart.getMonth() + 1)

    const billedCasesThisMonth = dentistIds.length > 0
      ? await fastify.prisma.case.findMany({
          where: {
            dentistId: { in: dentistIds },
            service: { is: { type: { in: ['MID', 'FULL'] } } },
            financial: { is: { billedAt: { gte: monthStart, lt: nextMonthStart } } },
          },
          select: { dentistId: true },
        })
      : []
    const billedCountByDentist = billedCasesThisMonth.reduce((acc, item) => {
      acc.set(item.dentistId, (acc.get(item.dentistId) || 0) + 1)
      return acc
    }, new Map<string, number>())

    const enrichedCases = cases.map((caseItem) => {
      const hasResolvedAmount = caseItem.financial?.amount !== null && caseItem.financial?.amount !== undefined
        || caseItem.payment?.amount !== null && caseItem.payment?.amount !== undefined

      if (hasResolvedAmount || !caseItem.service?.prices?.length) {
        return {
          ...caseItem,
          suggestedAmount: null,
          amountSource: caseItem.financial?.amount !== null && caseItem.financial?.amount !== undefined ? 'FINANCIAL' : 'PAYMENT',
          pricingContext: null,
        }
      }

      try {
        const coupon = caseItem.discountCoupon ? couponMap.get(caseItem.discountCoupon) : null
        const progressiveDiscountPercent = getProgressiveAlignerDiscountRate(caseItem.service?.type, billedCountByDentist.get(caseItem.dentistId) || 0)
        const pricing = getCasePricingSnapshot(caseItem.service, caseItem.installmentOption, coupon && coupon.active ? coupon : null, progressiveDiscountPercent)
        return {
          ...caseItem,
          suggestedAmount: pricing.finalAmount,
          progressiveDiscountPercent,
          amountSource: 'SUGGESTED',
          pricingContext: {
            baseAmount: pricing.baseAmount,
            finalAmount: pricing.finalAmount,
            couponCode: coupon?.active ? coupon.code : null,
            couponType: coupon?.active ? coupon.type : null,
            couponValue: coupon?.active ? coupon.value : null,
            progressiveDiscountPercent,
          },
        }
      } catch {
        return { ...caseItem, suggestedAmount: null, progressiveDiscountPercent: 0, amountSource: null, pricingContext: null }
      }
    })

    return { cases: enrichedCases, total }
  })

  fastify.post('/:caseId/bill', { preHandler: requireRole(Role.FINANCIAL, Role.ADMIN) }, async (request, reply) => {
    const { caseId } = request.params as { caseId: string }
    const { invoiceNumber, amount, notes, dueDate } = request.body as any

    const caseData = await fastify.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        service: { include: { prices: { orderBy: { validFrom: 'desc' } } } },
        dentist: { select: { id: true, name: true } },
      },
    })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })

    let resolvedAmount = amount !== undefined ? Number(amount) : undefined

    if (resolvedAmount === undefined && caseData.service?.prices?.length) {
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)
      const nextMonthStart = new Date(monthStart)
      nextMonthStart.setMonth(nextMonthStart.getMonth() + 1)

      const billedCountThisMonth = await fastify.prisma.case.count({
        where: {
          dentistId: caseData.dentistId,
          id: { not: caseId },
          service: { is: { type: { in: ['MID', 'FULL'] } } },
          financial: { is: { billedAt: { gte: monthStart, lt: nextMonthStart } } },
        },
      })

      const progressiveDiscountPercent = getProgressiveAlignerDiscountRate(caseData.service.type, billedCountThisMonth)
      const coupon = caseData.discountCoupon
        ? await fastify.prisma.coupon.findUnique({ where: { code: caseData.discountCoupon } })
        : null
      const pricing = getCasePricingSnapshot(caseData.service, caseData.installmentOption, coupon && coupon.active ? coupon : null, progressiveDiscountPercent)
      resolvedAmount = pricing.finalAmount
    }

    const numericAmount = resolvedAmount !== undefined ? Number(resolvedAmount) : null
    if (numericAmount === null || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return reply.status(400).send({ error: 'Informe um valor válido para liberar cobrança ao cliente' })
    }

    const financial = await fastify.prisma.financial.upsert({
      where: { caseId },
      update: { invoiceNumber, amount: numericAmount, billedAt: new Date(), billedById: (request.user as JwtPayload).id, notes },
      create: { caseId, invoiceNumber, amount: numericAmount, billedAt: new Date(), billedById: (request.user as JwtPayload).id, notes },
    })

    // Criar título no painel financeiro do dentista
    const existingInvoice = await fastify.prisma.dentistInvoice.findFirst({
      where: { caseId, dentistId: caseData.dentistId },
    })

    const invoiceAmount = numericAmount
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
