import { FastifyInstance } from 'fastify'
import { authenticate, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'

export async function clinicalRecordRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: authenticate }, async (request) => {
    const user = request.user as JwtPayload
    const { patientId, dentistId, dateStart, dateEnd, page = '1', limit = '30' } = request.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: any = {}
    if (user.role === Role.DENTIST) where.dentistId = user.id
    else if (dentistId) where.dentistId = dentistId

    if (patientId) where.patientId = patientId
    if (dateStart || dateEnd) {
      where.consultationAt = {}
      if (dateStart) where.consultationAt.gte = new Date(dateStart)
      if (dateEnd) where.consultationAt.lte = new Date(dateEnd)
    }

    const [records, total] = await Promise.all([
      fastify.prisma.clinicalRecord.findMany({
        where,
        include: {
          patient: { select: { name: true } },
          dentist: { select: { name: true, clinic: true } },
        },
        orderBy: { consultationAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      fastify.prisma.clinicalRecord.count({ where }),
    ])
    return { records, total }
  })

  fastify.post('/', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { patientId, dentistId, consultationAt, evaluation, activities, observations } = request.body as any

    const patient = await fastify.prisma.patient.findUnique({
      where: { id: patientId },
      select: { dentistId: true },
    })

    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' })

    const resolvedDentistId = user.role === Role.DENTIST ? user.id : (dentistId || patient.dentistId)

    const record = await fastify.prisma.clinicalRecord.create({
      data: {
        patientId,
        dentistId: resolvedDentistId,
        consultationAt: new Date(consultationAt),
        evaluation,
        activities: activities || [],
        observations,
      },
    })
    return reply.status(201).send(record)
  })

  fastify.put('/:id', { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string }
    const { consultationAt, evaluation, activities, observations } = request.body as any

    return fastify.prisma.clinicalRecord.update({
      where: { id },
      data: { consultationAt: new Date(consultationAt), evaluation, activities, observations },
    })
  })

  fastify.delete('/:id', { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string }
    await fastify.prisma.clinicalRecord.delete({ where: { id } })
    return { ok: true }
  })
}
