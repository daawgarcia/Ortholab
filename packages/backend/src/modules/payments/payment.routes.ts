import { FastifyInstance } from 'fastify'
import { createHmac, timingSafeEqual } from 'crypto'
import { authenticate, requireRole, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'
import { EventMailer } from '../mailer/event-mailer'
import { getCasePricingSnapshot } from '../services/pricing.utils'

function parseInstallments(option: string): number {
  const match = option.match(/^(\d+)x$/)
  return match ? parseInt(match[1], 10) : 1
}

function verifyWebhookSignature(secret: string, rawBody: string, signature: string): boolean {
  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
    const a = Buffer.from(expected)
    const b = Buffer.from(signature)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function paymentRoutes(fastify: FastifyInstance) {
  const mailer = new EventMailer(fastify)

  // Cria pagamento e cobra via Rede
  // AVISO: dados de cartão ainda trafegam pelo backend. Para conformidade PCI-DSS
  // completa, use tokenização direto no frontend via SDK da Rede (e-Rede.js).
  fastify.post('/create', { preHandler: authenticate }, async (request, reply) => {
    const { caseId, provider, cardData } = request.body as {
      caseId: string
      provider: 'REDE' | 'SAUDE_SERVICE'
      cardData?: { number: string; holder: string; expiry: string; cvv: string }
    }

    const user = request.user as JwtPayload

    const caseData = await fastify.prisma.case.findUnique({
      where: { id: caseId },
      include: { dentist: true, service: { include: { prices: { orderBy: { validFrom: 'desc' } } } } },
    })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })

    // Dentistas só podem pagar seus próprios casos
    if (user.role === Role.DENTIST && caseData.dentistId !== user.id) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    if (!caseData.service) return reply.status(400).send({ error: 'Caso sem serviço vinculado' })

    let pricing = getCasePricingSnapshot(caseData.service, caseData.installmentOption)
    let couponMeta: { code: string; discount: number } | undefined

    if (caseData.discountCoupon) {
      const coupon = await fastify.prisma.coupon.findUnique({ where: { code: caseData.discountCoupon.toUpperCase() } })
      if (!coupon || !coupon.active) {
        return reply.status(400).send({ error: 'Cupom de desconto inválido ou inativo' })
      }
      pricing = getCasePricingSnapshot(caseData.service, caseData.installmentOption, coupon)
      couponMeta = { code: coupon.code, discount: pricing.discountAmount }
    }

    const installments = parseInstallments(pricing.installmentOption)

    const payment = await fastify.prisma.payment.upsert({
      where: { caseId },
      update: {
        provider,
        amount: pricing.finalAmount,
        status: 'PENDING',
        metadata: { installmentOption: pricing.installmentOption, baseAmount: pricing.baseAmount, finalAmount: pricing.finalAmount, coupon: couponMeta },
      },
      create: {
        caseId,
        dentistId: user.id,
        provider,
        amount: pricing.finalAmount,
        status: 'PENDING',
        metadata: { installmentOption: pricing.installmentOption, baseAmount: pricing.baseAmount, finalAmount: pricing.finalAmount, coupon: couponMeta },
      },
    })

    if (provider === 'REDE' && cardData && fastify.rede.isConfigured) {
      const [expMonth, expYear] = cardData.expiry.replace(/\s/g, '').split('/')
      const fullYear = expYear.length === 2 ? `20${expYear}` : expYear

      try {
        const redeResult = await fastify.rede.createTransaction({
          amount: pricing.finalAmount,
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

  // Webhook de pagamento — valida assinatura HMAC-SHA256
  fastify.post('/webhook/:provider', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET
    if (webhookSecret) {
      const signature = (request.headers['x-webhook-signature'] || request.headers['x-rede-signature'] || '') as string
      const rawBody = (request as any).rawBody as string | undefined

      if (!signature || !rawBody || !verifyWebhookSignature(webhookSecret, rawBody, signature)) {
        return reply.status(401).send({ error: 'Invalid webhook signature' })
      }
    }

    const body = request.body as any
    const transactionId = body.transactionId || body.tid || body.id
    if (!transactionId || typeof transactionId !== 'string') {
      return reply.status(400).send({ error: 'transactionId ausente' })
    }

    const status = body.status === 'approved' || body.status === 'PAID' || body.returnCode === '00' ? 'PAID' : 'FAILED'

    const payment = await fastify.prisma.payment.findFirst({ where: { transactionId } })
    if (!payment) return reply.status(404).send({ error: 'Payment not found' })

    // Idempotência: ignorar se já está no estado final
    if (payment.status === status) return { received: true }

    await fastify.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status,
        paidAt: status === 'PAID' ? new Date() : undefined,
        metadata: { ...((payment.metadata as object) || {}), webhookEvent: { returnCode: body.returnCode, status: body.status } },
      },
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
