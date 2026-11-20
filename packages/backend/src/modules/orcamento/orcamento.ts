import { FastifyInstance } from 'fastify'
import { PrismaClient, Role } from '@prisma/client'
import { authenticate, requireRole, JwtPayload } from '../../plugins/auth'
import {
  getCasePricingSnapshot, getProgressiveAlignerDiscountRate, getAllowedInstallmentOptions, isAlignerService,
} from '../services/pricing.utils'
import { getPricingContext } from '../financial/pricing-context'
import { calcularFrete, siglaUF } from './frete'

/**
 * Orçamento do caso no momento da aprovação:
 * pacote (Unidade/MID/FULL...) + parcelas + desconto progressivo do mês + taxa da checagem (> 30 dias)
 * + frete pelo endereço de entrega (ou zero quando RETIRA).
 */
export async function calcularOrcamento(
  prisma: PrismaClient,
  caso: any, // com dentist, checagem, approvedAt, id, caseNumber, dentistId
  servico: any, // com prices
  opts: { installmentOption?: string | null; deliveryMethod?: string | null; coupon?: any } = {},
) {
  const quandoAprova = caso.approvedAt ? new Date(caso.approvedAt) : new Date()
  const ctx = await getPricingContext(prisma, { ...caso, approvedAt: quandoAprova })
  const progressivo = getProgressiveAlignerDiscountRate(servico.type, ctx.approvedBefore)
  const snap = getCasePricingSnapshot(servico, opts.installmentOption, opts.coupon || null, progressivo, {
    quantity: ctx.quantity, checagemFee: ctx.checagemFee,
  })
  // MID: guias de attachment cobradas pelo preço do alinhador unitário (FULL: inclusas)
  let guias = 0
  let valorGuias = 0
  if (servico.type === 'MID') {
    guias = Number(caso.planningFormData?.guiaAttachments || 0) || Number(caso.checagem?.guias || 0)
    if (guias > 0) {
      const unidade = await prisma.service.findFirst({
        where: { type: 'UNIDADE', active: true },
        include: { prices: { orderBy: { validFrom: 'desc' } } },
        orderBy: { createdAt: 'desc' },
      })
      const preco = unidade?.prices.find((p: any) => !p.groupId || p.groupId === 'CASH')
      valorGuias = Number(((Number(preco?.price || 0)) * guias).toFixed(2))
    }
  }
  const retira = String(opts.deliveryMethod || '').toUpperCase() === 'RETIRA'
  const frete = retira
    ? { valor: 0, uf: null, cidade: null, origem: 'Retira no laboratório' }
    : await calcularFrete(prisma, caso.dentist)
  const total = Number((snap.finalAmount + valorGuias + (frete.valor || 0)).toFixed(2))
  return {
    servico: { id: servico.id, nome: servico.name, tipo: servico.type },
    parcelas: snap.installmentOption,
    quantidade: servico.type === 'UNIDADE' ? snap.quantity : null,
    precoUnitario: snap.unitPrice,
    valorCheio: snap.baseAmount,
    descontoProgressivo: progressivo,
    casoNoMes: ctx.approvedBefore + 1,
    valorComDesconto: snap.amountAfterProgressive,
    taxaChecagem: snap.checagemFee,
    guiasAttachment: guias ? { quantidade: guias, valor: valorGuias } : null,
    frete,
    entrega: retira ? 'RETIRA' : 'ENTREGA',
    total,
    totalSemFrete: Number((snap.finalAmount + valorGuias).toFixed(2)),
  }
}

export async function orcamentoRoutes(fastify: FastifyInstance) {
  /** Opções de pacote com o valor de cada uma, para o dentista escolher ao aprovar. */
  fastify.get('/caso/:caseId', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { caseId } = request.params as { caseId: string }
    const { serviceId, parcelas, entrega } = request.query as any
    const caso = await fastify.prisma.case.findUnique({ where: { id: caseId }, include: { dentist: true } })
    if (!caso) return reply.status(404).send({ error: 'Caso não encontrado' })
    if (user.role === Role.DENTIST && caso.dentistId !== user.id) return reply.status(403).send({ error: 'Acesso negado' })

    const servicos = await fastify.prisma.service.findMany({
      where: serviceId ? { id: serviceId } : { active: true, type: { in: ['UNIDADE', 'MID', 'FULL'] } },
      include: { prices: { orderBy: { validFrom: 'desc' } } },
    })
    const ordem: Record<string, number> = { UNIDADE: 1, MID: 2, FULL: 3 }
    servicos.sort((a, b) => (ordem[a.type] || 9) - (ordem[b.type] || 9))
    const opcoes = []
    for (const s of servicos) {
      const permitidas = getAllowedInstallmentOptions(s as any)
      const p = permitidas.includes(String(parcelas || '1x')) ? String(parcelas || '1x') : '1x'
      try {
        opcoes.push({ ...(await calcularOrcamento(fastify.prisma, caso, s, { installmentOption: p, deliveryMethod: entrega })), parcelasPermitidas: permitidas })
      } catch (err: any) {
        opcoes.push({ servico: { id: s.id, nome: s.name, tipo: s.type }, erro: err.message, parcelasPermitidas: permitidas })
      }
    }
    return {
      opcoes,
      endereco: {
        uf: siglaUF(caso.dentist.deliveryState) || siglaUF(caso.dentist.state),
        cidade: caso.dentist.deliveryCity || caso.dentist.city,
      },
    }
  })

  // ---- tabela de frete (admin)
  fastify.get('/frete', { preHandler: authenticate }, async () => {
    const faixas = await fastify.prisma.freightRate.findMany({ orderBy: [{ uf: 'asc' }, { cidade: 'asc' }] })
    return { faixas }
  })

  fastify.put('/frete', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { faixas } = request.body as { faixas: Array<{ uf: string; cidade?: string | null; valor: number; prazoDias?: number | null }> }
    if (!Array.isArray(faixas) || !faixas.length) return reply.status(400).send({ error: 'Envie a tabela de frete' })
    const limpas = faixas
      .map(f => ({ uf: siglaUF(f.uf) || '', cidade: f.cidade?.trim() || null, valor: Number(f.valor), prazoDias: f.prazoDias ? Number(f.prazoDias) : null }))
      .filter(f => f.uf && Number.isFinite(f.valor) && f.valor >= 0)
    await fastify.prisma.$transaction([
      fastify.prisma.freightRate.deleteMany({}),
      fastify.prisma.freightRate.createMany({ data: limpas }),
    ])
    await fastify.audit.log(request, { action: 'admin.frete_atualizado', metadata: { linhas: limpas.length } })
    return { ok: true, linhas: limpas.length }
  })
}

export { isAlignerService }
