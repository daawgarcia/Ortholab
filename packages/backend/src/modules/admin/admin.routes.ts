import { FastifyInstance } from 'fastify'
import { requireRole, JwtPayload } from '../../plugins/auth'
import { Role, UserStatus } from '@prisma/client'
import ExcelJS from 'exceljs'

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.post('/users', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const bcrypt = require('bcryptjs')
    const { name, email, password, role, cro, clinic, cnpj, phone, address, city, state, zipCode, firstCaseCouponEligible } = request.body as any

    const existing = await fastify.prisma.user.findUnique({ where: { email } })
    if (existing) return reply.status(400).send({ error: 'E-mail já cadastrado' })

    const hash = await bcrypt.hash(password, 12)
    const user = await fastify.prisma.user.create({
      data: {
        name,
        email,
        password: hash,
        role: role || 'DENTIST',
        status: 'ACTIVE',
        emailVerified: true,
        cro,
        clinic,
        cnpj,
        phone,
        address,
        city,
        state,
        zipCode,
        firstCaseCouponEligible: role === 'DENTIST' ? Boolean(firstCaseCouponEligible) : false,
      },
      select: { id: true, name: true, email: true, role: true, status: true, firstCaseCouponEligible: true },
    })
    return reply.status(201).send({ user })
  })

  fastify.get('/users', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { role, status, search, page = '1', limit = '20' } = request.query as any
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = {}
    
    // Support multiple roles separated by comma
    if (role) {
      const roles = role.split(',').map((r: string) => r.trim())
      if (roles.length > 1) {
        where.role = { in: roles }
      } else {
        where.role = roles[0]
      }
    }
    
    if (status) where.status = status
    if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }]

    const [users, total] = await Promise.all([
      fastify.prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, role: true, status: true, cro: true, clinic: true, phone: true, createdAt: true, firstCaseCouponEligible: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      fastify.prisma.user.count({ where }),
    ])
    return { users, total }
  })

  fastify.patch('/users/:id/status', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: UserStatus }
    const user = await fastify.prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, name: true, email: true, status: true },
    })
    return { user }
  })

  fastify.patch('/users/:id/role', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { id } = request.params as { id: string }
    const { role } = request.body as { role: Role }
    const user = await fastify.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    })
    return { user }
  })

  fastify.patch('/users/:id/first-case-coupon', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { firstCaseCouponEligible } = request.body as { firstCaseCouponEligible: boolean }

    const currentUser = await fastify.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })

    if (!currentUser) return reply.status(404).send({ error: 'Usuário não encontrado' })
    if (currentUser.role !== Role.DENTIST) return reply.status(400).send({ error: 'Benefício disponível apenas para dentistas' })

    const user = await fastify.prisma.user.update({
      where: { id },
      data: { firstCaseCouponEligible: Boolean(firstCaseCouponEligible) },
      select: { id: true, name: true, email: true, firstCaseCouponEligible: true },
    })

    return { user }
  })

  fastify.post('/impersonate/:userId', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const user = await fastify.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, status: true },
    })
    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado' })
    if (user.status !== UserStatus.ACTIVE) return reply.status(400).send({ error: 'Usuário inativo' })

    const payload = { id: user.id, email: user.email, role: user.role, name: user.name }
    const accessToken = fastify.jwt.sign(payload, { expiresIn: '2h' })
    return { accessToken, user: payload, impersonated: true }
  })

  fastify.get('/stats', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { period } = request.query as { period?: string }

    let dateFilter: any = undefined
    const now = new Date()
    if (period === 'day') {
      const start = new Date(now); start.setHours(0, 0, 0, 0)
      dateFilter = { gte: start }
    } else if (period === 'week') {
      const start = new Date(now); start.setDate(now.getDate() - 7); start.setHours(0, 0, 0, 0)
      dateFilter = { gte: start }
    } else if (period === 'month') {
      const start = new Date(now); start.setDate(1); start.setHours(0, 0, 0, 0)
      dateFilter = { gte: start }
    }

    const caseWhere: any = dateFilter ? { createdAt: dateFilter } : {}
    // Count patients who have at least one case in the period (not just new registrations)
    const patientWhere: any = dateFilter
      ? { cases: { some: { createdAt: dateFilter } } }
      : {}
    // For 'all', only count records that were actually billed (billedAt not null)
    const billedWhere: any = dateFilter
      ? { billedAt: dateFilter }
      : { billedAt: { not: null } }

    const [totalCases, totalPatients, totalUsers, pendingUsers, casesByStatus, billedCases, billedAmountAggregate] = await Promise.all([
      fastify.prisma.case.count({ where: caseWhere }),
      fastify.prisma.patient.count({ where: patientWhere }),
      fastify.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      fastify.prisma.user.count({ where: { status: UserStatus.PENDING } }),
      fastify.prisma.case.groupBy({ by: ['status'], where: caseWhere, _count: { _all: true } }),
      fastify.prisma.financial.count({ where: billedWhere }),
      fastify.prisma.financial.aggregate({ where: billedWhere, _sum: { amount: true } }),
    ])

    return {
      totalCases,
      totalPatients,
      totalUsers,
      pendingUsers,
      casesByStatus,
      billedCases,
      billedAmount: Number(billedAmountAggregate._sum.amount || 0),
    }
  })

  fastify.get('/dentists', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { search } = request.query as any
    const where: any = { role: Role.DENTIST, status: UserStatus.ACTIVE }
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { clinic: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
    const dentists = await fastify.prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, clinic: true, cro: true },
      orderBy: { name: 'asc' },
      take: 20,
    })
    return { dentists }
  })

  fastify.get('/coupons', { preHandler: requireRole(Role.ADMIN) }, async () => {
    const coupons = await fastify.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } })
    return { coupons }
  })

  fastify.get('/coupons/report', { preHandler: requireRole(Role.ADMIN) }, async () => {
    const cases = await fastify.prisma.case.findMany({
      where: { discountCoupon: { not: null } },
      select: {
        id: true,
        caseNumber: true,
        discountCoupon: true,
        status: true,
        createdAt: true,
        dentist: { select: { id: true, name: true, clinic: true, email: true } },
        service: { select: { name: true, type: true } },
        financial: { select: { billedAt: true, amount: true, invoiceNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const usageByCoupon = new Map<string, { code: string; totalUses: number; dentists: Set<string> }>()
    for (const item of cases) {
      const code = item.discountCoupon || ''
      if (!code) continue
      const existing = usageByCoupon.get(code) || { code, totalUses: 0, dentists: new Set<string>() }
      existing.totalUses += 1
      if (item.dentist?.id) existing.dentists.add(item.dentist.id)
      usageByCoupon.set(code, existing)
    }

    return {
      usages: cases,
      summary: Array.from(usageByCoupon.values()).map((item) => ({
        code: item.code,
        totalUses: item.totalUses,
        uniqueDentists: item.dentists.size,
      })),
    }
  })

  fastify.get('/coupons/report.xlsx', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const cases = await fastify.prisma.case.findMany({
      where: { discountCoupon: { not: null } },
      select: {
        id: true,
        caseNumber: true,
        discountCoupon: true,
        status: true,
        createdAt: true,
        dentist: { select: { id: true, name: true, clinic: true, email: true } },
        service: { select: { name: true, type: true } },
        financial: { select: { billedAt: true, amount: true, invoiceNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const workbook = new ExcelJS.Workbook()
    const summarySheet = workbook.addWorksheet('Resumo')
    const usagesSheet = workbook.addWorksheet('Usos')

    const usageByCoupon = new Map<string, { code: string; totalUses: number; dentists: Set<string> }>()
    for (const item of cases) {
      const code = item.discountCoupon || ''
      if (!code) continue
      const existing = usageByCoupon.get(code) || { code, totalUses: 0, dentists: new Set<string>() }
      existing.totalUses += 1
      if (item.dentist?.id) existing.dentists.add(item.dentist.id)
      usageByCoupon.set(code, existing)
    }

    const summaryRows = Array.from(usageByCoupon.values())
      .sort((a, b) => b.totalUses - a.totalUses)
      .map((item) => ({
        Cupom: item.code,
        'Total de usos': item.totalUses,
        'Dentistas únicos': item.dentists.size,
      }))

    summarySheet.columns = [
      { header: 'Cupom', key: 'Cupom', width: 24 },
      { header: 'Total de usos', key: 'Total de usos', width: 18 },
      { header: 'Dentistas únicos', key: 'Dentistas únicos', width: 20 },
    ]
    summaryRows.forEach((row) => summarySheet.addRow(row))

    usagesSheet.columns = [
      { header: 'Cupom', key: 'Cupom', width: 18 },
      { header: 'Caso', key: 'Caso', width: 10 },
      { header: 'Status', key: 'Status', width: 20 },
      { header: 'Dentista', key: 'Dentista', width: 28 },
      { header: 'Clínica', key: 'Clínica', width: 30 },
      { header: 'Email Dentista', key: 'Email Dentista', width: 34 },
      { header: 'Serviço', key: 'Serviço', width: 24 },
      { header: 'NF', key: 'NF', width: 18 },
      { header: 'Valor Faturado', key: 'Valor Faturado', width: 18 },
      { header: 'Data Referência', key: 'Data Referência', width: 16 },
    ]

    cases.forEach((item) => {
      usagesSheet.addRow({
        Cupom: item.discountCoupon || '',
        Caso: item.caseNumber,
        Status: item.status,
        Dentista: item.dentist?.name || '',
        'Clínica': item.dentist?.clinic || '',
        'Email Dentista': item.dentist?.email || '',
        'Serviço': item.service?.name || item.service?.type || '',
        NF: item.financial?.invoiceNumber || '',
        'Valor Faturado': item.financial?.amount ?? '',
        'Data Referência': new Date(item.financial?.billedAt || item.createdAt).toLocaleDateString('pt-BR'),
      })
    })

    summarySheet.getRow(1).font = { bold: true }
    usagesSheet.getRow(1).font = { bold: true }
    summarySheet.views = [{ state: 'frozen', ySplit: 1 }]
    usagesSheet.views = [{ state: 'frozen', ySplit: 1 }]

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    reply.header('Content-Disposition', 'attachment; filename="relatorio-uso-cupons.xlsx"')

    const buffer = await workbook.xlsx.writeBuffer()
    return reply.send(Buffer.from(buffer))
  })

  fastify.post('/coupons', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { code, description, type, value, active } = request.body as any
    const normalizedCode = String(code || '').trim().toUpperCase()
    if (!normalizedCode || !type || value === undefined) return reply.status(400).send({ error: 'code, type e value são obrigatórios' })

    const existing = await fastify.prisma.coupon.findUnique({ where: { code: normalizedCode } })
    if (existing) return reply.status(400).send({ error: 'Cupom já existe' })

    const coupon = await fastify.prisma.coupon.create({ data: { code: normalizedCode, description, type, value: Number(value), active: active ?? true } })
    return reply.status(201).send({ coupon })
  })

  fastify.patch('/coupons/:id', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { id } = request.params as { id: string }
    const { code, description, type, value, active } = request.body as any
    const normalizedCode = code !== undefined ? String(code).trim().toUpperCase() : undefined
    const coupon = await fastify.prisma.coupon.update({
      where: { id },
      data: { code: normalizedCode, description, type, value: value !== undefined ? Number(value) : undefined, active },
    })
    return { coupon }
  })

  fastify.delete('/coupons/:id', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { id } = request.params as { id: string }
    await fastify.prisma.coupon.delete({ where: { id } })
    return { ok: true }
  })
}
