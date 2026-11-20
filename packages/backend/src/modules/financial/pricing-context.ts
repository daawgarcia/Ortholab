import { PrismaClient } from '@prisma/client'
import { PROGRESSIVE_TYPES, getAlignerQuantity, getChecagemFee } from '../services/pricing.utils'

const SP_OFFSET_MS = 3 * 3600 * 1000 // America/Sao_Paulo (sem horário de verão)

/** Início e fim do mês (horário de São Paulo) que contém a data. */
export function monthRangeSP(d: Date) {
  const sp = new Date(d.getTime() - SP_OFFSET_MS)
  const start = new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), 1) + SP_OFFSET_MS)
  const end = new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth() + 1, 1) + SP_OFFSET_MS)
  return { start, end }
}

type CaseLike = {
  id: string
  dentistId: string
  caseNumber: number
  approvedAt?: Date | null
  checagem?: any
}

/**
 * Contexto de preço de um caso:
 * - quantos casos (Unidade/MID/FULL) o mesmo dentista teve APROVADOS antes deste no mesmo mês
 *   (base do desconto progressivo; casos ainda não aprovados contam como aprovados agora);
 * - quantidade de alinhadores (Unidade) vinda do planejamento 3D;
 * - taxa da Checagem 3D se aprovado mais de 30 dias após o envio para aprovação.
 */
export async function getPricingContext(prisma: PrismaClient, c: CaseLike) {
  const approvedAt = c.approvedAt ? new Date(c.approvedAt) : new Date()
  const { start } = monthRangeSP(approvedAt)
  const approvedBefore = await prisma.case.count({
    where: {
      dentistId: c.dentistId,
      id: { not: c.id },
      service: { is: { type: { in: PROGRESSIVE_TYPES } } },
      OR: [
        { approvedAt: { gte: start, lt: approvedAt } },
        { approvedAt: approvedAt, caseNumber: { lt: c.caseNumber } },
      ],
    },
  })

  let checagemFee = 0
  if (c.approvedAt) {
    const sent = await prisma.workflowEvent.findFirst({
      where: { caseId: c.id, stage: 4, createdAt: { lte: approvedAt } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    checagemFee = getChecagemFee(sent?.createdAt, approvedAt)
  }

  return { approvedBefore, quantity: getAlignerQuantity(c.checagem), checagemFee }
}
