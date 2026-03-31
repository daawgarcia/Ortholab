import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { CaseStatus, Role } from '@prisma/client'
import { authenticate, requireRole, JwtPayload } from '../../plugins/auth'
import { EventMailer } from '../mailer/event-mailer'

const createCaseSchema = z.object({
  patientName: z.string().min(2),
  patientDob: z.string().optional(),
  gender: z.string().optional(),
  notes: z.string().optional(),
  patientId: z.string().optional(),
  serviceId: z.string().optional(),
  productType: z.string().optional(),
  planningFormData: z.any().optional(),
  status: z.nativeEnum(CaseStatus).optional(),
  dentistId: z.string().optional(),
  isRefinement: z.boolean().optional(),
  parentCaseId: z.string().optional(),
})

export async function caseRoutes(fastify: FastifyInstance) {
  const mailer = new EventMailer(fastify)

  fastify.get('/', { preHandler: authenticate }, async (request) => {
    const user = request.user as JwtPayload
    const { status, search, page = '1', limit = '20' } = request.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: any = {}
    if (user.role === Role.DENTIST) where.dentistId = user.id
    if (user.role === Role.SELLER) {
      const portfolio = await fastify.prisma.sellerClient.findMany({
        where: { sellerId: user.id },
        select: { clientId: true },
      })
      where.dentistId = { in: portfolio.map((item) => item.clientId) }
    }
    if (status) where.status = status
    if (search) where.patientName = { contains: search, mode: 'insensitive' }

    const [cases, total] = await Promise.all([
      fastify.prisma.case.findMany({
        where,
        include: {
          dentist: { select: { name: true, clinic: true, email: true } },
          service: true,
          payment: { select: { status: true, amount: true } },
          financial: { select: { invoiceNumber: true, billedAt: true } },
          _count: { select: { documents: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      fastify.prisma.case.count({ where }),
    ])

    return { cases, total, page: parseInt(page), limit: parseInt(limit) }
  })

  fastify.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user as JwtPayload

    const caseData = await fastify.prisma.case.findUnique({
      where: { id },
      include: {
        dentist: { select: { id: true, name: true, clinic: true, email: true, phone: true } },
        service: { include: { prices: { orderBy: { validFrom: 'desc' } } } },
        documents: { orderBy: { uploadedAt: 'desc' } },
        plannings: {
          include: {
            labTech: { select: { name: true } },
            revisions: { include: { requester: { select: { name: true, role: true } } }, orderBy: { createdAt: 'desc' } },
          },
          orderBy: { createdAt: 'desc' },
        },
        production: true,
        payment: true,
        financial: { include: { billedBy: { select: { name: true } } } },
        activities: { orderBy: { createdAt: 'desc' }, take: 50 },
        refinements: { select: { id: true, caseNumber: true, status: true, createdAt: true } },
        parentCase: { select: { id: true, caseNumber: true, status: true } },
      },
    })

    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })
    if (user.role === Role.DENTIST && caseData.dentistId !== user.id) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }
    if (user.role === Role.SELLER) {
      const relation = await fastify.prisma.sellerClient.findUnique({
        where: { sellerId_clientId: { sellerId: user.id, clientId: caseData.dentistId } },
      })
      if (!relation) return reply.status(403).send({ error: 'Acesso negado' })
    }

    return { case: caseData }
  })

  fastify.post('/', { preHandler: authenticate }, async (request, reply) => {
    const data = createCaseSchema.parse(request.body)
    const user = request.user as JwtPayload

    let dentistId = user.id
    let patientData: any = null

    if (data.patientId) {
      patientData = await fastify.prisma.patient.findUnique({ where: { id: data.patientId } })
      if (!patientData) return reply.status(404).send({ error: 'Paciente não encontrado' })
      dentistId = patientData.dentistId
    } else if (data.dentistId) {
      dentistId = data.dentistId
    }

    if (user.role === Role.DENTIST && dentistId !== user.id) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }

    if (user.role === Role.SELLER) {
      const relation = await fastify.prisma.sellerClient.findUnique({
        where: { sellerId_clientId: { sellerId: user.id, clientId: dentistId } },
      })
      if (!relation) return reply.status(403).send({ error: 'Acesso negado' })
    }

    const caseData = await fastify.prisma.case.create({
      data: {
        ...data,
        dentistId,
        patientId: data.patientId,
        patientName: patientData?.name || data.patientName,
        patientDob: patientData?.dob || (data.patientDob ? new Date(data.patientDob) : undefined),
        gender: patientData?.gender || data.gender,
        status: data.status || CaseStatus.DRAFT,
      } as any,
      include: { dentist: true, service: true },
    })

    await fastify.prisma.caseActivity.create({
      data: { caseId: caseData.id, userId: user.id, action: 'CREATED', description: 'Caso criado' },
    })

    return reply.status(201).send({ case: caseData })
  })

  fastify.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = request.body as any
    const user = request.user as JwtPayload

    const existing = await fastify.prisma.case.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Caso não encontrado' })
    if (user.role === Role.DENTIST && existing.dentistId !== user.id) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }

    const updated = await fastify.prisma.case.update({
      where: { id },
      data,
      include: { dentist: true, service: true },
    })

    return { case: updated }
  })

  fastify.post('/:id/submit', { preHandler: requireRole(Role.DENTIST) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    
    const caseData = await fastify.prisma.case.findUnique({
      where: { id },
      include: { dentist: true, service: true },
    })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })
    if (caseData.dentistId !== (request.user as JwtPayload).id) return reply.status(403).send({ error: 'Acesso negado' })
    if (caseData.status !== CaseStatus.DRAFT) return reply.status(400).send({ error: 'Caso já foi submetido' })

    const updated = await fastify.prisma.case.update({
      where: { id },
      data: { status: CaseStatus.SUBMITTED },
    })

    await fastify.prisma.caseActivity.create({
      data: { caseId: id, userId: (request.user as JwtPayload).id, action: 'SUBMITTED', description: 'Caso submetido para análise' },
    })

    await mailer.onCaseSubmitted(caseData)

    return { case: updated }
  })

  fastify.post('/:id/approve', { preHandler: requireRole(Role.DENTIST) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    
    const caseData = await fastify.prisma.case.findUnique({
      where: { id },
      include: {
        dentist: true,
        service: true,
        plannings: { orderBy: { createdAt: 'desc' }, take: 1 },
        workflowEvents: { orderBy: { stage: 'desc' }, take: 1 },
      },
    })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })
    if (caseData.dentistId !== (request.user as JwtPayload).id) return reply.status(403).send({ error: 'Acesso negado' })
    if (caseData.status !== CaseStatus.WAITING_APPROVAL) return reply.status(400).send({ error: 'Caso não está aguardando aprovação' })

    const lastStage = (caseData as any).workflowEvents[0]?.stage || 5

    // Auto-advance past billing stage (6) directly into PRINTING_3D (7)
    await fastify.prisma.$transaction([
      fastify.prisma.workflowEvent.create({
        data: { caseId: id, stage: lastStage + 1, stageName: 'Tipo de faturamento', performedBy: (request.user as JwtPayload).id },
      }),
      fastify.prisma.workflowEvent.create({
        data: { caseId: id, stage: lastStage + 2, stageName: 'Impressão 3D', performedBy: (request.user as JwtPayload).id },
      }),
      fastify.prisma.case.update({
        where: { id },
        data: { status: CaseStatus.PRINTING_3D },
      }),
      fastify.prisma.caseActivity.create({
        data: { caseId: id, userId: (request.user as JwtPayload).id, action: 'APPROVED', description: 'Planejamento aprovado pelo dentista — enviado para Impressão 3D' },
      }),
    ])

    await mailer.onCaseApproved(caseData)

    return { ok: true }
  })

  fastify.post('/:id/request-revision', { preHandler: requireRole(Role.DENTIST) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { notes } = request.body as { notes: string }

    const caseData = await fastify.prisma.case.findUnique({
      where: { id },
      include: { dentist: true, plannings: { orderBy: { createdAt: 'desc' }, take: 1, include: { labTech: true } } },
    })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })
    if (caseData.dentistId !== (request.user as JwtPayload).id) return reply.status(403).send({ error: 'Acesso negado' })

    const latestPlanning = caseData.plannings[0]
    if (!latestPlanning) return reply.status(400).send({ error: 'Sem planejamento para revisar' })

    await fastify.prisma.revision.create({
      data: { planningId: latestPlanning.id, requestedBy: (request.user as JwtPayload).id, notes, status: 'PENDING' },
    })

    await fastify.prisma.case.update({ where: { id }, data: { status: CaseStatus.REVISION_REQUESTED } })

    await fastify.prisma.caseActivity.create({
      data: { caseId: id, userId: (request.user as JwtPayload).id, action: 'REVISION_REQUESTED', description: `Revisão solicitada: ${notes}` },
    })

    await mailer.onRevisionRequested(caseData, notes)

    return { message: 'Revisão solicitada com sucesso' }
  })

  fastify.post('/:id/status', { preHandler: requireRole(Role.ADMIN, Role.LAB_TECH) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status, trackingCode, carrier } = request.body as { status: CaseStatus; trackingCode?: string; carrier?: string }

    const caseData = await fastify.prisma.case.findUnique({
      where: { id },
      include: { dentist: true },
    })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })

    await fastify.prisma.case.update({ where: { id }, data: { status } })

    await fastify.prisma.caseActivity.create({
      data: { caseId: id, userId: (request.user as JwtPayload).id, action: 'STATUS_CHANGED', description: `Status alterado para ${status}` },
    })

    if (status === CaseStatus.SHIPPED && trackingCode) {
      await fastify.prisma.production.upsert({
        where: { caseId: id },
        update: { trackingCode, carrier, shippedAt: new Date() },
        create: { caseId: id, trackingCode, carrier, shippedAt: new Date() },
      })
      await mailer.onCaseShipped(caseData, trackingCode)
    } else if (status === CaseStatus.IN_PRODUCTION) {
      await mailer.onCaseInProduction(caseData)
    } else if (status === CaseStatus.COMPLETED) {
      await mailer.onCaseCompleted(caseData)
    } else if (status === CaseStatus.IN_PLANNING) {
      await mailer.onCasePlanningStarted(caseData)
    }

    return { message: 'Status atualizado' }
  })

  fastify.post('/:id/request-refinement', { preHandler: requireRole(Role.DENTIST) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { notes } = request.body as { notes: string }

    const parentCase = await fastify.prisma.case.findUnique({
      where: { id },
      include: { dentist: true, service: true },
    })
    if (!parentCase) return reply.status(404).send({ error: 'Caso não encontrado' })
    if (parentCase.dentistId !== (request.user as JwtPayload).id) return reply.status(403).send({ error: 'Acesso negado' })
    if (parentCase.status !== CaseStatus.COMPLETED) return reply.status(400).send({ error: 'Refinamento só pode ser solicitado em casos concluídos' })

    // Criar novo caso de refinamento
    const refinementCase = await fastify.prisma.case.create({
      data: {
        dentistId: parentCase.dentistId,
        patientId: parentCase.patientId,
        serviceId: parentCase.serviceId,
        patientName: parentCase.patientName,
        patientDob: parentCase.patientDob,
        gender: parentCase.gender,
        notes: `Refinamento solicitado para caso #${parentCase.caseNumber}: ${notes}`,
        status: CaseStatus.SUBMITTED,
        isRefinement: true,
        parentCaseId: id,
      },
      include: { dentist: true, service: true },
    })

    await fastify.prisma.caseActivity.create({
      data: { caseId: id, userId: (request.user as JwtPayload).id, action: 'REFINEMENT_REQUESTED', description: `Refinamento solicitado: ${notes}` },
    })

    await mailer.onRefinementRequested(parentCase, refinementCase, notes)

    return reply.status(201).send({ case: refinementCase, message: 'Refinamento solicitado com sucesso' })
  })
}
