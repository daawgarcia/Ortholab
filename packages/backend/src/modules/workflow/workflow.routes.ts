import { FastifyInstance } from 'fastify'
import { authenticate, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'
import { EventMailer } from '../mailer/event-mailer'
import { applyCouponDiscount, getAllowedInstallmentOptions, getChargeAmountForCase, isAlignerService, normalizeInstallmentOption } from '../services/pricing.utils'

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

const BILLING_SERVICE_MAP: Record<string, string> = {
  FULL: 'FULL',
  MID: 'MID',
  'EA AIR2': 'AIR',
  'EA AIR²': 'AIR',
  UNIDADE: 'EXPRESS',
  'FINALIZACAO (CONTENCAO)': 'RETAINER',
  'FINALIZAÇÃO (CONTENÇÃO)': 'RETAINER',
  'PLACA MIORRELAXANTE': 'OTHER',
}

function normalizeBillingKey(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

export async function workflowEventRoutes(fastify: FastifyInstance) {
  const mailer = new EventMailer(fastify)

  async function ensureSellerAccess(user: JwtPayload, dentistId: string) {
    if (user.role !== Role.SELLER) return true
    const relation = await fastify.prisma.sellerClient.findUnique({
      where: { sellerId_clientId: { sellerId: user.id, clientId: dentistId } },
    })
    return !!relation
  }

  async function resolveService(caseData: any, billingType?: string, serviceId?: string) {
    if (serviceId) {
      return fastify.prisma.service.findFirst({
        where: { id: serviceId, active: true },
        include: { prices: { orderBy: { validFrom: 'desc' } } },
      })
    }

    if (caseData.service) {
      return caseData.service
    }

    const billingKey = normalizeBillingKey(billingType)
    const serviceType = BILLING_SERVICE_MAP[billingKey]
    if (!serviceType && !billingKey) return null

    return fastify.prisma.service.findFirst({
      where: {
        active: true,
        OR: [
          serviceType ? { type: serviceType } : undefined,
          billingType ? { name: { equals: billingType, mode: 'insensitive' } } : undefined,
        ].filter(Boolean) as any,
      },
      include: { prices: { orderBy: { validFrom: 'desc' } } },
      orderBy: { createdAt: 'asc' },
    })
  }

  async function syncDentistInvoice(caseData: any, amount: number) {
    const description = `Caso #${caseData.caseNumber} - ${caseData.patientName} - ${caseData.service?.name || caseData.billingType || caseData.productType || 'Serviço'}`
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const existingInvoice = await fastify.prisma.dentistInvoice.findFirst({
      where: { caseId: caseData.id, dentistId: caseData.dentistId },
      orderBy: { createdAt: 'desc' },
    })

    if (existingInvoice?.status === 'PAID') return

    if (existingInvoice) {
      await fastify.prisma.dentistInvoice.update({
        where: { id: existingInvoice.id },
        data: {
          invoiceNumber: existingInvoice.invoiceNumber || `ORTHO-${caseData.caseNumber}`,
          description,
          amount,
          dueDate,
          status: 'OPEN',
        },
      })
      return
    }

    await fastify.prisma.dentistInvoice.create({
      data: {
        dentistId: caseData.dentistId,
        caseId: caseData.id,
        invoiceNumber: `ORTHO-${caseData.caseNumber}`,
        description,
        amount,
        dueDate,
      },
    })
  }

  async function persistBilling(caseData: any, payload: any) {
    const { billingType, installmentOption, dropoutInsurance, discountCoupon, packActive, serviceId } = payload
    const wantsPricing = !!(billingType || installmentOption || discountCoupon || serviceId)
    const service = await resolveService(caseData, billingType, serviceId)

    if (wantsPricing && !service) {
      throw new Error('Selecione um tipo de produto/pacote válido antes de salvar o faturamento')
    }

    const normalizedInstallment = service ? normalizeInstallmentOption(installmentOption) : null
    if (service) {
      const allowedInstallments = getAllowedInstallmentOptions(service)
      if (normalizedInstallment && !allowedInstallments.includes(normalizedInstallment)) {
        throw new Error('Parcelamento não permitido para este serviço')
      }
    }

    const normalizedCoupon = String(discountCoupon || '').trim().toUpperCase()
    let coupon: any = null

    if (normalizedCoupon) {
      if (!service || !isAlignerService(service.type)) {
        throw new Error('Cupom só pode ser aplicado em casos de alinhadores')
      }

      coupon = await fastify.prisma.coupon.findUnique({ where: { code: normalizedCoupon } })
      if (!coupon || !coupon.active) {
        throw new Error('Cupom inválido ou inativo')
      }
    }

    const updated = await fastify.prisma.case.update({
      where: { id: caseData.id },
      data: {
        billingType: billingType || caseData.billingType || null,
        installmentOption: normalizedInstallment || caseData.installmentOption || null,
        dropoutInsurance: typeof dropoutInsurance === 'boolean' ? dropoutInsurance : !!caseData.dropoutInsurance,
        discountCoupon: service && isAlignerService(service.type) ? (normalizedCoupon || null) : null,
        packActive: typeof packActive === 'boolean' ? packActive : !!caseData.packActive,
        serviceId: service?.id || caseData.serviceId || null,
      },
      include: {
        dentist: true,
        patient: true,
        service: { include: { prices: { orderBy: { validFrom: 'desc' } } } },
      },
    })

    if (updated.service) {
      const baseAmount = getChargeAmountForCase(updated.service, updated.installmentOption)
      const finalAmount = coupon ? applyCouponDiscount(baseAmount, coupon) : baseAmount
      await syncDentistInvoice(updated, finalAmount)
      return { updated, baseAmount, finalAmount }
    }

    return { updated, baseAmount: null, finalAmount: null }
  }

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
        service: { include: { prices: { orderBy: { validFrom: 'desc' } } } },
      },
    })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })
    if (user.role === Role.DENTIST && caseData.dentistId !== user.id)
      return reply.status(403).send({ error: 'Acesso negado' })
    if (!(await ensureSellerAccess(user, caseData.dentistId)))
      return reply.status(403).send({ error: 'Acesso negado' })

    return { case: caseData, stages: WORKFLOW_STAGES }
  })

  fastify.post('/case/:caseId/advance', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const internalWorkflowRoles: Role[] = [Role.ADMIN, Role.LAB_TECH, Role.FINANCIAL]
    if (!internalWorkflowRoles.includes(user.role)) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }

    const { caseId } = request.params as { caseId: string }
    const { notes } = ((request.body as any) || {}) as { notes?: string }

    const caseData = await fastify.prisma.case.findUnique({
      where: { id: caseId },
      include: { workflowEvents: { orderBy: { stage: 'desc' }, take: 1 }, dentist: true },
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

    await fastify.prisma.$transaction([
      fastify.prisma.workflowEvent.create({
        data: { caseId, stage: nextStage, stageName, performedBy: user.id, notes },
      }),
      fastify.prisma.case.update({
        where: { id: caseId },
        data: updateData,
      }),
    ])

    // Notification outside transaction — failure here does not block the advance
    fastify.prisma.notification.create({
      data: {
        userId: caseData.dentistId,
        title: caseLabel,
        message: `Etapa avançada: ${stageName}`,
        link: caseData.patientId ? `/patients/${caseData.patientId}` : `/cases/${caseId}`,
      },
    }).catch(() => { /* non-critical */ })

    mailer.onWorkflowAdvanced(caseData, stageName).catch(() => { /* non-critical */ })

    return { ok: true, stage: nextStage, stageName, newStatus }
  })

  fastify.patch('/case/:caseId/billing', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { caseId } = request.params as { caseId: string }

    const caseData = await fastify.prisma.case.findUnique({
      where: { id: caseId },
      include: { service: { include: { prices: { orderBy: { validFrom: 'desc' } } } } },
    })

    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })
    if (user.role === Role.DENTIST && caseData.dentistId !== user.id) return reply.status(403).send({ error: 'Acesso negado' })
    if (!(await ensureSellerAccess(user, caseData.dentistId))) return reply.status(403).send({ error: 'Acesso negado' })

    try {
      const billingResult = await persistBilling(caseData, request.body as any)
      return { case: billingResult.updated, amount: billingResult.finalAmount, baseAmount: billingResult.baseAmount }
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Falha ao atualizar faturamento' })
    }
  })

  fastify.post('/case/:caseId/approve', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { caseId } = request.params as { caseId: string }

    const caseData = await fastify.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        dentist: true,
        patient: true,
        service: { include: { prices: { orderBy: { validFrom: 'desc' } } } },
        workflowEvents: { orderBy: { stage: 'desc' }, take: 1 },
      },
    })

    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })

    const isDentistOwner = user.role === Role.DENTIST && caseData.dentistId === user.id
    const isAdmin = user.role === Role.ADMIN
    const isSeller = user.role === Role.SELLER && await ensureSellerAccess(user, caseData.dentistId)

    if (!isDentistOwner && !isAdmin && !isSeller) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }

    if (caseData.status !== 'WAITING_APPROVAL' && caseData.status !== 'APPROVED') {
      return reply.status(400).send({ error: 'Caso não está aguardando aprovação' })
    }

    if (isSeller) {
      if (!caseData.patientId) return reply.status(400).send({ error: 'Caso sem paciente vinculado' })
      const proofPhoto = await fastify.prisma.photo.findFirst({
        where: { patientId: caseData.patientId, isPrivate: true },
        orderBy: { createdAt: 'desc' },
      })
      if (!proofPhoto) {
        return reply.status(400).send({ error: 'O vendedor precisa anexar uma foto na área restrita antes de aprovar para o dentista' })
      }
    }

    let currentCase: any = caseData
    const lastStage = caseData.workflowEvents[0]?.stage || 5
    const billingPayload = request.body as any
    if (Object.keys(billingPayload || {}).length > 0) {
      try {
        const billingResult = await persistBilling(caseData, billingPayload)
        currentCase = billingResult.updated
      } catch (error: any) {
        return reply.status(400).send({ error: error.message || 'Falha ao salvar faturamento' })
      }
    }

    const operations = [] as any[]

    if (lastStage < 6) {
      operations.push(fastify.prisma.workflowEvent.create({
        data: { caseId, stage: 6, stageName: 'Tipo de faturamento', performedBy: user.id, notes: isDentistOwner ? 'Faturamento definido pelo dentista' : 'Faturamento definido pelo time interno' },
      }))
    }
    if (lastStage < 7) {
      operations.push(fastify.prisma.workflowEvent.create({
        data: { caseId, stage: 7, stageName: 'Impressão 3D', performedBy: user.id, notes: isDentistOwner ? 'Caso aprovado pelo dentista' : 'Caso aprovado para o dentista pelo time interno' },
      }))
    }

    operations.push(fastify.prisma.case.update({ where: { id: caseId }, data: { status: 'PRINTING_3D' as any } }))
    operations.push(fastify.prisma.caseActivity.create({
      data: {
        caseId,
        userId: user.id,
        action: 'APPROVED',
        description: isDentistOwner ? 'Planejamento aprovado pelo dentista' : 'Planejamento aprovado para o dentista pelo time interno',
      },
    }))

    await fastify.prisma.$transaction(operations)

    fastify.prisma.notification.create({
      data: {
        userId: caseData.dentistId,
        title: `Caso #${String(caseData.caseNumber).padStart(6, '0')} aprovado`,
        message: isDentistOwner ? 'Seu caso foi liberado para impressão 3D.' : 'Seu caso foi aprovado pelo time interno e liberado para impressão 3D.',
        link: caseData.patientId ? `/patients/${caseData.patientId}` : `/cases/${caseId}`,
      },
    }).catch(() => { /* non-critical */ })

    const approvedCase = await fastify.prisma.case.findUnique({
      where: { id: caseId },
      include: { dentist: true, patient: true, service: true },
    })
    if (approvedCase) {
      mailer.onCaseApproved(approvedCase).catch(() => { /* non-critical */ })
    }

    return { ok: true }
  })

  fastify.post('/case/:caseId/ship', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    if (user.role === Role.DENTIST) return reply.status(403).send({ error: 'Acesso negado' })

    const { caseId } = request.params as { caseId: string }
    const { trackingCode, carrier } = ((request.body as any) || {}) as { trackingCode?: string; carrier?: string }

    if (!trackingCode?.trim()) return reply.status(400).send({ error: 'Código de rastreio obrigatório' })

    const caseData = await fastify.prisma.case.findUnique({
      where: { id: caseId },
      include: { dentist: true },
    })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })
    if (caseData.status !== 'EXPEDITION' as any) return reply.status(400).send({ error: 'Caso não está em Expedição' })

    await fastify.prisma.$transaction([
      fastify.prisma.production.upsert({
        where: { caseId },
        update: { trackingCode: trackingCode.trim(), carrier: carrier?.trim() || null, shippedAt: new Date() },
        create: { caseId, trackingCode: trackingCode.trim(), carrier: carrier?.trim() || null, shippedAt: new Date() },
      }),
      fastify.prisma.workflowEvent.create({
        data: { caseId, stage: 9, stageName: 'Postagem dos alinhadores', performedBy: user.id, notes: `Rastreio: ${trackingCode.trim()}` },
      }),
      fastify.prisma.case.update({
        where: { id: caseId },
        data: { status: 'SHIPPED' as any },
      }),
      fastify.prisma.caseActivity.create({
        data: { caseId, userId: user.id, action: 'SHIPPED', description: `Caso postado — rastreio: ${trackingCode.trim()}` },
      }),
    ])

    // Notify dentist (non-critical)
    fastify.prisma.notification.create({
      data: {
        userId: caseData.dentistId,
        title: `Caso #${String(caseData.caseNumber).padStart(6, '0')} postado!`,
        message: `Seu case foi enviado. Rastreio: ${trackingCode.trim()}`,
        link: `/cases/${caseId}`,
      },
    }).catch(() => { /* non-critical */ })

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
