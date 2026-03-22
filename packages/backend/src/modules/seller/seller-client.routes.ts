import { FastifyInstance } from 'fastify'
import { requireRole, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'

export async function sellerClientRoutes(fastify: FastifyInstance) {
  // ADMIN: Listar vendedores (para escolher qual gerenciar)
  fastify.get('/', { preHandler: requireRole(Role.ADMIN) }, async (request) => {
    const { search } = request.query as { search?: string }

    const where: any = { role: Role.SELLER }
    if (search) {
      where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }]
    }

    const sellers = await fastify.prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
      take: 50,
    })

    return { sellers }
  })

  // VENDEDOR: Ver seus clientes
  fastify.get('/my-clients', { preHandler: requireRole(Role.SELLER) }, async (request) => {
    const user = request.user as JwtPayload
    const clients = await fastify.prisma.sellerClient.findMany({
      where: { sellerId: user.id },
      include: { client: { select: { id: true, name: true, email: true, clinic: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return { clients }
  })

  // ADMIN: Listar clientes de um vendedor
  fastify.get('/:sellerId/clients', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { sellerId } = request.params as { sellerId: string }
    const { search } = request.query as { search?: string }

    const where: any = { sellerId }
    if (search) {
      where.client = { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] }
    }

    const clients = await fastify.prisma.sellerClient.findMany({
      where,
      include: { client: { select: { id: true, name: true, email: true, clinic: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return { clients, total: clients.length }
  })

  // ADMIN: Adicionar cliente ao vendedor
  fastify.post('/:sellerId/clients', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { sellerId } = request.params as { sellerId: string }
    const { clientId } = request.body as { clientId: string }

    // Validar vendedor existe
    const seller = await fastify.prisma.user.findUnique({ where: { id: sellerId } })
    if (!seller || seller.role !== Role.SELLER) {
      return reply.status(404).send({ error: 'Vendedor não encontrado' })
    }

    // Validar cliente existe
    const client = await fastify.prisma.user.findUnique({ where: { id: clientId } })
    if (!client) {
      return reply.status(404).send({ error: 'Cliente não encontrado' })
    }

    // Verificar se já existe
    const existing = await fastify.prisma.sellerClient.findUnique({
      where: { sellerId_clientId: { sellerId, clientId } },
    })
    if (existing) {
      return reply.status(400).send({ error: 'Cliente já está vinculado a este vendedor' })
    }

    const sc = await fastify.prisma.sellerClient.create({
      data: { sellerId, clientId },
      include: { client: { select: { id: true, name: true, email: true } } },
    })

    return reply.status(201).send(sc)
  })

  // ADMIN: Remover cliente do vendedor
  fastify.delete('/:sellerId/clients/:clientId', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { sellerId, clientId } = request.params as { sellerId: string; clientId: string }

    const sc = await fastify.prisma.sellerClient.findUnique({
      where: { sellerId_clientId: { sellerId, clientId } },
    })

    if (!sc) {
      return reply.status(404).send({ error: 'Vínculo não encontrado' })
    }

    await fastify.prisma.sellerClient.delete({
      where: { sellerId_clientId: { sellerId, clientId } },
    })

    return { success: true }
  })
}

