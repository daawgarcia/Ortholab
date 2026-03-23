import { FastifyInstance } from 'fastify'
import { authenticate, requireRole, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'

async function getPendingPushes(fastify: FastifyInstance, user: JwtPayload) {
  return fastify.prisma.pushNotification.findMany({
    where: {
      AND: [
        { OR: [
          { targetType: 'ALL' },
          { targetType: 'ROLE', targetId: user.role },
          { targetType: 'USER', targetId: user.id },
          { targetType: 'SELLER_PORTFOLIO', createdBy: { sellerClients: { some: { clientId: user.id } } } },
        ]},
        { reads: { none: { userId: user.id } } },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      ]
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function pushRoutes(fastify: FastifyInstance) {
  fastify.get('/pending', { preHandler: authenticate }, async (request) => {
    const user = request.user as JwtPayload
    const pushes = await getPendingPushes(fastify, user)
    return { pendingPushes: pushes }
  })

  fastify.post('/', { preHandler: requireRole(Role.ADMIN, Role.SELLER) }, async (request, reply) => {
    const { title, body, link, level, targetType, targetId, expiresAt } = request.body as any
    const creator = request.user as JwtPayload

    if (creator.role === Role.SELLER && targetType !== 'SELLER_PORTFOLIO' && targetType !== 'USER') {
      return reply.status(403).send({ error: 'Vendedor só pode enviar push para sua carteira' })
    }

    const push = await fastify.prisma.pushNotification.create({
      data: { createdById: creator.id, title, body, link, level: level || 'INFO', targetType, targetId, expiresAt: expiresAt ? new Date(expiresAt) : undefined },
    })

    // Also create Notification records so push appears in the bell icon
    let userIds: string[] = []
    if (targetType === 'ALL') {
      const users = await fastify.prisma.user.findMany({ select: { id: true } })
      userIds = users.map((u: any) => u.id)
    } else if (targetType === 'ROLE') {
      const users = await fastify.prisma.user.findMany({ where: { role: targetId as Role }, select: { id: true } })
      userIds = users.map((u: any) => u.id)
    } else if (targetType === 'USER') {
      userIds = [targetId]
    } else if (targetType === 'SELLER_PORTFOLIO') {
      const clients = await fastify.prisma.sellerClient.findMany({ where: { sellerId: creator.id }, select: { clientId: true } })
      userIds = clients.map((c: any) => c.clientId)
    }

    if (userIds.length > 0) {
      await fastify.prisma.notification.createMany({
        data: userIds.map(userId => ({
          userId,
          title,
          message: body,
          link: link || null,
        })),
        skipDuplicates: true,
      })
    }

    return reply.status(201).send({ push })
  })

  fastify.get('/', { preHandler: requireRole(Role.ADMIN, Role.SELLER) }, async (request) => {
    const where = (request.user as JwtPayload).role === Role.SELLER ? { createdById: (request.user as JwtPayload).id } : {}
    const pushes = await fastify.prisma.pushNotification.findMany({
      where,
      include: { _count: { select: { reads: true } }, createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return { pushes }
  })

  fastify.post('/:id/read', { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string }
    await fastify.prisma.pushRead.upsert({
      where: { pushId_userId: { pushId: id, userId: (request.user as JwtPayload).id } },
      update: {},
      create: { pushId: id, userId: (request.user as JwtPayload).id },
    })
    return { success: true }
  })

  // Send push to a list of emails uploaded via CSV
  fastify.post('/send-csv', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })

    const { title, body, link, level } = request.query as { title?: string; body?: string; link?: string; level?: string }
    if (!title || !body) return reply.status(400).send({ error: 'title e body são obrigatórios (query params)' })

    const buffer = await data.toBuffer()
    const text = buffer.toString('utf-8')

    // Parse CSV: find email column (header row first)
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return reply.status(400).send({ error: 'Planilha precisa ter pelo menos cabeçalho e 1 linha' })

    const headers = lines[0].split(/[,;\t]/).map(h => h.trim().toLowerCase().replace(/"/g, ''))
    const emailCol = headers.findIndex(h => h.includes('email') || h === 'e-mail')
    if (emailCol === -1) return reply.status(400).send({ error: 'Coluna "email" não encontrada no cabeçalho' })

    const emails = lines.slice(1).map(line => {
      const cols = line.split(/[,;\t]/).map(c => c.trim().replace(/"/g, ''))
      return cols[emailCol]?.toLowerCase()
    }).filter(Boolean) as string[]

    const uniqueEmails = [...new Set(emails)]

    // Find matching users
    const users = await fastify.prisma.user.findMany({
      where: { email: { in: uniqueEmails } },
      select: { id: true, email: true, name: true },
    })

    const foundEmails = new Set(users.map((u: any) => u.email.toLowerCase()))
    const notFound = uniqueEmails.filter(e => !foundEmails.has(e))

    if (users.length === 0) {
      return reply.status(404).send({ error: 'Nenhum usuário encontrado com os emails fornecidos', notFound })
    }

    const creator = request.user as JwtPayload
    const push = await fastify.prisma.pushNotification.create({
      data: {
        createdById: creator.id,
        title,
        body,
        link: link || null,
        level: (level as any) || 'INFO',
        targetType: 'USER',
        targetId: null,
      },
    })

    await fastify.prisma.notification.createMany({
      data: users.map((u: any) => ({ userId: u.id, title, message: body, link: link || null })),
      skipDuplicates: true,
    })

    return reply.status(201).send({
      push,
      matched: users.map((u: any) => ({ email: u.email, name: u.name })),
      notFound,
    })
  })
}
