import { FastifyInstance } from 'fastify'
import { authenticate, requireRole, JwtPayload } from '../../plugins/auth'
import { Role, CaseStatus, ApprovalVideoStatus, ApprovalDocStatus } from '@prisma/client'

export async function reportsRoutes(fastify: FastifyInstance) {
  
  // Relatório de casos enviados (expedição)
  fastify.get('/shipped', { preHandler: requireRole(Role.ADMIN, Role.FINANCIAL, Role.EXPEDITION) }, async (request, reply) => {
    const { startDate, endDate, groupBy = 'day' } = request.query as { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' }
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()
    
    const cases = await fastify.prisma.case.findMany({
      where: {
        status: CaseStatus.SHIPPED,
        production: {
          shippedAt: {
            gte: start,
            lte: end,
          },
        },
      },
      include: {
        dentist: { select: { id: true, name: true, clinic: true } },
        production: { select: { shippedAt: true, trackingCode: true, carrier: true } },
        patient: { select: { name: true } },
      },
      orderBy: { production: { shippedAt: 'desc' } },
    })
    
    // Agrupar por período
    const grouped = cases.reduce((acc, c) => {
      const date = c.production?.shippedAt
      if (!date) return acc
      
      let key: string
      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0]
      } else if (groupBy === 'week') {
        const week = getWeekNumber(date)
        key = `${date.getFullYear()}-W${week}`
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      }
      
      if (!acc[key]) acc[key] = { count: 0, cases: [] }
      acc[key].count++
      acc[key].cases.push(c)
      return acc
    }, {} as Record<string, { count: number; cases: any[] }>)
    
    return {
      total: cases.length,
      grouped,
      period: { start, end, groupBy },
    }
  })
  
  // Taxa de aprovação por dentista
  fastify.get('/approval-rates', { preHandler: requireRole(Role.ADMIN, Role.FINANCIAL) }, async (request, reply) => {
    const { startDate, endDate } = request.query as { startDate?: string; endDate?: string }
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()
    
    const dentists = await fastify.prisma.user.findMany({
      where: { role: Role.DENTIST },
      select: {
        id: true,
        name: true,
        clinic: true,
        _count: {
          select: {
            cases: {
              where: {
                createdAt: { gte: start, lte: end },
              },
            },
          },
        },
      },
    })
    
    const approvalStats = await Promise.all(
      dentists.map(async (d) => {
        const [total, approved, rejected, pending] = await Promise.all([
          fastify.prisma.case.count({
            where: { dentistId: d.id, createdAt: { gte: start, lte: end } },
          }),
          fastify.prisma.case.count({
            where: { dentistId: d.id, status: CaseStatus.APPROVED, createdAt: { gte: start, lte: end } },
          }),
          fastify.prisma.case.count({
            where: { dentistId: d.id, status: CaseStatus.REVISION_REQUESTED, createdAt: { gte: start, lte: end } },
          }),
          fastify.prisma.case.count({
            where: { dentistId: d.id, status: CaseStatus.WAITING_APPROVAL, createdAt: { gte: start, lte: end } },
          }),
        ])
        
        return {
          dentist: { id: d.id, name: d.name, clinic: d.clinic },
          total,
          approved,
          rejected,
          pending,
          approvalRate: total > 0 ? ((approved / total) * 100).toFixed(2) : '0.00',
        }
      })
    )
    
    return {
      dentists: approvalStats.filter(d => d.total > 0),
      period: { start, end },
    }
  })
  
  // Tempo médio de cada etapa do workflow
  fastify.get('/stage-times', { preHandler: requireRole(Role.ADMIN, Role.LAB_TECH) }, async (request, reply) => {
    const { startDate, endDate } = request.query as { startDate?: string; endDate?: string }
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()
    
    const events = await fastify.prisma.workflowEvent.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      include: {
        case: { select: { id: true, caseNumber: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    
    // Calcular tempo médio entre etapas
    const stageTimes: Record<string, { total: number; count: number; avg: number }> = {}
    
    const casesEvents = events.reduce((acc, e) => {
      if (!acc[e.caseId]) acc[e.caseId] = []
      acc[e.caseId].push(e)
      return acc
    }, {} as Record<string, typeof events>)
    
    Object.values(casesEvents).forEach((caseEvents: any[]) => {
      for (let i = 1; i < caseEvents.length; i++) {
        const prev = caseEvents[i - 1]
        const curr = caseEvents[i]
        const stageName = curr.stageName
        const diff = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime()
        const hours = diff / (1000 * 60 * 60)
        
        if (!stageTimes[stageName]) {
          stageTimes[stageName] = { total: 0, count: 0, avg: 0 }
        }
        stageTimes[stageName].total += hours
        stageTimes[stageName].count++
      }
    })
    
    // Calcular médias
    Object.keys(stageTimes).forEach((stage) => {
      const s = stageTimes[stage]
      s.avg = s.count > 0 ? s.total / s.count : 0
    })
    
    return {
      stages: stageTimes,
      period: { start, end },
    }
  })
  
  // Tracking de visualizações (vídeos e PDFs)
  fastify.get('/view-tracking', { preHandler: requireRole(Role.ADMIN, Role.LAB_TECH) }, async (request, reply) => {
    const { caseId } = request.query as { caseId?: string }
    
    const where: any = {}
    if (caseId) where.caseId = caseId
    
    const [videos, documents] = await Promise.all([
      fastify.prisma.caseApprovalVideo.findMany({
        where,
        include: {
          case: { select: { caseNumber: true, patient: { select: { name: true } } } },
          uploader: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      fastify.prisma.caseApprovalDocument.findMany({
        where,
        include: {
          case: { select: { caseNumber: true, patient: { select: { name: true } } } },
          uploader: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    
    return {
      videos: videos.map(v => ({
        ...v,
        viewed: v.status !== ApprovalVideoStatus.PENDING,
        downloaded: v.status === ApprovalVideoStatus.DOWNLOADED,
      })),
      documents: documents.map(d => ({
        ...d,
        viewed: d.status !== ApprovalDocStatus.PENDING,
        downloaded: d.status === ApprovalDocStatus.DOWNLOADED,
      })),
    }
  })
  
  // Exportar relatório (CSV/Excel)
  fastify.get('/export', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { type, startDate, endDate } = request.query as { type: 'shipped' | 'approvals' | 'stages'; startDate?: string; endDate?: string }
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()
    
    let data: any[] = []
    let filename = ''
    
    if (type === 'shipped') {
      filename = `casos-enviados-${start.toISOString().split('T')[0]}.csv`
      const cases = await fastify.prisma.case.findMany({
        where: {
          status: CaseStatus.SHIPPED,
          production: { shippedAt: { gte: start, lte: end } },
        },
        include: {
          dentist: { select: { name: true, clinic: true } },
          patient: { select: { name: true } },
          production: { select: { shippedAt: true, trackingCode: true, carrier: true } },
        },
      })
      
      data = cases.map(c => ({
        'Número do Caso': c.caseNumber,
        'Paciente': c.patient?.name,
        'Dentista': c.dentist?.name,
        'Clínica': c.dentist?.clinic,
        'Data de Envio': c.production?.shippedAt?.toISOString(),
        'Código de Rastreio': c.production?.trackingCode,
        'Transportadora': c.production?.carrier,
      }))
    }
    
    // Converter para CSV
    if (data.length === 0) {
      return reply.status(404).send({ error: 'Nenhum dado encontrado' })
    }
    
    const headers = Object.keys(data[0])
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(',')),
    ].join('\n')
    
    reply.header('Content-Type', 'text/csv')
    reply.header('Content-Disposition', `attachment; filename="${filename}"`)
    return csv
  })
}

// Helper para número da semana
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}