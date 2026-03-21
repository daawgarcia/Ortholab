import { FastifyInstance } from 'fastify'
import { requireRole } from '../../plugins/auth'
import { Role } from '@prisma/client'
import ExcelJS from 'exceljs'

export async function exportRoutes(fastify: FastifyInstance) {
  fastify.get('/cases', { preHandler: requireRole(Role.ADMIN, Role.LAB_TECH, Role.FINANCIAL) }, async (request, reply) => {
    const { status, startDate, endDate } = request.query as any
    const where: any = {}
    if (status) where.status = status
    if (startDate || endDate) where.createdAt = { ...(startDate && { gte: new Date(startDate) }), ...(endDate && { lte: new Date(endDate) }) }

    const cases = await fastify.prisma.case.findMany({
      where,
      include: { dentist: { select: { name: true, clinic: true, cnpj: true, email: true, cro: true } }, service: true, payment: true, financial: true },
      orderBy: { createdAt: 'desc' },
    })

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Casos')

    ws.columns = [
      { header: 'Nº Caso', key: 'caseNumber', width: 12 },
      { header: 'Paciente', key: 'patientName', width: 25 },
      { header: 'Dentista', key: 'dentist', width: 25 },
      { header: 'Clínica', key: 'clinic', width: 25 },
      { header: 'CNPJ', key: 'cnpj', width: 18 },
      { header: 'CRO', key: 'cro', width: 12 },
      { header: 'Serviço', key: 'service', width: 20 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Valor', key: 'amount', width: 14 },
      { header: 'Pgto Status', key: 'paymentStatus', width: 14 },
      { header: 'NF', key: 'invoiceNumber', width: 16 },
      { header: 'Data Criação', key: 'createdAt', width: 18 },
      { header: 'Última Atualização', key: 'updatedAt', width: 20 },
    ]

    ws.getRow(1).font = { bold: true }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } }
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

    cases.forEach(c => {
      ws.addRow({
        caseNumber: c.caseNumber,
        patientName: c.patientName,
        dentist: c.dentist?.name,
        clinic: c.dentist?.clinic,
        cnpj: c.dentist?.cnpj,
        cro: c.dentist?.cro,
        service: (c as any).service?.name,
        status: c.status,
        amount: c.financial?.amount || c.payment?.amount || null,
        paymentStatus: c.payment?.status || '-',
        invoiceNumber: c.financial?.invoiceNumber || '-',
        createdAt: c.createdAt.toLocaleDateString('pt-BR'),
        updatedAt: c.updatedAt.toLocaleDateString('pt-BR'),
      })
    })

    const date = new Date().toISOString().split('T')[0]
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    reply.header('Content-Disposition', `attachment; filename="casos_${date}.xlsx"`)

    const buffer = await wb.xlsx.writeBuffer()
    return reply.send(buffer)
  })
}
