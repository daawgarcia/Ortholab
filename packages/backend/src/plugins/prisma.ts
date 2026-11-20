import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { PrismaClient } from '@prisma/client'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}

const prismaPlugin: FastifyPluginAsync = fp(async (server) => {
  const prisma = new PrismaClient()
  // Quando um caso vira APROVADO por qualquer rota, grava a data de aprovação
  // (usada no desconto progressivo do mês e na taxa da Checagem 3D após 30 dias).
  prisma.$use(async (params, next) => {
    if (params.model === 'Case' && (params.action === 'update' || params.action === 'updateMany')) {
      const data = params.args?.data
      if (data && data.status === 'APPROVED' && data.approvedAt === undefined) data.approvedAt = new Date()
    }
    return next(params)
  })
  await prisma.$connect()
  server.decorate('prisma', prisma)
  server.addHook('onClose', async (server) => {
    await server.prisma.$disconnect()
  })
})

export { prismaPlugin }
