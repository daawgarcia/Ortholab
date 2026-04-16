import { FastifyInstance } from 'fastify'
import { authenticate } from '../../plugins/auth'

export async function dentistFinancialRoutes(fastify: FastifyInstance) {
  // Public — Webhook PIX da Rede (sem JWT, validado pelo header Authorization que a Rede envia)
  // Registrar URL via POST /api/dentist-financial/webhooks/pix/register (uma vez por ambiente)
  fastify.post('/webhooks/pix', async (request, reply) => {
    const authHeader = request.headers['authorization'] as string | undefined
    const expected = process.env.REDE_WEBHOOK_AUTH
    if (expected && authHeader !== expected) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const body = request.body as any

    // Payload Rede: { id, merchantId, events: ["PV.UPDATE_TRANSACTION_PIX"], data: { txid, id, endToEndId } }
    const events: string[] = Array.isArray(body?.events) ? body.events : []
    const isApproved = events.includes('PV.UPDATE_TRANSACTION_PIX')
    const isCanceled = events.includes('PV.REFUND_PIX')

    if (!isApproved && !isCanceled) return { received: true }

    const tid = body?.data?.id as string | undefined
    const endToEndId = body?.data?.endToEndId as string | undefined

    if (!tid) return { received: true }

    const payment = await fastify.prisma.invoicePayment.findFirst({
      where: { method: 'PIX', status: 'PENDING', transactionId: tid },
    })

    if (!payment) return { received: true }

    if (isApproved) {
      await fastify.prisma.invoicePayment.update({
        where: { id: payment.id },
        data: { status: 'PAID', paidAt: new Date(), transactionId: endToEndId || tid },
      })
      await fastify.prisma.dentistInvoice.updateMany({
        where: { id: { in: payment.invoiceIds } },
        data: { status: 'PAID', paidAt: new Date() },
      })
      fastify.log.info({ event: 'pix_webhook_paid', paymentId: payment.id, tid }, 'PIX confirmed via Rede webhook')
    } else if (isCanceled) {
      await fastify.prisma.invoicePayment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      })
      fastify.log.info({ event: 'pix_webhook_canceled', paymentId: payment.id, tid }, 'PIX canceled via Rede webhook')
    }

    return { received: true }
  })

  // Authenticated routes
  await fastify.register(async (authed) => {
    authed.addHook('preHandler', authenticate)

    authed.get('/invoices', async (request, reply) => {
      const user = (request as any).user
      const dentistId = user.role === 'DENTIST' ? user.id : (request.query as any).dentistId

      if (!dentistId) return reply.status(400).send({ error: 'dentistId required' })

      const invoices = await authed.prisma.dentistInvoice.findMany({
        where: { dentistId },
        orderBy: { dueDate: 'asc' },
      })
      return { invoices }
    })

    authed.post('/invoices/sync', async (request, reply) => {
      const user = (request as any).user
      if (user.role !== 'ADMIN' && user.role !== 'FINANCIAL') {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      await authed.prisma.totvsLog.create({
        data: { direction: 'OUTBOUND', endpoint: '/invoices/sync', payload: { triggeredBy: user.id }, status: 'PENDING' },
      })

      return { ok: true, message: 'Sincronização TOTVS enfileirada. Os títulos serão atualizados em breve.' }
    })

    authed.post('/invoices/pay', async (request, reply) => {
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

      const invoices = await authed.prisma.dentistInvoice.findMany({
        where: { id: { in: invoiceIds }, dentistId: user.id, status: 'OPEN' },
      })

      if (invoices.length !== invoiceIds.length) {
        return reply.status(400).send({ error: 'Um ou mais títulos inválidos ou já pagos' })
      }

      const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0)

      let pixCode: string | undefined
      let pixExpiry: Date | undefined
      let pixQrImage: string | undefined
      let cardLast4: string | undefined

      if (method === 'CREDIT_CARD' && cardData) {
        cardLast4 = cardData.number.replace(/\s/g, '').slice(-4)
      }

      const payment = await authed.prisma.invoicePayment.create({
        data: {
          dentistId: user.id,
          invoiceIds,
          totalAmount,
          method,
          status: method === 'PIX' ? 'PENDING' : 'PROCESSING',
          cardLast4,
        },
      })

      if (method === 'PIX') {
        if (!authed.rede.isConfigured) {
          await authed.prisma.invoicePayment.update({ where: { id: payment.id }, data: { status: 'FAILED' } })
          return reply.status(503).send({ error: 'Pagamento via PIX não configurado. Entre em contato com o suporte.' })
        }

        try {
          const pixResult = await authed.rede.createPixTransaction({
            amount: totalAmount,
            reference: payment.id,
            expiresInMinutes: 30,
          })

          pixCode = pixResult.qrCodeResponse?.qrCodeData
          pixQrImage = pixResult.qrCodeResponse?.qrCodeImage
          const expiryStr = pixResult.qrCodeResponse?.DatetimeExpiration
          pixExpiry = expiryStr ? new Date(expiryStr) : new Date(Date.now() + 30 * 60 * 1000)

          await authed.prisma.invoicePayment.update({
            where: { id: payment.id },
            data: { pixCode, pixExpiry, transactionId: pixResult.tid },
          })
        } catch (err: any) {
          await authed.prisma.invoicePayment.update({ where: { id: payment.id }, data: { status: 'FAILED' } })
          return reply.status(502).send({ error: err.message })
        }

        return { payment: { ...payment, status: 'PENDING', pixCode, pixQrImage, pixExpiry } }
      }

      if (method === 'CREDIT_CARD' && cardData && authed.rede.isConfigured) {
        const [expMonth, expYear] = cardData.expiry.replace(/\s/g, '').split('/')
        const fullYear = expYear.length === 2 ? `20${expYear}` : expYear

        try {
          const redeResult = await authed.rede.createTransaction({
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

          await authed.prisma.invoicePayment.update({
            where: { id: payment.id },
            data: { status: 'PAID', paidAt: new Date(), transactionId: redeResult.tid },
          })
          await authed.prisma.dentistInvoice.updateMany({
            where: { id: { in: invoiceIds } },
            data: { status: 'PAID', paidAt: new Date() },
          })

          return { payment: { ...payment, status: 'PAID', transactionId: redeResult.tid } }
        } catch (err: any) {
          await authed.prisma.invoicePayment.update({
            where: { id: payment.id },
            data: { status: 'FAILED' },
          })
          return reply.status(402).send({ error: err.message })
        }
      }

      return { payment }
    })

    authed.get('/invoices/payment/:id/status', async (request, reply) => {
      const user = (request as any).user
      const { id } = request.params as { id: string }

      const payment = await authed.prisma.invoicePayment.findUnique({ where: { id } })
      if (!payment || payment.dentistId !== user.id) return reply.status(404).send({ error: 'Pagamento não encontrado' })

      if (payment.status === 'PENDING' && payment.pixExpiry && payment.pixExpiry < new Date()) {
        await authed.prisma.invoicePayment.update({ where: { id }, data: { status: 'FAILED' } })
        return { status: 'FAILED', reason: 'PIX expirado' }
      }

      return { status: payment.status, pixCode: payment.pixCode, pixExpiry: payment.pixExpiry, transactionId: payment.transactionId }
    })

    authed.post('/invoices/payment/:id/confirm-pix', async (request, reply) => {
      const user = (request as any).user
      if (user.role !== 'ADMIN' && user.role !== 'FINANCIAL') {
        return reply.status(403).send({ error: 'Apenas Admin ou Financeiro podem confirmar PIX' })
      }

      const { id } = request.params as { id: string }
      const { transactionId } = (request.body as any) ?? {}

      const payment = await authed.prisma.invoicePayment.findUnique({ where: { id } })
      if (!payment) return reply.status(404).send({ error: 'Pagamento não encontrado' })
      if (payment.method !== 'PIX') return reply.status(400).send({ error: 'Este pagamento não é PIX' })
      if (payment.status === 'PAID') return reply.status(400).send({ error: 'Pagamento já confirmado' })

      await authed.prisma.invoicePayment.update({
        where: { id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          transactionId: transactionId || `PIX-MANUAL-${Date.now()}`,
        },
      })

      await authed.prisma.dentistInvoice.updateMany({
        where: { id: { in: payment.invoiceIds } },
        data: { status: 'PAID', paidAt: new Date() },
      })

      authed.log.info({ event: 'pix_manual_confirm', paymentId: id, confirmedBy: user.id }, 'PIX confirmed manually')

      return { ok: true, message: 'PIX confirmado com sucesso' }
    })

    // Registra URL de webhook PIX na Rede — chamar uma vez por ambiente após o deploy
    authed.post('/webhooks/pix/register', async (request, reply) => {
      const user = (request as any).user
      if (user.role !== 'ADMIN') return reply.status(403).send({ error: 'Apenas Admin pode registrar webhooks' })

      const appUrl = process.env.APP_URL
      if (!appUrl) return reply.status(500).send({ error: 'APP_URL não configurada' })

      const webhookUrl = `${appUrl}/api/dentist-financial/webhooks/pix`

      try {
        await authed.rede.registerPixWebhookUrl(webhookUrl)
        return { ok: true, webhookUrl }
      } catch (err: any) {
        return reply.status(500).send({ error: err.message })
      }
    })

    authed.post('/invoices', async (request, reply) => {
      const user = (request as any).user
      if (user.role !== 'ADMIN' && user.role !== 'FINANCIAL') return reply.status(403).send({ error: 'Forbidden' })

      const body = request.body as any
      const invoice = await authed.prisma.dentistInvoice.create({ data: body })
      return reply.status(201).send({ invoice })
    })
  })
}
