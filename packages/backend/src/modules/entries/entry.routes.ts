import { FastifyInstance } from 'fastify'
import { authenticate, JwtPayload } from '../../plugins/auth'
import { Role, EntryStatus, EntryType, CaseStatus } from '@prisma/client'

export async function entryRoutes(fastify: FastifyInstance) {
  // Listar entradas pendentes
  fastify.get('/', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { status, limit = '50' } = request.query as { status?: string; limit?: string }

    const where: any = {}

    // Filtros por role
    if (user.role === Role.DENTIST) {
      where.dentistId = user.id
    } else if (user.role === Role.SELLER) {
      // Vendedor vê entradas de dentistas do seu portfólio
      const sellerClients = await fastify.prisma.sellerClient.findMany({
        where: { sellerId: user.id },
        select: { clientId: true },
      })
      const clientIds = sellerClients.map(sc => sc.clientId)
      where.dentistId = { in: clientIds }
    } else if (user.role === Role.EXPEDITION) {
      // Expedição vê todas as entradas para gerenciar caixas
      // Não aplica filtro - vê todas
    }
    // Admin, Lab, Financial veem todas

    if (status) {
      where.status = status as EntryStatus
    } else {
      where.status = { in: [EntryStatus.PENDING, EntryStatus.PROCESSING] }
    }

    const entries = await fastify.prisma.entry.findMany({
      where,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, name: true } },
        dentist: { select: { id: true, name: true, clinic: true } },
        case: { select: { id: true, caseNumber: true, status: true } },
        processor: { select: { id: true, name: true } },
      },
    })

    return { entries }
  })

  // Obter detalhes de uma entrada
  fastify.get('/:entryId', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { entryId } = request.params as { entryId: string }

    const entry = await fastify.prisma.entry.findUnique({
      where: { id: entryId },
      include: {
        patient: {
          include: {
            digitalModels: { orderBy: { createdAt: 'desc' }, take: 1 },
            photos: { orderBy: { createdAt: 'desc' } },
          },
        },
        dentist: { select: { id: true, name: true, clinic: true, email: true, phone: true } },
        case: {
          include: {
            service: true,
            workflowEvents: { orderBy: { createdAt: 'desc' }, take: 5 },
          },
        },
        processor: { select: { id: true, name: true } },
      },
    })

    if (!entry) return reply.status(404).send({ error: 'Entrada não encontrada' })

    // Verificar permissão
    if (user.role === Role.DENTIST && entry.dentistId !== user.id) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }

    return { entry }
  })

  // Processar entrada (mover para workflow)
  fastify.post('/:entryId/process', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { entryId } = request.params as { entryId: string }
    const { notes, createCase = false } = request.body as { notes?: string; createCase?: boolean }

    // Apenas roles internos podem processar
    const allowedRoles = [Role.ADMIN, Role.LAB_TECH, Role.FINANCIAL]
    if (!allowedRoles.includes(user.role)) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }

    const entry = await fastify.prisma.entry.findUnique({
      where: { id: entryId },
      include: { patient: true },
    })

    if (!entry) return reply.status(404).send({ error: 'Entrada não encontrada' })
    if (entry.status === EntryStatus.COMPLETED) {
      return reply.status(400).send({ error: 'Entrada já processada' })
    }

    let caseId = entry.caseId

    // Se não tem caso vinculado e solicitou criar
    if (!caseId && createCase && entry.patient) {
      const newCase = await fastify.prisma.case.create({
        data: {
          dentistId: entry.dentistId,
          patientId: entry.patientId,
          patientName: entry.patient.name,
          patientDob: entry.patient.dob,
          gender: entry.patient.gender,
          status: 'IN_PLANNING',
          totvsOrderId: `CAIXA-${entry.boxNumber || 'NEW'}`,
        },
      })
      caseId = newCase.id
    }

    const updated = await fastify.prisma.entry.update({
      where: { id: entryId },
      data: {
        status: EntryStatus.COMPLETED,
        processedAt: new Date(),
        processedBy: user.id,
        notes: notes || entry.notes,
        caseId,
      },
      include: {
        patient: { select: { name: true } },
        dentist: { select: { name: true } },
      },
    })

    // Notificar dentista
    fastify.prisma.notification.create({
      data: {
        userId: entry.dentistId,
        title: `Entrada processada — ${updated.patient?.name || 'Paciente'}`,
        message: `A entrada foi movida para o workflow pelo time interno.`,
        link: caseId ? `/cases/${caseId}` : undefined,
      },
    }).catch(() => { /* non-critical */ })

    return { entry: updated, caseId }
  })

  // Arquivar entrada
  fastify.post('/:entryId/archive', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { entryId } = request.params as { entryId: string }

    const allowedRoles = [Role.ADMIN, Role.LAB_TECH, Role.FINANCIAL, Role.EXPEDITION]
    if (!allowedRoles.includes(user.role)) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }

    const entry = await fastify.prisma.entry.update({
      where: { id: entryId },
      data: { status: EntryStatus.ARCHIVED },
    })

    return { entry }
  })

  // Criar caixa (abrir caixa no TOTVS) - apenas equipe de expedição e roles internos
  fastify.post('/:entryId/create-box', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { entryId } = request.params as { entryId: string }

    // Apenas expedição e roles internos podem criar caixa
    const allowedRoles = [Role.ADMIN, Role.LAB_TECH, Role.FINANCIAL, Role.EXPEDITION]
    if (!allowedRoles.includes(user.role)) {
      return reply.status(403).send({ error: 'Apenas equipe de expedição e interna podem criar caixas' })
    }

    const entry = await fastify.prisma.entry.findUnique({
      where: { id: entryId },
      include: { patient: true },
    })

    if (!entry) return reply.status(404).send({ error: 'Entrada não encontrada' })
    if (entry.boxNumber) {
      return reply.status(400).send({ error: 'Esta entrada já possui uma caixa aberta' })
    }

    // Criar caso se não existir
    let caseId = entry.caseId
    if (!caseId) {
      const newCase = await fastify.prisma.case.create({
        data: {
          dentistId: entry.dentistId,
          patientId: entry.patientId,
          patientName: entry.patient.name,
          patientDob: entry.patient.dob,
          gender: entry.patient.gender,
          status: 'DRAFT',
        },
      })
      caseId = newCase.id
    }

    // Buscar o caso para obter o caseNumber
    const caseData = await fastify.prisma.case.findUnique({
      where: { id: caseId },
      select: { caseNumber: true },
    })

    if (!caseData) {
      return reply.status(500).send({ error: 'Erro ao criar caso' })
    }

    // Gerar número da caixa no formato TOTVS (CAIXA-{caseNumber})
    const boxNumber = `CAIXA-${String(caseData.caseNumber).padStart(6, '0')}`

    // Atualizar entrada com a caixa e mudar status para PROCESSING
    const updated = await fastify.prisma.entry.update({
      where: { id: entryId },
      data: {
        boxNumber,
        caseId,
        status: EntryStatus.PROCESSING,
        processedBy: user.id,
      },
      include: {
        patient: { select: { name: true } },
        dentist: { select: { name: true } },
      },
    })

    // Criar/atualizar o caso com o totvsOrderId
    await fastify.prisma.case.update({
      where: { id: caseId },
      data: {
        totvsOrderId: boxNumber,
      },
    })

    // Notificar dentista
    fastify.prisma.notification.create({
      data: {
        userId: entry.dentistId,
        title: `Caixa aberta — ${updated.patient?.name || 'Paciente'}`,
        message: `A caixa ${boxNumber} foi aberta para este paciente.`,
        link: `/patients/${entry.patientId}`,
      },
    }).catch(() => { /* non-critical */ })

    return { entry: updated, boxNumber, caseId }
  })

  // Iniciar workflow (mover para etapa inicial)
  fastify.post('/:entryId/start-workflow', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { entryId } = request.params as { entryId: string }

    // Apenas expedição e roles internos podem iniciar workflow
    const allowedRoles = [Role.ADMIN, Role.LAB_TECH, Role.FINANCIAL, Role.EXPEDITION]
    if (!allowedRoles.includes(user.role)) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }

    const entry = await fastify.prisma.entry.findUnique({
      where: { id: entryId },
      include: { patient: true, case: true },
    })

    if (!entry) return reply.status(404).send({ error: 'Entrada não encontrada' })
    if (!entry.boxNumber) {
      return reply.status(400).send({ error: 'É necessário criar a caixa antes de iniciar o workflow' })
    }
    if (entry.status === EntryStatus.COMPLETED) {
      return reply.status(400).send({ error: 'Workflow já iniciado para esta entrada' })
    }

    const caseId = entry.caseId
    if (!caseId) {
      return reply.status(400).send({ error: 'Entrada sem caso vinculado' })
    }

    // Atualizar caso para IN_PLANNING
    await fastify.prisma.case.update({
      where: { id: caseId },
      data: {
        status: 'IN_PLANNING',
        totvsOrderId: entry.boxNumber,
      },
    })

    // Criar evento de workflow
    await fastify.prisma.workflowEvent.create({
      data: {
        caseId,
        stage: 1,
        stageName: 'Recebimento dos modelos',
        performedBy: user.id,
        notes: 'Entrada processada e caixa aberta',
      },
    })

    // Atualizar entrada
    const updated = await fastify.prisma.entry.update({
      where: { id: entryId },
      data: {
        status: EntryStatus.COMPLETED,
        processedAt: new Date(),
        processedBy: user.id,
      },
      include: {
        patient: { select: { name: true } },
        dentist: { select: { name: true } },
      },
    })

    // Notificar dentista
    fastify.prisma.notification.create({
      data: {
        userId: entry.dentistId,
        title: `Workflow iniciado — ${updated.patient?.name || 'Paciente'}`,
        message: `O caso foi movido para o workflow na etapa de Recebimento dos modelos.`,
        link: `/cases/${caseId}`,
      },
    }).catch(() => { /* non-critical */ })

    return { entry: updated, caseId }
  })

  // Estatísticas de entradas
  fastify.get('/stats/summary', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload

    const where: any = {}
    if (user.role === Role.DENTIST) {
      where.dentistId = user.id
    } else if (user.role === Role.SELLER) {
      const sellerClients = await fastify.prisma.sellerClient.findMany({
        where: { sellerId: user.id },
        select: { clientId: true },
      })
      where.dentistId = { in: sellerClients.map(sc => sc.clientId) }
    }

    const [pending, processing, totalToday, byType] = await Promise.all([
      fastify.prisma.entry.count({ where: { ...where, status: EntryStatus.PENDING } }),
      fastify.prisma.entry.count({ where: { ...where, status: EntryStatus.PROCESSING } }),
      fastify.prisma.entry.count({
        where: {
          ...where,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      fastify.prisma.entry.groupBy({
        by: ['entryType'],
        where: { ...where, status: { in: [EntryStatus.PENDING, EntryStatus.PROCESSING] } },
        _count: { entryType: true },
      }),
    ])

    return {
      pending,
      processing,
      totalToday,
      byType: byType.reduce((acc, item) => {
        acc[item.entryType] = item._count.entryType
        return acc
      }, {} as Record<string, number>),
    }
  })
}

// Função auxiliar para criar entrada (usada por outros módulos)
export async function createEntry(
  fastify: FastifyInstance,
  data: {
    patientId: string
    dentistId: string
    caseId?: string
    entryType: EntryType
    sourceId?: string
    sourceType?: string
    boxNumber?: string
  }
) {
  // Verificar se já existe entrada pendente para este paciente/tipo
  const existing = await fastify.prisma.entry.findFirst({
    where: {
      patientId: data.patientId,
      entryType: data.entryType,
      status: { in: [EntryStatus.PENDING, EntryStatus.PROCESSING] },
    },
  })

  if (existing) {
    // Atualizar entrada existente
    return fastify.prisma.entry.update({
      where: { id: existing.id },
      data: {
        updatedAt: new Date(),
        ...(data.caseId && { caseId: data.caseId }),
        ...(data.boxNumber && { boxNumber: data.boxNumber }),
      },
    })
  }

  // Buscar último STL do paciente
  const lastStl = await fastify.prisma.digitalModel.findFirst({
    where: { patientId: data.patientId },
    orderBy: { createdAt: 'desc' },
  })

  return fastify.prisma.entry.create({
    data: {
      ...data,
      lastStlDate: lastStl?.createdAt,
      status: EntryStatus.PENDING,
    },
  })
}