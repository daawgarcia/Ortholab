import { FastifyInstance } from 'fastify'
import { authenticate, requireRole, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'
import { EventMailer } from '../mailer/event-mailer'

export async function paymentRoutes(fastify: FastifyInstance) {
  const mailer = new EventMailer(fastify)

  const getCashPrice = (prices: Array<{ price: any; groupId: string | null }> = []) => {
    const cash = prices.find((entry) => !entry.groupId || entry.groupId === 'CASH')
    return Number(cash?.price || 0)
  }

  fastify.post('/create', { preHandler: authenticate }, async (request, reply) => {
    const { caseId, provider } = request.body as { caseId: string; provider: 'REDE' | 'SAUDE_SERVICE' }
    
    const caseData = await fastify.prisma.case.findUnique({
      where: { id: caseId },
      include: { dentist: true, service: { include: { prices: { orderBy: { validFrom: 'desc' } } } } },
    })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })

    const price = getCashPrice(caseData.service?.prices)
    const payment = await fastify.prisma.payment.upsert({
      where: { caseId },
      update: { provider, amount: price, status: 'PENDING' },
      create: { caseId, dentistId: (request.user as JwtPayload).id, provider, amount: price, status: 'PENDING' },
    })

    return { payment, message: 'Pagamento iniciado. Integração com gateway em configuração.' }
  })

  fastify.post('/webhook/:provider', async (request, reply) => {
    const { provider } = request.params as { provider: string }
    const body = request.body as any

    const transactionId = body.transactionId || body.id
    const status = body.status === 'approved' || body.status === 'PAID' ? 'PAID' : 'FAILED'

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
