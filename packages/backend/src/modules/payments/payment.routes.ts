import { FastifyInstance } from 'fastify'
import { authenticate, requireRole, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'
import { EventMailer } from '../mailer/event-mailer'
import { applyCouponDiscount, getChargeAmountForCase, normalizeInstallmentOption } from '../services/pricing.utils'

function parseInstallments(option: string): number {
  const match = option.match(/^(\d+)x$/)
  return match ? parseInt(match[1], 10) : 1
}

export async function paymentRoutes(fastify: FastifyInstance) {
  const mailer = new EventMailer(fastify)

  // Cria pagamento e cobra via Rede
  fastify.post('/create', { preHandler: authenticate }, async (request, reply) => {
    const { caseId, provider, cardData } = request.body as {
      caseId: string
      provider: 'REDE' | 'SAUDE_SERVICE'
      cardData?: { number: string; holder: string; expiry: string; cvv: string }
    }
    
    const caseData = await fastify.prisma.case.findUnique({
      where: { id: caseId },
      include: { dentist: true, service: { include: { prices: { orderBy: { validFrom: 'desc' } } } } },
    })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })
    if (!caseData.service) return reply.status(400).send({ error: 'Caso sem serviço vinculado' })

    const installmentOption = normalizeInstallmentOption(caseData.installmentOption)
    const baseAmount = getChargeAmountForCase(caseData.service, installmentOption)

    let finalAmount = baseAmount
    let couponMeta: { code: string; discount: number } | undefined

    if (caseData.discountCoupon) {
      const coupon = await fastify.prisma.coupon.findUnique({ where: { code: caseData.discountCoupon.toUpperCase() } })
      if (!coupon || !coupon.active) {
        return reply.status(400).send({ error: 'Cupom de desconto inválido ou inativo' })
      }
      finalAmount = applyCouponDiscount(baseAmount, coupon)
      couponMeta = { code: coupon.code, discount: Number((baseAmount - finalAmount).toFixed(2)) }
    }

    const installments = parseInstallments(installmentOption)

    // Criar registro de pagamento
    const payment = await fastify.prisma.payment.upsert({
      where: { caseId },
      update: {
        provider,
        amount: finalAmount,
        status: 'PENDING',
        metadata: { installmentOption, baseAmount, finalAmount, coupon: couponMeta },
      },
      create: {
        caseId,
        dentistId: (request.user as JwtPayload).id,
        provider,
        amount: finalAmount,
        status: 'PENDING',
        metadata: { installmentOption, baseAmount, finalAmount, coupon: couponMeta },
      },
    })

    // Se for Rede e tiver dados do cartão, cobrar agora
    if (provider === 'REDE' && cardData && fastify.rede.isConfigured) {
      const [expMonth, expYear] = cardData.expiry.replace(/\s/g, '').split('/')
      const fullYear = expYear.length === 2 ? `20${expYear}` : expYear

      try {
        const redeResult = await fastify.rede.createTransaction({
          amount: finalAmount,
          installments,
          cardNumber: cardData.number,
          cardHolder: cardData.holder,
          expirationMonth: expMonth,
          expirationYear: fullYear,
          securityCode: cardData.cvv,
          reference: payment.id,
          capture: true,
        })

        await fastify.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
            transactionId: redeResult.tid,
            paidAt: new Date(),
            metadata: {
              ...((payment.metadata as object) || {}),
              rede: { tid: redeResult.tid, nsu: redeResult.nsu, authCode: redeResult.authorizationCode },
            },
          },
        })

        const updatedCase = await fastify.prisma.case.findUnique({
          where: { id: caseId },
          include: { dentist: true },
        })
        if (updatedCase) await mailer.onPaymentConfirmed(updatedCase)

        return { payment: { ...payment, status: 'PAID', transactionId: redeResult.tid }, message: 'Pagamento aprovado pela Rede!' }
      } catch (err: any) {
        await fastify.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', metadata: { ...((payment.metadata as object) || {}), error: err.message } },
        })

        const failedCase = await fastify.prisma.case.findUnique({
          where: { id: caseId },
          include: { dentist: true },
        })
        if (failedCase) await mailer.onPaymentFailed(failedCase)

        return reply.status(402).send({ error: err.message, payment: { ...payment, status: 'FAILED' } })
      }
    }

    return { payment, message: provider === 'REDE' && !fastify.rede.isConfigured
      ? 'Gateway Rede não configurado. Pagamento registrado como pendente.'
      : 'Pagamento registrado.' }
  })

  // Consulta status de um pagamento
  fastify.get('/:paymentId/status', { preHandler: authenticate }, async (request, reply) => {
    const { paymentId } = request.params as { paymentId: string }
    const payment = await fastify.prisma.payment.findUnique({ where: { id: paymentId } })
    if (!payment) return reply.status(404).send({ error: 'Pagamento não encontrado' })

    // Se tem TID da Rede, consulta status em tempo real
    if (payment.transactionId && fastify.rede.isConfigured) {
      try {
        const redeStatus = await fastify.rede.getTransaction(payment.transactionId)
        return { payment, rede: redeStatus }
      } catch {
        // fallback para dados locais
      }
    }

    return { payment }
  })

  fastify.post('/webhook/:provider', async (request, reply) => {
    const { provider } = request.params as { provider: string }
    const body = request.body as any

    const transactionId = body.transactionId || body.tid || body.id
    const status = body.status === 'approved' || body.status === 'PAID' || body.returnCode === '00' ? 'PAID' : 'FAILED'

    const payment = await fastify.prisma.payment.findFirst({ where: { transactionId } })
    if (!payment) return reply.status(404).send({ error: 'Payment not found' })

    await fastify.prisma.payment.update({
      where: { id: payment.id },
      data: { status, paidAt: status === 'PAID' ? new Date() : undefined, metadata: body },
    })

    const caseData = await fastify.prisma.case.findUnique({
      where: { id: payment.caseId },
      include: { dentist: true },
    })
    if (caseData) {
      if (status === 'PAID') await mailer.onPaymentConfirmed(caseData)
      else await mailer.onPaymentFailed(caseData)
    }

    return { received: true }
  })
}
