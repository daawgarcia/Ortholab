import { FastifyInstance } from 'fastify'
import { authenticate, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'

export async function formsRoutes(fastify: FastifyInstance) {
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
    const { eaGuard, eaSplint, eaMio, eaAir, observations } = request.body as any
    const form = await fastify.prisma.otherServicesForm.create({
      data: { patientId, dentistId: user.id, eaGuard: !!eaGuard, eaSplint: !!eaSplint, eaMio, eaAir: !!eaAir, observations },
    })
    return reply.status(201).send(form)
  })
}
