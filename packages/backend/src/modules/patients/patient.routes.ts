import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'

const patientSchema = z.object({
  name: z.string().min(2),
  gender: z.string().optional(),
  dob: z.string().optional(),
  dentistId: z.string().optional(),
  active: z.boolean().optional(),
  teethData: z.any().optional(),
})

export async function patientRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: authenticate }, async (request) => {
    const user = request.user as JwtPayload
    const { search, dentistId, page = '1', limit = '50' } = request.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: any = {}
    if (user.role === Role.DENTIST) {
      where.dentistId = user.id
    } else if (dentistId) {
      where.dentistId = dentistId
    }
    if (search) where.name = { contains: search, mode: 'insensitive' }

    const [patients, total] = await Promise.all([
      fastify.prisma.patient.findMany({
        where,
        include: {
          dentist: { select: { name: true, clinic: true } },
          _count: { select: { cases: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: parseInt(limit),
      }),
      fastify.prisma.patient.count({ where }),
    ])

    return { patients, total }
  })

  fastify.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }

    const patient = await fastify.prisma.patient.findUnique({
      where: { id },
      include: {
        dentist: { select: { name: true, clinic: true, email: true } },
        cases: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, caseNumber: true, status: true, productType: true,
            createdAt: true, service: { select: { name: true } },
          },
        },
      },
    })

    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' })
    if (user.role === Role.DENTIST && patient.dentistId !== user.id)
      return reply.status(403).send({ error: 'Acesso negado' })

    return patient
  })

  fastify.post('/', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const data = patientSchema.parse(request.body)

    const dentistId = user.role === Role.DENTIST ? user.id : (data.dentistId || user.id)

    const patient = await fastify.prisma.patient.create({
      data: {
        name: data.name,
        gender: data.gender,
        dob: data.dob ? new Date(data.dob) : undefined,
        dentistId,
        active: data.active ?? true,
        teethData: data.teethData,
      },
    })

    return reply.status(201).send(patient)
  })

  fastify.put('/:id', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }
    const data = patientSchema.partial().parse(request.body)

    const existing = await fastify.prisma.patient.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Paciente não encontrado' })
    if (user.role === Role.DENTIST && existing.dentistId !== user.id)
      return reply.status(403).send({ error: 'Acesso negado' })

    const patient = await fastify.prisma.patient.update({
      where: { id },
      data: {
        name: data.name,
        gender: data.gender,
        dob: data.dob ? new Date(data.dob) : undefined,
        active: data.active,
        teethData: data.teethData,
      },
    })

    return patient
  })
}
