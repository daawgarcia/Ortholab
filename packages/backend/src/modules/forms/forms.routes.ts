import { FastifyInstance } from 'fastify'
import { authenticate, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'
import { EventMailer } from '../mailer/event-mailer'

export async function formsRoutes(fastify: FastifyInstance) {
  const mailer = new EventMailer(fastify)

  async function notifyInternalUsers(patientId: string, dentistId: string, title: string, message: string) {
    const [admins, labs, sellers] = await Promise.all([
      fastify.prisma.user.findMany({ where: { role: Role.ADMIN, status: 'ACTIVE' as any }, select: { id: true } }),
      fastify.prisma.user.findMany({ where: { role: Role.LAB_TECH, status: 'ACTIVE' as any }, select: { id: true } }),
      fastify.prisma.sellerClient.findMany({ where: { clientId: dentistId }, select: { sellerId: true } }),
    ])

    const recipientIds = [...new Set([...admins.map((item) => item.id), ...labs.map((item) => item.id), ...sellers.map((item) => item.sellerId)])]
    if (recipientIds.length === 0) return

    await fastify.prisma.notification.createMany({
      data: recipientIds.map((userId) => ({
        userId,
        title,
        message,
        link: `/patients/${patientId}`,
      })),
    })
  }

  fastify.get('/planning/:patientId', { preHandler: authenticate }, async (request) => {
    const { patientId } = request.params as { patientId: string }
    const user = request.user as JwtPayload
    const where: any = { patientId }
    if (user.role === Role.DENTIST) where.dentistId = user.id
    return fastify.prisma.planningForm.findMany({ where, orderBy: { createdAt: 'desc' }, include: { dentist: { select: { name: true } } } })
  })

  fastify.post('/planning/:patientId', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { patientId } = request.params as { patientId: string }
    const { formData } = request.body as any
    const form = await fastify.prisma.planningForm.create({
      data: { patientId, dentistId: user.id, formData },
    })

    const patient = await fastify.prisma.patient.findUnique({ where: { id: patientId } })
    if (patient) {
      mailer.onPatientFormSubmitted(patient, 'Ficha de Planejamento').catch(console.error)
      await notifyInternalUsers(patient.id, patient.dentistId, 'Ficha de planejamento enviada', `${patient.name} recebeu uma nova ficha de planejamento.`)
    }

    return reply.status(201).send(form)
  })

  fastify.get('/completion/:patientId', { preHandler: authenticate }, async (request) => {
    const { patientId } = request.params as { patientId: string }
    const user = request.user as JwtPayload
    const where: any = { patientId }
    if (user.role === Role.DENTIST) where.dentistId = user.id
    return fastify.prisma.completionForm.findMany({ where, orderBy: { createdAt: 'desc' }, include: { dentist: { select: { name: true } } } })
  })

  fastify.post('/completion/:patientId', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { patientId } = request.params as { patientId: string }
    const { formData, contentionUpper, contentionLower, observations } = request.body as any
    const form = await fastify.prisma.completionForm.create({
      data: { patientId, dentistId: user.id, formData, contentionUpper, contentionLower, observations },
    })

    const patient = await fastify.prisma.patient.findUnique({ where: { id: patientId } })
    if (patient) {
      mailer.onPatientFormSubmitted(patient, 'Ficha de Finalização').catch(console.error)
      await notifyInternalUsers(patient.id, patient.dentistId, 'Ficha de finalização enviada', `${patient.name} recebeu uma nova ficha de finalização.`)
    }

    return reply.status(201).send(form)
  })

  fastify.get('/other-services/:patientId', { preHandler: authenticate }, async (request) => {
    const { patientId } = request.params as { patientId: string }
    const user = request.user as JwtPayload
    const where: any = { patientId }
    if (user.role === Role.DENTIST) where.dentistId = user.id
    return fastify.prisma.otherServicesForm.findMany({ where, orderBy: { createdAt: 'desc' }, include: { dentist: { select: { name: true } } } })
  })

  fastify.post('/other-services/:patientId', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { patientId } = request.params as { patientId: string }
    const { eaSplint, eaAir, observations } = request.body as any
    const form = await fastify.prisma.otherServicesForm.create({
      data: { patientId, dentistId: user.id, eaGuard: false, eaSplint: !!eaSplint, eaMio: null, eaAir: !!eaAir, observations },
    })

    const patient = await fastify.prisma.patient.findUnique({ where: { id: patientId } })
    if (patient) {
      mailer.onPatientFormSubmitted(patient, 'Ficha de Outros Serviços').catch(console.error)
      await notifyInternalUsers(patient.id, patient.dentistId, 'Ficha de outros serviços enviada', `${patient.name} recebeu uma nova ficha de outros serviços.`)
    }

    return reply.status(201).send(form)
  })
}
