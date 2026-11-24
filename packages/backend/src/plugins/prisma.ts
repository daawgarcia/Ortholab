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
    // Aprovação: as rotas levam o caso para APPROVED ou direto para PRINTING_3D
    if (params.model === 'Case' && params.action === 'update') {
      const data = params.args?.data
      const id = params.args?.where?.id
      if (data && id && (data.status === 'APPROVED' || data.status === 'PRINTING_3D') && data.approvedAt === undefined) {
        const atual = await prisma.case.findUnique({ where: { id }, select: { approvedAt: true } })
        if (atual && !atual.approvedAt) {
          data.approvedAt = new Date()
          // igual ao Ortholab 1: aprovou para produção, entra em "casos a faturar"
          if (data.faturamentoPendente === undefined) {
            data.faturamentoPendente = true
            data.faturamentoDesde = data.approvedAt
          }
        }
      }
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
