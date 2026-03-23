import { FastifyInstance } from 'fastify'
import { authenticate, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'

const WORKFLOW_STAGES = [
  { stage: 1, name: 'Recebimento dos modelos' },
  { stage: 2, name: 'Preparo dos modelos' },
  { stage: 3, name: 'Movimento' },
  { stage: 4, name: 'Status de aprovação enviado' },
  { stage: 5, name: 'Caso aprovado para produção' },
  { stage: 6, name: 'Tipo de faturamento' },
  { stage: 7, name: 'Impressão 3D' },
  { stage: 8, name: 'Recorte acabamento' },
  { stage: 9, name: 'Postagem dos alinhadores' },
]

export async function workflowEventRoutes(fastify: FastifyInstance) {
  fastify.get('/case/:caseId', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { caseId } = request.params as { caseId: string }

    const caseData = await fastify.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        workflowEvents: {
          include: { performer: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
        },
        dentist: { select: { name: true, clinic: true } },
        patient: { select: { name: true } },
      },
    })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })
    if (user.role === Role.DENTIST && caseData.dentistId !== user.id)
      return reply.status(403).send({ error: 'Acesso negado' })

    return { case: caseData, stages: WORKFLOW_STAGES }
  })

  fastify.post('/case/:caseId/advance', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    if (user.role === Role.DENTIST) return reply.status(403).send({ error: 'Acesso negado' })

    const { caseId } = request.params as { caseId: string }
    const { notes } = request.body as { notes?: string }

    const caseData = await fastify.prisma.case.findUnique({
      where: { id: caseId },
      include: { workflowEvents: { orderBy: { stage: 'desc' }, take: 1 } },
    })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })

    const lastStage = caseData.workflowEvents[0]?.stage || 0
    const nextStage = lastStage + 1
    if (nextStage > 9) return reply.status(400).send({ error: 'Workflow já concluído' })

    const stageName = WORKFLOW_STAGES.find(s => s.stage === nextStage)?.name || ''

    const stageToStatus: Record<number, string> = {
      1: 'IN_PLANNING',
      2: 'IN_PLANNING',
      3: 'IN_MOVEMENT',
      4: 'LAB_APPROVAL',
      5: 'WAITING_APPROVAL',
      6: 'APPROVED',
      7: 'PRINTING_3D',
      8: 'LABORATORY',
      9: 'EXPEDITION',
    }
    const newStatus = stageToStatus[nextStage]

    const updateData: any = { status: newStatus as any }
    if (nextStage === 1 && !caseData.totvsOrderId) {
      updateData.totvsOrderId = `CAIXA-${caseData.caseNumber}`
    }

    const caseLabel = `Caso #${String(caseData.caseNumber).padStart(6, '0')} — ${caseData.patientName}`

    const ops: any[] = [
      fastify.prisma.workflowEvent.create({
        data: { caseId, stage: nextStage, stageName, performedBy: user.id, notes },
      }),
      fastify.prisma.case.update({
        where: { id: caseId },
        data: updateData,
      }),
      fastify.prisma.notification.create({
        data: {
          userId: caseData.dentistId,
          title: `${caseLabel}`,
          message: `Etapa avançada: ${stageName}`,
          link: `/cases/${caseId}`,
        },
      }),
    ]

    await fastify.prisma.$transaction(ops)

    return { ok: true, stage: nextStage, stageName, newStatus }
  })

  fastify.patch('/case/:caseId/billing', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    if (user.role === Role.DENTIST) return reply.status(403).send({ error: 'Acesso negado' })

    const { caseId } = request.params as { caseId: string }
    const { billingType, installmentOption, dropoutInsurance, discountCoupon, packActive } = request.body as any

    const updated = await fastify.prisma.case.update({
      where: { id: caseId },
      data: { billingType, installmentOption, dropoutInsurance, discountCoupon, packActive },
    })
    return updated
  })

  fastify.post('/case/:caseId/approve', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { caseId } = request.params as { caseId: string }

    if (user.role !== Role.DENTIST) return reply.status(403).send({ error: 'Apenas dentistas podem aprovar' })

    await fastify.prisma.case.update({ where: { id: caseId }, data: { status: 'APPROVED' as any } })
    return { ok: true }
  })

  fastify.post('/case/:caseId/request-revision', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { caseId } = request.params as { caseId: string }
    const { notes } = request.body as { notes?: string }

    if (user.role !== Role.DENTIST) return reply.status(403).send({ error: 'Apenas dentistas podem solicitar alteração' })

    const revCase = await fastify.prisma.case.findUnique({ where: { id: caseId } })
    if (!revCase) return reply.status(404).send({ error: 'Caso não encontrado' })

    await fastify.prisma.$transaction([
      fastify.prisma.case.update({ where: { id: caseId }, data: { status: 'REVISION_REQUESTED' as any } }),
      fastify.prisma.workflowEvent.create({
        data: { caseId, stage: 0, stageName: 'Solicitação de alteração pelo dentista', performedBy: user.id, notes },
      }),
      fastify.prisma.notification.create({
        data: {
          userId: revCase.dentistId,
          title: `Alteração solicitada — Caso #${String(revCase.caseNumber).padStart(6, '0')}`,
          message: notes || 'O dentista solicitou alteração neste caso.',
          link: `/cases/${caseId}`,
        },
      }),
    ])
    return { ok: true }
  })
}
