import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, JwtPayload } from '../../plugins/auth'
import { Role, CaseStatus } from '@prisma/client'
import { EventMailer } from '../mailer/event-mailer'

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
          include: {
            service: { select: { name: true } },
            workflowEvents: { orderBy: { stage: 'desc' }, take: 1 },
          },
        },
      },
    })

    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' })
    if (user.role === Role.DENTIST && patient.dentistId !== user.id)
      return reply.status(403).send({ error: 'Acesso negado' })

    return patient
  })

  fastify.post('/:id/open-workflow', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }

    const patient = await fastify.prisma.patient.findUnique({ where: { id } })
    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' })
    if (user.role === Role.DENTIST && patient.dentistId !== user.id)
      return reply.status(403).send({ error: 'Acesso negado' })

    const existingOpen = await fastify.prisma.case.findFirst({
      where: { patientId: id, status: { not: 'COMPLETED' } },
    })
    if (existingOpen) return reply.status(400).send({ error: 'Já existe um caso em aberto para este paciente' })

    const newCase = await fastify.prisma.case.create({
      data: {
        dentistId: patient.dentistId,
        patientId: id,
        patientName: patient.name,
        patientDob: patient.dob ?? undefined,
        gender: patient.gender ?? undefined,
        status: CaseStatus.IN_PLANNING,
      },
    })

    const caseWithTotvs = await fastify.prisma.case.update({
      where: { id: newCase.id },
      data: { totvsOrderId: `CAIXA-${newCase.caseNumber}` },
    })

    await fastify.prisma.workflowEvent.create({
      data: {
        caseId: caseWithTotvs.id,
        stage: 1,
        stageName: 'Recebimento dos modelos',
        performedBy: user.id,
        notes: 'Recebimento inicial registrado via painel do paciente',
      },
    })

    return reply.status(201).send({ case: caseWithTotvs })
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
      include: { dentist: { select: { name: true, clinic: true } } },
    })

    // Send notification email
    const mailer = new EventMailer(fastify)
    mailer.onPatientCreated(patient).catch(console.error)

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

  fastify.get('/:id/photos', { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string }
    const { isPrivate } = request.query as any
    const photos = await fastify.prisma.photo.findMany({
      where: { patientId: id, isPrivate: isPrivate === 'true' },
      orderBy: { createdAt: 'desc' },
    })
    return { photos }
  })

  fastify.post('/:id/photos', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parts = request.parts()
    const saved: any[] = []
    let isPrivate = false

    for await (const part of parts) {
      if (part.type === 'field' && part.fieldname === 'isPrivate') {
        isPrivate = part.value === 'true'
      } else if (part.type === 'file') {
        const chunks: Buffer[] = []
        for await (const chunk of part.file) chunks.push(chunk)
        const buffer = Buffer.concat(chunks)

        try {
          const { url } = await fastify.s3.upload(buffer, part.filename, part.mimetype, `patients/${id}/photos`)
          const photo = await fastify.prisma.photo.create({
            data: { patientId: id, url, filename: part.filename, size: buffer.length, isPrivate },
          })
          saved.push(photo)
        } catch {
          saved.push({ filename: part.filename, error: 'Upload failed - S3 not configured' })
        }
      }
    }

    return reply.status(201).send({ photos: saved })
  })

  fastify.delete('/:id/photos/:photoId', { preHandler: authenticate }, async (request) => {
    const { photoId } = request.params as { id: string; photoId: string }
    await fastify.prisma.photo.delete({ where: { id: photoId } })
    return { ok: true }
  })

  fastify.get('/:id/digital-models', { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string }
    const files = await fastify.prisma.digitalModel.findMany({
      where: { patientId: id },
      orderBy: { createdAt: 'desc' },
    })
    return { files }
  })

  fastify.post('/:id/digital-models', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parts = request.parts()
    let kind = 'upper'

    for await (const part of parts) {
      if (part.type === 'field' && part.fieldname === 'kind') {
        kind = String(part.value)
      } else if (part.type === 'file') {
        const chunks: Buffer[] = []
        for await (const chunk of part.file) chunks.push(chunk)
        const buffer = Buffer.concat(chunks)

        try {
          const { url } = await fastify.s3.upload(buffer, part.filename, part.mimetype, `patients/${id}/stl`)
          const file = await fastify.prisma.digitalModel.create({
            data: { patientId: id, url, filename: part.filename, size: buffer.length, kind },
          })
          return reply.status(201).send(file)
        } catch {
          return reply.status(201).send({ filename: part.filename, kind, error: 'S3 not configured' })
        }
      }
    }
    return reply.status(400).send({ error: 'No file provided' })
  })

  fastify.get('/:id/work-files', { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string }
    const files = await fastify.prisma.workFile.findMany({
      where: { patientId: id },
      orderBy: { createdAt: 'desc' },
    })
    return { files }
  })

  fastify.post('/:id/work-files', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parts = request.parts()

    for await (const part of parts) {
      if (part.type === 'file') {
        const chunks: Buffer[] = []
        for await (const chunk of part.file) chunks.push(chunk)
        const buffer = Buffer.concat(chunks)

        try {
          const { url } = await fastify.s3.upload(buffer, part.filename, part.mimetype, `patients/${id}/works`)
          const file = await fastify.prisma.workFile.create({
            data: { patientId: id, url, filename: part.filename, size: buffer.length },
          })
          return reply.status(201).send(file)
        } catch {
          return reply.status(201).send({ filename: part.filename, error: 'S3 not configured' })
        }
      }
    }
    return reply.status(400).send({ error: 'No file provided' })
  })
}
