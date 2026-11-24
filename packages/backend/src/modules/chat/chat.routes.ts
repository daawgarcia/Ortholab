import { FastifyInstance } from 'fastify'
import { authenticate, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'
import { paisesDoUsuario, whereDentistaPais } from '../acesso/escopo'
import { normalizar, prepararBusca } from '../busca/busca'

// Quem atende o dentista no chat (Admin escolhe na tela do Chat). Sem escolha: 1º admin / 1º financeiro ativo.
export const CHAVE_SUPORTE = 'chat_suporte_user_id'
export const CHAVE_FINANCEIRO = 'chat_financeiro_user_id'

export async function atendentesDoChat(prisma: any) {
  const conf = await prisma.systemSetting.findMany({ where: { key: { in: [CHAVE_SUPORTE, CHAVE_FINANCEIRO] } } })
  const val = (k: string) => conf.find((c: any) => c.key === k)?.value || null
  const sel = { id: true, name: true, email: true, role: true }
  const achar = async (id: string | null, role: Role) =>
    (id && await prisma.user.findFirst({ where: { id, status: 'ACTIVE' }, select: sel }))
    || await prisma.user.findFirst({ where: { role, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' }, select: sel })
  return { suporte: await achar(val(CHAVE_SUPORTE), Role.ADMIN), financeiro: await achar(val(CHAVE_FINANCEIRO), Role.FINANCIAL) }
}

// busca por palavras, sem acento e em qualquer ordem ("Fernando Buranello" acha FERNANDO STEFANATO BURANELLO)
async function idsPorNome(prisma: any, q: string) {
  await prepararBusca(prisma)
  const palavras = normalizar(q).split(' ').filter(t => t && !['de', 'da', 'do', 'das', 'dos', 'e'].includes(t)).slice(0, 6)
  if (!palavras.length) return []
  const conds = palavras.map((_, i) => `(f_busca(name) LIKE $${i + 1} OR lower(email) LIKE $${i + 1})`).join(' AND ')
  const rows = await prisma.$queryRawUnsafe(`SELECT id FROM "User" WHERE ${conds} LIMIT 200`, ...palavras.map(t => `%${t}%`))
  return (rows as any[]).map(r => r.id)
}

export async function chatRoutes(fastify: FastifyInstance, opts: { wsClients: Map<string, any> }) {
  const wsClients = opts.wsClients

  // Returns contact list based on role, with online status
  fastify.get('/contacts', { preHandler: authenticate }, async (request) => {
    const user = request.user as JwtPayload

    let contacts: any[] = []

    if (user.role === Role.SELLER) {
      // Seller sees their dentist clients + all FINANCIAL users
      const [sellerClients, financials] = await Promise.all([
        fastify.prisma.sellerClient.findMany({
          where: { sellerId: user.id },
          include: { client: { select: { id: true, name: true, email: true, role: true, clinic: true } } },
        }),
        fastify.prisma.user.findMany({
          where: { role: Role.FINANCIAL },
          select: { id: true, name: true, email: true, role: true },
        }),
      ])
      contacts = [...sellerClients.map(sc => sc.client), ...financials]
    } else if (user.role === Role.DENTIST) {
      // Dentista só fala com: Suporte, o seu vendedor e o Financeiro
      const [{ suporte, financeiro }, sellerLinks] = await Promise.all([
        atendentesDoChat(fastify.prisma),
        fastify.prisma.sellerClient.findMany({
          where: { clientId: user.id, seller: { status: 'ACTIVE' as any } },
          include: { seller: { select: { id: true, name: true, email: true, role: true } } },
        }),
      ])
      if (suporte) contacts.push({ ...suporte, canal: 'SUPORTE', name: 'Suporte Esthetic Aligner' })
      for (const sl of sellerLinks) contacts.push({ ...sl.seller, canal: 'VENDEDOR' })
      if (financeiro) contacts.push({ ...financeiro, canal: 'FINANCEIRO', name: 'Financeiro Esthetic Aligner' })
    } else {
      // Equipe: vê só a equipe ativa (os ~15 mil dentistas importados do Ortholab 1 não entram na lista).
      // Dentistas aparecem quando já há conversa ou pela busca (?q=nome/e-mail).
      const q = String((request.query as any)?.q || '').trim()
      const paises = await paisesDoUsuario(fastify.prisma, user)
      if (q.length >= 2) {
        const ids = await idsPorNome(fastify.prisma, q)
        contacts = await fastify.prisma.user.findMany({
          where: {
            id: { in: ids.filter(i => i !== user.id) },
            status: 'ACTIVE' as any,
            ...(user.role === Role.LAB_TECH || user.role === Role.EXPEDITION
              ? { role: { not: Role.DENTIST } }
              : paises ? { AND: [{ OR: [{ role: { not: Role.DENTIST } }, whereDentistaPais(paises)] }] } : {}),
          },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: 'asc' },
          take: 30,
        })
      } else {
        // sem busca: a tela mostra só as conversas já existentes
        contacts = []
      }
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
          peer: { ...peer, online: wsClients.has(peer.id) },
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

  fastify.post('/upload', { preHandler: authenticate }, async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(data.mimetype)) {
      return reply.status(400).send({ error: 'Tipo de arquivo não permitido' })
    }

    const buffer = await data.toBuffer()
    if (buffer.length > 10 * 1024 * 1024) {
      return reply.status(400).send({ error: 'Arquivo muito grande (máx. 10MB)' })
    }

    const { url } = await fastify.s3.upload(buffer, data.filename, data.mimetype, 'chat')
    return { url }
  })

  fastify.post('/messages/:peerId', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { peerId } = request.params as { peerId: string }
    const { content } = request.body as { content: string }

    if (!content || (!content.trim() && !content.startsWith('[img]'))) {
      return reply.status(400).send({ error: 'Conteúdo da mensagem não pode ser vazio' })
    }

    const peer = await fastify.prisma.user.findUnique({
      where: { id: peerId },
      select: { id: true, name: true, role: true, status: true },
    })
    if (!peer || peer.status !== 'ACTIVE') {
      return reply.status(404).send({ error: 'Usuário não encontrado' })
    }

    // ACL por role — espelha o filtro de /contacts
    const allowed = await isChatAllowed(fastify, user, peer)
    if (!allowed) {
      return reply.status(403).send({ error: 'Conversa não permitida' })
    }

    const safeContent = String(content).slice(0, 4000)

    const message = await fastify.prisma.chatMessage.create({
      data: {
        senderId: user.id,
        receiverId: peerId,
        content: safeContent,
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

  // Admin: quem atende "Suporte" e "Financeiro" no chat do dentista
  fastify.get('/atendimento', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    if (user.role !== Role.ADMIN) return reply.status(403).send({ error: 'Acesso negado' })
    return atendentesDoChat(fastify.prisma)
  })
  fastify.put('/atendimento', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    if (user.role !== Role.ADMIN) return reply.status(403).send({ error: 'Acesso negado' })
    const { suporteId, financeiroId } = (request.body || {}) as { suporteId?: string; financeiroId?: string }
    for (const [key, value] of [[CHAVE_SUPORTE, suporteId], [CHAVE_FINANCEIRO, financeiroId]] as const) {
      if (!value) continue
      const alvo = await fastify.prisma.user.findFirst({ where: { id: value, status: 'ACTIVE' as any, role: { not: Role.DENTIST } } })
      if (!alvo) return reply.status(400).send({ error: 'Usuário inválido para o atendimento' })
      await fastify.prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
    }
    return atendentesDoChat(fastify.prisma)
  })
}

async function isChatAllowed(
  fastify: FastifyInstance,
  sender: { id: string; role: Role },
  receiver: { id: string; role: string }
): Promise<boolean> {
  if (sender.id === receiver.id) return false
  // Dentista: só Suporte, o seu vendedor e o Financeiro (ou responder quem já falou com ele)
  if (sender.role === Role.DENTIST) {
    const { suporte, financeiro } = await atendentesDoChat(fastify.prisma)
    if (receiver.id === suporte?.id || receiver.id === financeiro?.id) return true
    if (receiver.role === 'SELLER') {
      const link = await fastify.prisma.sellerClient.findUnique({
        where: { sellerId_clientId: { sellerId: receiver.id, clientId: sender.id } },
      })
      if (link) return true
    }
    const jaFalou = await fastify.prisma.chatMessage.findFirst({ where: { senderId: receiver.id, receiverId: sender.id }, select: { id: true } })
    return !!jaFalou
  }
  // Produção (laboratório, recorte, impressão, expedição): entre eles, financeiro, vendas e admin — não fala com dentista
  if (sender.role === Role.LAB_TECH || sender.role === Role.EXPEDITION) {
    return ['LAB_TECH', 'EXPEDITION', 'FINANCIAL', 'SELLER', 'ADMIN'].includes(receiver.role)
  }
  const elevated = ['ADMIN', 'FINANCIAL', 'LAB_TECH']
  if (elevated.includes(sender.role) || elevated.includes(receiver.role)) return true

  if (sender.role === Role.SELLER && receiver.role === 'DENTIST') {
    const link = await fastify.prisma.sellerClient.findUnique({
      where: { sellerId_clientId: { sellerId: sender.id, clientId: receiver.id } },
    })
    return !!link
  }
  return false
}
