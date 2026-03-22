import { FastifyInstance } from 'fastify'
import { authenticate, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'

function toCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: any) => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n')
}

export async function exportRoutes(fastify: FastifyInstance) {
  fastify.get('/cases', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { status, dentistId } = request.query as any
    const where: any = {}
    if (user.role === Role.DENTIST) where.dentistId = user.id
    else if (dentistId) where.dentistId = dentistId
    if (status) where.status = status

    const cases = await fastify.prisma.case.findMany({
      where,
      include: {
        dentist: { select: { name: true, clinic: true, cro: true, email: true } },
        service: { select: { name: true } },
        financial: { select: { invoiceNumber: true, billedAt: true, amount: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    })

    const rows = cases.map((c: any) => ({
      'Nº Caixa': String(c.caseNumber).padStart(6, '0'),
      'Paciente': c.patientName,
      'Dentista': c.dentist?.name || '',
      'Clínica': c.dentist?.clinic || '',
      'Serviço': c.service?.name || c.productType || '',
      'Status': c.status,
      'Tipo Faturamento': c.billingType || '',
      'Parcelas': c.installmentOption || '',
      'Seguro': c.dropoutInsurance ? 'Sim' : 'Não',
      'Pack Ativo': c.packActive ? 'Sim' : 'Não',
      'Cupom': c.discountCoupon || '',
      'TOTVS': c.totvsOrderId || '',
      'NF': c.financial?.invoiceNumber || '',
      'Criado Em': new Date(c.createdAt).toLocaleDateString('pt-BR'),
    }))

    const label = status ? `casos-${status}` : 'casos-todos'
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="${label}.csv"`)
    return reply.send('\uFEFF' + toCSV(rows))
  })

  fastify.get('/patients', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { dentistId } = request.query as any
    const where: any = {}
    if (user.role === Role.DENTIST) where.dentistId = user.id
    else if (dentistId) where.dentistId = dentistId

    const patients = await fastify.prisma.patient.findMany({
      where,
      include: {
        dentist: { select: { name: true, clinic: true } },
        _count: { select: { cases: true } },
      },
      orderBy: { name: 'asc' },
      take: 5000,
    })

    const rows = patients.map((p: any) => ({
      'Nome': p.name,
      'Sexo': p.gender === 'M' ? 'Masculino' : p.gender === 'F' ? 'Feminino' : '',
      'Data Nasc.': p.dob ? new Date(p.dob).toLocaleDateString('pt-BR') : '',
      'Dentista': p.dentist?.name || '',
      'Clínica': p.dentist?.clinic || '',
      'Ativo': p.active ? 'Sim' : 'Não',
      'Total Casos': p._count?.cases || 0,
      'Cadastrado Em': new Date(p.createdAt).toLocaleDateString('pt-BR'),
    }))

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="pacientes.csv"')
    return reply.send('\uFEFF' + toCSV(rows))
  })

  fastify.get('/clinical-records', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { patientId, dentistId, dateStart, dateEnd } = request.query as any
    const where: any = {}
    if (user.role === Role.DENTIST) where.dentistId = user.id
    else if (dentistId) where.dentistId = dentistId
    if (patientId) where.patientId = patientId
    if (dateStart || dateEnd) {
      where.consultationAt = {}
      if (dateStart) where.consultationAt.gte = new Date(dateStart)
      if (dateEnd) where.consultationAt.lte = new Date(dateEnd)
    }

    const records = await fastify.prisma.clinicalRecord.findMany({
      where,
      include: {
        patient: { select: { name: true } },
        dentist: { select: { name: true, clinic: true } },
      },
      orderBy: { consultationAt: 'desc' },
      take: 5000,
    })

    const rows = records.map((r: any) => ({
      'Data': new Date(r.consultationAt).toLocaleDateString('pt-BR'),
      'Paciente': r.patient?.name || '',
      'Dentista': r.dentist?.name || '',
      'Avaliação': r.evaluation,
      'Atividades': (r.activities || []).join(' | '),
      'Observações': r.observations || '',
    }))

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="fichas-clinicas.csv"')
    return reply.send('\uFEFF' + toCSV(rows))
  })
}
