import { FastifyInstance } from 'fastify'
import { authenticate, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'

export async function chatRoutes(fastify: FastifyInstance, opts: { wsClients: Map<string, any> }) {
  const wsClients = opts.wsClients

  // Returns contact list based on role, with online status
  fastify.get('/contacts', { preHandler: authenticate }, async (request) => {
    const user = request.user as JwtPayload

    let contacts: any[] = []

    if (user.role === Role.SELLER) {
      // Seller sees their dentist clients
      const sellerClients = await fastify.prisma.sellerClient.findMany({
        where: { sellerId: user.id },
        include: { client: { select: { id: true, name: true, email: true, role: true, clinic: true } } },
      })
      contacts = sellerClients.map(sc => sc.client)
    } else if (user.role === Role.DENTIST) {
      // Dentist sees their seller(s) + all financial users
      const [sellerLinks, financials] = await Promise.all([
        fastify.prisma.sellerClient.findMany({
          where: { clientId: user.id },
          include: { seller: { select: { id: true, name: true, email: true, role: true } } },
        }),
        fastify.prisma.user.findMany({
          where: { role: Role.FINANCIAL },
          select: { id: true, name: true, email: true, role: true },
        }),
      ])
      contacts = [...sellerLinks.map(sl => sl.seller), ...financials]
    } else {
      // Admin/Financial/others see all active users except themselves
      contacts = await fastify.prisma.user.findMany({
        where: { id: { not: user.id } },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' },
        take: 100,
      })
    }

    // Attach online status
    return {
      contacts: contacts.map(c => ({
        ...c,
        online: wsClients.has(c.id),
      })),
    }
  })

  fastify.get('/conversations', { preHandler: authenticate }, async (request) => {
    const user = request.user as JwtPayload

    const messages = await fastify.prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: user.id },
          { receiverId: user.id },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, email: true, role: true } },
        receiver: { select: { id: true, name: true, email: true, role: true } },
      },
    })

    const conversationMap = new Map<string, any>()

    for (const msg of messages) {
      const peer = msg.senderId === user.id ? msg.receiver : msg.sender
      if (!conversationMap.has(peer.id)) {
        conversationMap.set(peer.id, {
          peer,
          lastMessage: msg.content,
          lastAt: msg.createdAt,
          unread: 0,
        })
      }
      const entry = conversationMap.get(peer.id)
      if (msg.receiverId === user.id && !msg.read) {
        entry.unread += 1
      }
    }

    return { conversations: Array.from(conversationMap.values()) }
  })

  fastify.get('/messages/:peerId', { preHandler: authenticate }, async (request) => {
    const user = request.user as JwtPayload
    const { peerId } = request.params as { peerId: string }

    const messages = await fastify.prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: user.id, receiverId: peerId },
          { senderId: peerId, receiverId: user.id },
        ],
      },
      orderBy: { createdAt: 'asc' },
    })

    await fastify.prisma.chatMessage.updateMany({
      where: { senderId: peerId, receiverId: user.id, read: false },
      data: { read: true },
    })

    return { messages }
  })

  fastify.post('/messages/:peerId', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { peerId } = request.params as { peerId: string }
    const { content } = request.body as { content: string }

    if (!content || !content.trim()) {
      return reply.status(400).send({ error: 'Conteúdo da mensagem não pode ser vazio' })
    }

    const peer = await fastify.prisma.user.findUnique({ where: { id: peerId } })
    if (!peer) {
      return reply.status(404).send({ error: 'Usuário não encontrado' })
    }

    const message = await fastify.prisma.chatMessage.create({
      data: {
        senderId: user.id,
        receiverId: peerId,
        content,
      },
    })

    const userData = { id: user.id, name: user.name, role: user.role }
    const payload = JSON.stringify({ type: 'message', message: { ...message, sender: userData, receiver: { id: peer.id, name: peer.name, role: peer.role } } })

    const peerSocket = wsClients.get(peerId)
    if (peerSocket && peerSocket.readyState === 1) {
      peerSocket.send(payload)
    }

    const senderSocket = wsClients.get(user.id)
    if (senderSocket && senderSocket.readyState === 1) {
      senderSocket.send(payload)
    }

    return { message }
  })
}
