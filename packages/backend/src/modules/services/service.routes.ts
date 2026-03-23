import { FastifyInstance } from 'fastify'
import { authenticate, requireRole } from '../../plugins/auth'
import { Role } from '@prisma/client'

const PRICE_GROUPS = {
  cash: 'CASH',
  installment2: 'INSTALLMENT_2',
  installment6: 'INSTALLMENT_6',
  installment12: 'INSTALLMENT_12',
  installment21: 'INSTALLMENT_21',
} as const

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function extractLatestPrices(prices: Array<{ price: any; groupId: string | null }>) {
  const latest = {
    cash: undefined as number | undefined,
    installment2: undefined as number | undefined,
    installment6: undefined as number | undefined,
    installment12: undefined as number | undefined,
    installment21: undefined as number | undefined,
  }

  for (const price of prices) {
    const amount = Number(price.price)
    if (price.groupId === PRICE_GROUPS.installment2 && latest.installment2 === undefined) latest.installment2 = amount
    if (price.groupId === PRICE_GROUPS.installment6 && latest.installment6 === undefined) latest.installment6 = amount
    if (price.groupId === PRICE_GROUPS.installment12 && latest.installment12 === undefined) latest.installment12 = amount
    if (price.groupId === PRICE_GROUPS.installment21 && latest.installment21 === undefined) latest.installment21 = amount
    if ((!price.groupId || price.groupId === PRICE_GROUPS.cash) && latest.cash === undefined) latest.cash = amount
  }

  return latest
}

async function createPriceRecords(fastify: FastifyInstance, serviceId: string, type: string, pricing: Record<string, unknown>) {
  const cash = toNumber(pricing.cash ?? pricing.price)
  const installment2 = toNumber(pricing.installment2)
  const installment6 = toNumber(pricing.installment6)
  const installment12 = toNumber(pricing.installment12)
  const installment21 = toNumber(pricing.installment21)

  if (type === 'AIR') {
    if (installment6 !== undefined || installment12 !== undefined || installment21 !== undefined) {
      throw new Error('EA AIR² aceita apenas à vista ou 2x')
    }
  }

  if (type !== 'FULL' && installment21 !== undefined) {
    throw new Error('Apenas pacote FULL pode ser parcelado em 21x')
  }

  if (type !== 'AIR' && installment2 !== undefined) {
    throw new Error('Parcelamento em 2x é exclusivo do EA AIR²')
  }

  const rows = [
    cash !== undefined ? { serviceId, price: cash, groupId: PRICE_GROUPS.cash } : null,
    type === 'AIR' && installment2 !== undefined ? { serviceId, price: installment2, groupId: PRICE_GROUPS.installment2 } : null,
    installment6 !== undefined ? { serviceId, price: installment6, groupId: PRICE_GROUPS.installment6 } : null,
    installment12 !== undefined ? { serviceId, price: installment12, groupId: PRICE_GROUPS.installment12 } : null,
    type === 'FULL' && installment21 !== undefined ? { serviceId, price: installment21, groupId: PRICE_GROUPS.installment21 } : null,
  ].filter(Boolean) as Array<{ serviceId: string; price: number; groupId: string }>

  if (rows.length > 0) {
    await fastify.prisma.price.createMany({ data: rows })
  }
}

function presentService(service: any) {
  const latestPrices = extractLatestPrices(service.prices || [])
  const cashPrice = latestPrices.cash

  return {
    ...service,
    latestPrices: {
      ...latestPrices,
      installment2: service.type === 'AIR' ? latestPrices.installment2 : undefined,
      installment6: service.type === 'AIR' ? undefined : latestPrices.installment6,
      installment12: service.type === 'AIR' ? undefined : latestPrices.installment12,
      installment21: service.type === 'FULL' ? latestPrices.installment21 : undefined,
    },
    prices: cashPrice !== undefined ? [{ price: cashPrice }] : [],
  }
}

export async function serviceRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: authenticate }, async () => {
    const services = await fastify.prisma.service.findMany({
      where: { active: true },
      include: { prices: { orderBy: { validFrom: 'desc' } } },
      orderBy: { name: 'asc' },
    })
    return { services: services.map(presentService) }
  })

  fastify.post('/', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { name, description, type, productionDays, maxRevisions, price, prices } = request.body as any
    const service = await fastify.prisma.service.create({ data: { name, description, type, productionDays, maxRevisions } })

    try {
      await createPriceRecords(fastify, service.id, type, { ...(prices || {}), price })
    } catch (error: any) {
      await fastify.prisma.service.delete({ where: { id: service.id } })
      return reply.status(400).send({ error: error.message })
    }

    const fullService = await fastify.prisma.service.findUnique({
      where: { id: service.id },
      include: { prices: { orderBy: { validFrom: 'desc' } } },
    })

    return reply.status(201).send({ service: presentService(fullService) })
  })

  fastify.patch('/:id', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { price, prices, ...data } = request.body as any
    const service = await fastify.prisma.service.update({ where: { id }, data })

    try {
      await createPriceRecords(fastify, id, service.type, { ...(prices || {}), price })
    } catch (error: any) {
      return reply.status(400).send({ error: error.message })
    }

    const fullService = await fastify.prisma.service.findUnique({
      where: { id },
      include: { prices: { orderBy: { validFrom: 'desc' } } },
    })

    return { service: presentService(fullService) }
  })

  fastify.delete('/:id', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { id } = request.params as { id: string }
    await fastify.prisma.service.update({ where: { id }, data: { active: false } })
    return { success: true }
  })
}
