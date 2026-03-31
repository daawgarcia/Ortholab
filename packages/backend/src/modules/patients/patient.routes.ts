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
  productType: z.string().optional(),
  planningFormData: z.any().optional(),
})

export async function patientRoutes(fastify: FastifyInstance) {
  const mailer = new EventMailer(fastify)

  async function canAccessPatient(user: JwtPayload, dentistId: string) {
    if (user.role === Role.ADMIN || user.role === Role.LAB_TECH || user.role === Role.FINANCIAL) {
      return true
    }

    if (user.role === Role.DENTIST) {
      return dentistId === user.id
    }

    if (user.role === Role.SELLER) {
      const relation = await fastify.prisma.sellerClient.findUnique({
        where: { sellerId_clientId: { sellerId: user.id, clientId: dentistId } },
      })
      return !!relation
    }

    return false
  }

  async function getAccessiblePatient(id: string, user: JwtPayload) {
    const patient = await fastify.prisma.patient.findUnique({ where: { id } })
    if (!patient) return null

    const allowed = await canAccessPatient(user, patient.dentistId)
    if (!allowed) return 'FORBIDDEN' as const

    return patient
  }

  async function getInternalNotificationUserIds(dentistId: string) {
    const [admins, labs, sellers] = await Promise.all([
      fastify.prisma.user.findMany({ where: { role: Role.ADMIN, status: 'ACTIVE' as any }, select: { id: true } }),
      fastify.prisma.user.findMany({ where: { role: Role.LAB_TECH, status: 'ACTIVE' as any }, select: { id: true } }),
      fastify.prisma.sellerClient.findMany({ where: { clientId: dentistId }, select: { sellerId: true } }),
    ])

    return [...new Set([...admins.map((item) => item.id), ...labs.map((item) => item.id), ...sellers.map((item) => item.sellerId)])]
  }

  fastify.get('/', { preHandler: authenticate }, async (request) => {
    const user = request.user as JwtPayload
    const { search, dentistId, page = '1', limit = '50' } = request.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: any = {}
    if (user.role === Role.DENTIST) {
      where.dentistId = user.id
    } else if (user.role === Role.SELLER) {
      const portfolio = await fastify.prisma.sellerClient.findMany({
        where: { sellerId: user.id },
        select: { clientId: true },
      })
      where.dentistId = { in: portfolio.map((item) => item.clientId) }
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

    const accessiblePatient = await getAccessiblePatient(id, user)
    if (!accessiblePatient) return reply.status(404).send({ error: 'Paciente não encontrado' })
    if (accessiblePatient === 'FORBIDDEN') return reply.status(403).send({ error: 'Acesso negado' })

    const patient = await fastify.prisma.patient.findUnique({
      where: { id },
      include: {
        dentist: { select: { name: true, clinic: true, email: true } },
        cases: {
          orderBy: { createdAt: 'desc' },
          include: {
            service: { select: { id: true, name: true, type: true } },
            workflowEvents: { orderBy: { stage: 'desc' }, take: 1 },
          },
        },
      },
    })

    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' })

    return patient
  })

  fastify.post('/:id/open-workflow', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }

    const patient = await getAccessiblePatient(id, user)
    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' })
    if (patient === 'FORBIDDEN') return reply.status(403).send({ error: 'Acesso negado' })

    const existingOpen = await fastify.prisma.case.findFirst({
      where: { patientId: id, status: { notIn: ['COMPLETED', 'SHIPPED'] as CaseStatus[] } },
      orderBy: { createdAt: 'desc' },
      include: { dentist: true },
    })

    const targetCase = existingOpen || await fastify.prisma.case.create({
      data: {
        dentistId: patient.dentistId,
        patientId: id,
        patientName: patient.name,
        patientDob: patient.dob ?? undefined,
        gender: patient.gender ?? undefined,
        status: CaseStatus.DRAFT,
      },
      include: { dentist: true },
    })

    const lastEvent = await fastify.prisma.workflowEvent.findFirst({
      where: { caseId: targetCase.id },
      orderBy: { stage: 'desc' },
    })

    if (lastEvent) {
      return reply.status(400).send({ error: 'Este fluxo já foi iniciado para o paciente' })
    }

    const updatedCase = await fastify.prisma.case.update({
      where: { id: targetCase.id },
      data: {
        status: CaseStatus.IN_PLANNING,
        totvsOrderId: targetCase.totvsOrderId || `CAIXA-${targetCase.caseNumber}`,
      },
      include: { dentist: true },
    })

    await fastify.prisma.$transaction([
      fastify.prisma.workflowEvent.create({
        data: {
          caseId: updatedCase.id,
          stage: 1,
          stageName: 'Recebimento dos modelos',
          performedBy: user.id,
          notes: 'Recebimento inicial registrado via painel do paciente',
        },
      }),
      fastify.prisma.caseActivity.create({
        data: {
          caseId: updatedCase.id,
          userId: user.id,
          action: 'WORKFLOW_STARTED',
          description: 'Fluxo iniciado e enviado para preparo dos modelos',
        },
      }),
      fastify.prisma.notification.create({
        data: {
          userId: updatedCase.dentistId,
          title: `Caixa aberta - Caso #${String(updatedCase.caseNumber).padStart(6, '0')}`,
          message: 'Seu caso entrou em preparo de modelos.',
          link: `/patients/${id}`,
        },
      }),
    ])

    mailer.onCasePlanningStarted(updatedCase).catch(console.error)

    return reply.status(201).send({ case: updatedCase })
  })

  fastify.post('/', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const data = patientSchema.parse(request.body)
    const dentistId = user.role === Role.DENTIST ? user.id : (data.dentistId || user.id)

    const [patient, createdCase] = await fastify.prisma.$transaction(async (tx) => {
      const createdPatient = await tx.patient.create({
        data: {
          name: data.name,
          gender: data.gender,
          dob: data.dob ? new Date(data.dob) : undefined,
          dentistId,
          active: data.active ?? true,
          teethData: data.teethData,
        },
        include: { dentist: { select: { name: true, clinic: true, email: true } } },
      })

      const caseData = await tx.case.create({
        data: {
          dentistId,
          patientId: createdPatient.id,
          patientName: createdPatient.name,
          patientDob: createdPatient.dob ?? undefined,
          gender: createdPatient.gender ?? undefined,
          productType: (data.productType as any) || undefined,
          planningFormData: data.planningFormData || undefined,
          status: CaseStatus.DRAFT,
        },
      })

      await tx.caseActivity.create({
        data: {
          caseId: caseData.id,
          userId: user.id,
          action: 'PATIENT_CREATED',
          description: 'Paciente e caso inicial cadastrados',
        },
      })

      return [createdPatient, caseData]
    })

    mailer.onPatientCreated(patient).catch(console.error)
    const internalUsers = await getInternalNotificationUserIds(dentistId)
    if (internalUsers.length > 0) {
      await fastify.prisma.notification.createMany({
        data: internalUsers.map((userId) => ({
          userId,
          title: 'Novo paciente cadastrado',
          message: `${patient.name} foi cadastrado e já possui um caso inicial.`,
          link: `/patients/${patient.id}`,
        })),
      })
    }

    return reply.status(201).send({ ...patient, initialCaseId: createdCase.id })
  })

  fastify.put('/:id', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }
    const data = patientSchema.partial().parse(request.body)

    const existing = await getAccessiblePatient(id, user)
    if (!existing) return reply.status(404).send({ error: 'Paciente não encontrado' })
    if (existing === 'FORBIDDEN') return reply.status(403).send({ error: 'Acesso negado' })

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
    const user = request.user as JwtPayload
    const patient = await getAccessiblePatient(id, user)
    if (!patient || patient === 'FORBIDDEN') return { photos: [] }

    const photos = await fastify.prisma.photo.findMany({
      where: { patientId: id, isPrivate: isPrivate === 'true' },
      orderBy: { createdAt: 'desc' },
    })
    return { photos }
  })

  fastify.post('/:id/photos', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user as JwtPayload
    const patient = await getAccessiblePatient(id, user)
    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' })
    if (patient === 'FORBIDDEN') return reply.status(403).send({ error: 'Acesso negado' })

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

    if (saved.length > 0) {
      mailer.onPatientPhotosUploaded(patient, saved.length, isPrivate).catch(console.error)
      const internalUsers = await getInternalNotificationUserIds(patient.dentistId)
      if (internalUsers.length > 0) {
        await fastify.prisma.notification.createMany({
          data: internalUsers.map((userId) => ({
            userId,
            title: isPrivate ? 'Fotos restritas enviadas' : 'Fotos enviadas',
            message: `${saved.length} arquivo(s) adicionado(s) ao paciente ${patient.name}.`,
            link: `/patients/${id}`,
          })),
        })
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
    const user = request.user as JwtPayload
    const patient = await getAccessiblePatient(id, user)
    if (!patient || patient === 'FORBIDDEN') return { files: [] }

    const files = await fastify.prisma.digitalModel.findMany({
      where: { patientId: id },
      orderBy: { createdAt: 'desc' },
    })
    return { files }
  })

  fastify.post('/:id/digital-models', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user as JwtPayload
    const patient = await getAccessiblePatient(id, user)
    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' })
    if (patient === 'FORBIDDEN') return reply.status(403).send({ error: 'Acesso negado' })

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
          mailer.onDigitalModelsUploaded(patient, part.filename, kind).catch(console.error)
          const internalUsers = await getInternalNotificationUserIds(patient.dentistId)
          if (internalUsers.length > 0) {
            await fastify.prisma.notification.createMany({
              data: internalUsers.map((userId) => ({
                userId,
                title: 'Modelo digital enviado',
                message: `${patient.name} recebeu um novo modelo digital (${kind}).`,
                link: `/patients/${id}`,
              })),
            })
          }
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
    const user = request.user as JwtPayload
    const patient = await getAccessiblePatient(id, user)
    if (!patient || patient === 'FORBIDDEN') return { files: [] }

    const files = await fastify.prisma.workFile.findMany({
      where: { patientId: id },
      orderBy: { createdAt: 'desc' },
    })
    return { files }
  })

  fastify.post('/:id/work-files', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user as JwtPayload
    const patient = await getAccessiblePatient(id, user)
    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' })
    if (patient === 'FORBIDDEN') return reply.status(403).send({ error: 'Acesso negado' })

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
          mailer.onDigitalModelsUploaded(patient, part.filename, 'work-file').catch(console.error)
          const internalUsers = await getInternalNotificationUserIds(patient.dentistId)
          if (internalUsers.length > 0) {
            await fastify.prisma.notification.createMany({
              data: internalUsers.map((userId) => ({
                userId,
                title: 'Arquivo de trabalho enviado',
                message: `${patient.name} recebeu um novo arquivo de trabalho.`,
                link: `/patients/${id}`,
              })),
            })
          }
          return reply.status(201).send(file)
        } catch {
          return reply.status(201).send({ filename: part.filename, error: 'S3 not configured' })
        }
      }
    }
    return reply.status(400).send({ error: 'No file provided' })
  })
}
