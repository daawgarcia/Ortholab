import { FastifyInstance } from 'fastify'
import { authenticate } from '../../plugins/auth'

export async function dentistFinancialRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/invoices', async (request, reply) => {
    const user = (request as any).user
    const dentistId = user.role === 'DENTIST' ? user.id : (request.query as any).dentistId

    if (!dentistId) return reply.status(400).send({ error: 'dentistId required' })

    const invoices = await fastify.prisma.dentistInvoice.findMany({
      where: { dentistId },
      orderBy: { dueDate: 'asc' },
    })
    return { invoices }
  })

  fastify.post('/invoices/sync', async (request, reply) => {
    const user = (request as any).user
    if (user.role !== 'ADMIN' && user.role !== 'FINANCIAL') {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    await fastify.prisma.totvsLog.create({
      data: { direction: 'OUTBOUND', endpoint: '/invoices/sync', payload: { triggeredBy: user.id }, status: 'PENDING' },
    })

    return { ok: true, message: 'Sincronização TOTVS enfileirada. Os títulos serão atualizados em breve.' }
  })

  fastify.post('/invoices/pay', async (request, reply) => {
    const user = (request as any).user
    if (user.role !== 'DENTIST') return reply.status(403).send({ error: 'Apenas dentistas podem realizar pagamentos' })

    const { invoiceIds, method, cardData } = request.body as {
      invoiceIds: string[]
      method: 'PIX' | 'CREDIT_CARD'
      installments?: number
      cardData?: { number: string; holder: string; expiry: string; cvv: string }
    }

    const parsedInstallments = Number((request.body as any).installments ?? 1)
    const installments = Number.isInteger(parsedInstallments) ? parsedInstallments : 1

    if (method === 'CREDIT_CARD' && (installments < 1 || installments > 12)) {
      return reply.status(400).send({ error: 'Parcelamento inválido. Use de 1x a 12x.' })
    }

    if (!invoiceIds?.length) return reply.status(400).send({ error: 'Selecione ao menos um título' })

    const invoices = await fastify.prisma.dentistInvoice.findMany({
      where: { id: { in: invoiceIds }, dentistId: user.id, status: 'OPEN' },
    })

    if (invoices.length !== invoiceIds.length) {
      return reply.status(400).send({ error: 'Um ou mais títulos inválidos ou já pagos' })
    }

    const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0)

    let pixCode: string | undefined
    let pixExpiry: Date | undefined
    let cardLast4: string | undefined

    if (method === 'PIX') {
      pixCode = `00020126330014BR.GOV.BCB.PIX0111${Date.now()}5204000053039865802BR5925ESTHETIC ALIGNER LTDA6009SAO PAULO62070503***6304${Math.random().toString(36).substring(2, 6).toUpperCase()}`
      pixExpiry = new Date(Date.now() + 30 * 60 * 1000)
    } else if (method === 'CREDIT_CARD' && cardData) {
      cardLast4 = cardData.number.replace(/\s/g, '').slice(-4)
    }

    const payment = await fastify.prisma.invoicePayment.create({
      data: {
        dentistId: user.id,
        invoiceIds,
        totalAmount,
        method,
        status: method === 'PIX' ? 'PENDING' : 'PROCESSING',
        pixCode,
        pixExpiry,
        cardLast4,
      },
    })

    // Cobrar via Rede se for cartão de crédito
    if (method === 'CREDIT_CARD' && cardData && fastify.rede.isConfigured) {
      const [expMonth, expYear] = cardData.expiry.replace(/\s/g, '').split('/')
      const fullYear = expYear.length === 2 ? `20${expYear}` : expYear

      try {
        const redeResult = await fastify.rede.createTransaction({
          amount: totalAmount,
          installments,
          cardNumber: cardData.number,
          cardHolder: cardData.holder,
          expirationMonth: expMonth,
          expirationYear: fullYear,
          securityCode: cardData.cvv,
          reference: payment.id,
          capture: true,
        })

        await fastify.prisma.invoicePayment.update({
          where: { id: payment.id },
          data: { status: 'PAID', paidAt: new Date(), transactionId: redeResult.tid },
        })
        await fastify.prisma.dentistInvoice.updateMany({
          where: { id: { in: invoiceIds } },
          data: { status: 'PAID', paidAt: new Date() },
        })
      } catch (err: any) {
        await fastify.prisma.invoicePayment.update({
          where: { id: payment.id },
          data: { status: 'FAILED' },
        })
        return reply.status(402).send({ error: err.message })
      }
    } else if (method === 'CREDIT_CARD') {
      // Fallback se Rede não configurada
      await fastify.prisma.invoicePayment.update({
        where: { id: payment.id },
        data: { status: 'PAID', paidAt: new Date(), transactionId: `LOCAL-${Date.now()}` },
      })
      await fastify.prisma.dentistInvoice.updateMany({
        where: { id: { in: invoiceIds } },
        data: { status: 'PAID', paidAt: new Date() },
      })
    }

    return { payment: { ...payment, pixCode, pixExpiry } }
  })

  fastify.get('/invoices/payment/:id/status', async (request, reply) => {
    const user = (request as any).user
    const { id } = request.params as { id: string }

    const payment = await fastify.prisma.invoicePayment.findUnique({ where: { id } })
    if (!payment || payment.dentistId !== user.id) return reply.status(404).send({ error: 'Pagamento não encontrado' })

    if (payment.status === 'PENDING' && payment.pixExpiry && payment.pixExpiry > new Date()) {
      const elapsed = Date.now() - new Date(payment.createdAt).getTime()
      if (elapsed > 5000 && Math.random() > 0.7) {
        await fastify.prisma.invoicePayment.update({
          where: { id }, data: { status: 'PAID', paidAt: new Date(), transactionId: `PIX-${Date.now()}` },
        })
        await fastify.prisma.dentistInvoice.updateMany({
          where: { id: { in: payment.invoiceIds } },
          data: { status: 'PAID', paidAt: new Date() },
        })
        return { status: 'PAID' }
      }
    }

    return { status: payment.status, pixCode: payment.pixCode, pixExpiry: payment.pixExpiry }
  })

  fastify.post('/invoices', async (request, reply) => {
    const user = (request as any).user
    if (user.role !== 'ADMIN' && user.role !== 'FINANCIAL') return reply.status(403).send({ error: 'Forbidden' })

    const body = request.body as any
    const invoice = await fastify.prisma.dentistInvoice.create({ data: body })
    return reply.status(201).send({ invoice })
  })
}
