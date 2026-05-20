import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, JwtPayload } from '../../plugins/auth'

// Whitelist explícita: apenas campos não-sensíveis que o usuário pode ajustar de si mesmo.
// E-mail, role, status, cnpj, totvs*, firstCaseCouponEligible NUNCA via /profile.
const profileUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(40).optional(),
  clinic: z.string().max(160).optional(),
  cro: z.string().max(40).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(80).optional(),
  zipCode: z.string().max(20).optional(),
  country: z.string().max(80).optional(),
  deliveryStreet: z.string().max(200).optional(),
  deliveryNumber: z.string().max(40).optional(),
  deliveryComplement: z.string().max(200).optional(),
  deliveryNeighborhood: z.string().max(120).optional(),
  deliveryCity: z.string().max(120).optional(),
  deliveryState: z.string().max(80).optional(),
  deliveryZip: z.string().max(20).optional(),
  deliveryPhone: z.string().max(40).optional(),
  deliveryMobile: z.string().max(40).optional(),
})

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/profile', { preHandler: authenticate }, async (request) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: (request.user as JwtPayload).id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        cro: true,
        clinic: true,
        cnpj: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        deliveryStreet: true,
        deliveryNumber: true,
        deliveryComplement: true,
        deliveryNeighborhood: true,
        deliveryCity: true,
        deliveryState: true,
        deliveryZip: true,
        deliveryPhone: true,
        deliveryMobile: true,
        totvsCode: true,
        createdAt: true,
        mustChangePassword: true,
      },
    })
    return { user }
  })

  fastify.patch('/profile', { preHandler: authenticate }, async (request, reply) => {
    const parsed = profileUpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() })
    }
    const me = request.user as JwtPayload

    const user = await fastify.prisma.user.update({
      where: { id: me.id },
      data: parsed.data,
      select: { id: true, name: true, email: true, role: true, clinic: true, cro: true, phone: true },
    })

    await fastify.audit.log(request, {
      action: 'user.profile_update',
      resource: 'User',
      resourceId: me.id,
      metadata: { fields: Object.keys(parsed.data) },
    })

    return { user }
  })

  // LGPD Art. 18 — direito do titular a confirmar e exportar seus dados (self-service)
  fastify.get('/me/data-export', { preHandler: authenticate }, async (request) => {
    const me = request.user as JwtPayload
    const [user, patients, cases, payments, invoices] = await Promise.all([
      fastify.prisma.user.findUnique({
        where: { id: me.id },
        select: {
          id: true, name: true, email: true, role: true, status: true, cro: true, clinic: true,
          cnpj: true, phone: true, address: true, city: true, state: true, zipCode: true, country: true,
          createdAt: true, updatedAt: true,
        },
      }),
      fastify.prisma.patient.findMany({ where: { dentistId: me.id }, select: { id: true, name: true, gender: true, dob: true, createdAt: true } }),
      fastify.prisma.case.findMany({ where: { dentistId: me.id }, select: { id: true, caseNumber: true, status: true, productType: true, createdAt: true } }),
      fastify.prisma.payment.findMany({ where: { dentistId: me.id }, select: { id: true, amount: true, status: true, paidAt: true, createdAt: true } }),
      fastify.prisma.dentistInvoice.findMany({ where: { dentistId: me.id }, select: { id: true, invoiceNumber: true, amount: true, status: true, dueDate: true, paidAt: true, createdAt: true } }),
    ])

    await fastify.audit.log(request, { action: 'user.data_export', resource: 'User', resourceId: me.id })

    return { exportedAt: new Date().toISOString(), user, patients, cases, payments, invoices }
  })
}
