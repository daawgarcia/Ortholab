import { FastifyInstance } from 'fastify'
import { Role, CaseStatus, PushLevel } from '@prisma/client'

const STALLED_DAYS = 2
const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hora

interface StalledCase {
  id: string
  caseNumber: number
  patientName: string
  status: CaseStatus
  dentistId: string
  lastEventDate: Date | null
  stageName: string | null
}

export function startStalledCasesJob(fastify: FastifyInstance) {
  // Verificar casos parados imediatamente ao iniciar
  checkStalledCases(fastify)

  // Agendar verificação periódica
  const interval = setInterval(() => {
    checkStalledCases(fastify)
  }, CHECK_INTERVAL_MS)

  // Retornar função para parar o job se necessário
  return () => clearInterval(interval)
}

async function checkStalledCases(fastify: FastifyInstance) {
  try {
    const cutoffDate = new Date(Date.now() - STALLED_DAYS * 24 * 60 * 60 * 1000)

    // Buscar casos que estão parados há mais de 2 dias
    const stalledCases = await fastify.prisma.$queryRaw<StalledCase[]>`
      SELECT 
        c.id,
        c."caseNumber",
        c."patientName",
        c.status,
        c."dentistId",
        we."createdAt" as "lastEventDate",
        we."stageName"
      FROM "Case" c
      LEFT JOIN "WorkflowEvent" we ON we."caseId" = c.id
      AND we."createdAt" = (
        SELECT MAX("createdAt") 
        FROM "WorkflowEvent" 
        WHERE "caseId" = c.id
      )
      WHERE c.status NOT IN ('COMPLETED', 'SHIPPED', 'DRAFT')
      AND (
        we."createdAt" IS NULL 
        OR we."createdAt" < ${cutoffDate}
      )
      ORDER BY c."createdAt" ASC
    `

    if (stalledCases.length === 0) return

    // Agrupar casos por dentista
    const casesByDentist = stalledCases.reduce((acc, c) => {
      if (!acc[c.dentistId]) acc[c.dentistId] = []
      acc[c.dentistId].push(c)
      return acc
    }, {} as Record<string, StalledCase[]>)

    // Buscar usuários internos que devem receber notificação
    const [admins, labTechs] = await Promise.all([
      fastify.prisma.user.findMany({
        where: { role: Role.ADMIN, status: 'ACTIVE' as any },
        select: { id: true },
      }),
      fastify.prisma.user.findMany({
        where: { role: Role.LAB_TECH, status: 'ACTIVE' as any },
        select: { id: true },
      }),
    ])

    const internalUserIds = [
      ...admins.map(u => u.id),
      ...labTechs.map(u => u.id),
    ]

    // Criar notificações PUSH para cada grupo
    for (const [dentistId, cases] of Object.entries(casesByDentist)) {
      const caseList = cases.slice(0, 5).map(c => `#${String(c.caseNumber).padStart(6, '0')} - ${c.patientName}`).join(', ')
      const moreCount = cases.length > 5 ? ` e mais ${cases.length - 5} caso(s)` : ''

      // Notificar usuários internos
      if (internalUserIds.length > 0) {
        await fastify.prisma.pushNotification.create({
          data: {
            createdById: 'system',
            title: `⚠️ Casos parados há mais de ${STALLED_DAYS} dias`,
            body: `${cases.length} caso(s) estão parados: ${caseList}${moreCount}`,
            level: PushLevel.WARNING,
            targetType: 'ROLE',
            targetId: `${Role.ADMIN},${Role.LAB_TECH}`,
            link: '/workflow/planning-center',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expira em 24h
          },
        })
      }

      // Log para debug
      console.log(`[StalledCasesJob] ${cases.length} casos parados para dentista ${dentistId}`)
    }

    console.log(`[StalledCasesJob] Verificação concluída. ${stalledCases.length} casos parados encontrados.`)
  } catch (error) {
    console.error('[StalledCasesJob] Erro ao verificar casos parados:', error)
  }
}

// Endpoint para verificar manualmente (admin only)
export async function stalledCasesRoutes(fastify: FastifyInstance) {
  fastify.get('/check-stalled', { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = request.user as any
    if (user.role !== Role.ADMIN && user.role !== Role.LAB_TECH) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }

    const cutoffDate = new Date(Date.now() - STALLED_DAYS * 24 * 60 * 60 * 1000)

    const stalledCases = await fastify.prisma.$queryRaw`
      SELECT 
        c.id,
        c."caseNumber",
        c."patientName",
        c.status,
        c."dentistId",
        we."createdAt" as "lastEventDate",
        we."stageName",
        d.name as "dentistName"
      FROM "Case" c
      LEFT JOIN "WorkflowEvent" we ON we."caseId" = c.id
      AND we."createdAt" = (
        SELECT MAX("createdAt") 
        FROM "WorkflowEvent" 
        WHERE "caseId" = c.id
      )
      LEFT JOIN "User" d ON d.id = c."dentistId"
      WHERE c.status NOT IN ('COMPLETED', 'SHIPPED', 'DRAFT')
      AND (
        we."createdAt" IS NULL 
        OR we."createdAt" < ${cutoffDate}
      )
      ORDER BY we."createdAt" ASC NULLS FIRST
    `

    return { 
      stalledCases,
      total: stalledCases.length,
      thresholdDays: STALLED_DAYS,
      checkedAt: new Date().toISOString(),
    }
  })
}