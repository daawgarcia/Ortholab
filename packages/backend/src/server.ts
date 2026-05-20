import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import websocket from '@fastify/websocket'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import rawBody from 'fastify-raw-body'
import { promises as fs } from 'fs'
import path from 'path'
import { validateEnv } from './plugins/env'
import { prismaPlugin } from './plugins/prisma'
import { s3Plugin } from './plugins/s3'
import { mailerPlugin } from './plugins/mailer'
import { redePlugin } from './plugins/rede'
import { pixPlugin } from './plugins/pix'
import { tokenPlugin, authenticate } from './plugins/auth'
import { auditPlugin } from './plugins/audit'
import { authRoutes } from './modules/auth/auth.routes'
import { userRoutes } from './modules/users/user.routes'
import { caseRoutes } from './modules/cases/case.routes'
import { chatRoutes } from './modules/chat/chat.routes'
import { documentRoutes } from './modules/documents/document.routes'
import { planningRoutes } from './modules/planning/planning.routes'
import { financialRoutes } from './modules/financial/financial.routes'
import { paymentRoutes } from './modules/payments/payment.routes'
import { sellerRoutes } from './modules/seller/seller.routes'
import { sellerClientRoutes } from './modules/seller/seller-client.routes'
import { pushRoutes } from './modules/push/push.routes'
import { serviceRoutes } from './modules/services/service.routes'
import { appModuleRoutes } from './modules/app-modules/app-module.routes'
import { exportRoutes } from './modules/export/export.routes'
import { totvsRoutes } from './modules/totvs/totvs.routes'
import { notificationRoutes } from './modules/notifications/notification.routes'
import { adminRoutes } from './modules/admin/admin.routes'
import { patientRoutes } from './modules/patients/patient.routes'
import { dentistRoutes } from './modules/dentists/dentist.routes'
import { workflowEventRoutes } from './modules/workflow/workflow.routes'
import { clinicalRecordRoutes } from './modules/clinical-records/clinical-record.routes'
import { formsRoutes } from './modules/forms/forms.routes'
import { videoRoutes } from './modules/videos/video.routes'
import { contentRoutes } from './modules/content/content.routes'
import { dentistFinancialRoutes } from './modules/dentist-financial/dentist-financial.routes'

const env = validateEnv()

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-totvs-secret"]',
        'req.headers["x-rede-signature"]',
        'req.headers["x-webhook-signature"]',
        'req.body.password',
        'req.body.currentPassword',
        'req.body.newPassword',
        'req.body.cardData.number',
        'req.body.cardData.cvv',
        'req.body.cardData.holder',
        'req.body.cardNumber',
        'req.body.cardToken',
        'req.body.securityCode',
        'req.body.token',
        'req.query.token',
        'res.headers["set-cookie"]',
      ],
      remove: true,
    },
  },
})

const MAX_WS_MESSAGE_BYTES = 10 * 1024 // 10 KB

function getContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  const contentTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.stl': 'model/stl',
    '.obj': 'model/obj',
    '.zip': 'application/zip',
    '.pdf': 'application/pdf',
  }

  return contentTypes[ext] || 'application/octet-stream'
}

const start = async () => {
  // helmet → security headers globais (CSP é definido no frontend/Vercel)
  await app.register(helmet, {
    contentSecurityPolicy: false, // a API serve JSON; CSP fica no frontend
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })

  await app.register(cors, {
    origin: (origin, cb) => {
      const allowed = new Set(
        [
          'http://localhost:5173',
          'http://localhost:3000',
          process.env.FRONTEND_URL,
        ].filter(Boolean) as string[]
      )
      if (!origin || allowed.has(origin)) {
        cb(null, true)
      } else {
        cb(new Error('Not allowed by CORS'), false)
      }
    },
    credentials: true,
  })

  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({ error: 'Muitas requisições. Tente novamente em instantes.' }),
  })

  // Captura o body bruto para validação HMAC dos webhooks (rotas marcam config.rawBody)
  await app.register(rawBody, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true,
  })

  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  })

  const wsClients = new Map<string, any>()

  await app.register(prismaPlugin)
  await app.register(auditPlugin)
  await app.register(s3Plugin)
  await app.register(mailerPlugin)
  await app.register(redePlugin)
  await app.register(pixPlugin)
  await app.register(tokenPlugin)
  await app.register(websocket)

  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(userRoutes, { prefix: '/api/users' })
  await app.register(caseRoutes, { prefix: '/api/cases' })
  await app.register(documentRoutes, { prefix: '/api/documents' })
  await app.register(planningRoutes, { prefix: '/api/plannings' })
  await app.register(financialRoutes, { prefix: '/api/financial' })
  await app.register(paymentRoutes, { prefix: '/api/payments' })
  await app.register(sellerRoutes, { prefix: '/api/seller' })
  await app.register(sellerClientRoutes, { prefix: '/api/seller-clients' })
  await app.register(pushRoutes, { prefix: '/api/push' })
  await app.register(chatRoutes, { prefix: '/api/chat', wsClients })

  app.get('/api/chat/ws', { websocket: true }, async (connection, request) => {
    const url = new URL(request.url!, `http://${request.headers.host}`)
    const token = url.searchParams.get('token') || (request.headers.authorization?.split(' ')[1] ?? '')

    try {
      const decoded = app.tokens.verifyAccess(token)
      const dbUser = await app.prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, status: true, tokenVersion: true },
      })
      if (!dbUser || dbUser.status !== 'ACTIVE' || (dbUser.tokenVersion ?? 0) !== (decoded.tv ?? 0)) {
        connection.socket.send(JSON.stringify({ error: 'Unauthorized' }))
        connection.socket.close()
        return
      }

      const userId = dbUser.id
      wsClients.set(userId, connection.socket)

      connection.socket.on('message', async (data: Buffer) => {
        try {
          if (data.length > MAX_WS_MESSAGE_BYTES) {
            connection.socket.send(JSON.stringify({ error: 'Mensagem muito grande' }))
            return
          }

          const payload = JSON.parse(data.toString())
          if (payload.type === 'message') {
            if (!payload.to || typeof payload.to !== 'string') return
            if (!payload.content || typeof payload.content !== 'string') return

            // ACL: confere se o destinatário é um contato permitido para o role do remetente
            const sender = await app.prisma.user.findUnique({
              where: { id: userId },
              select: { id: true, role: true, status: true },
            })
            const receiver = await app.prisma.user.findUnique({
              where: { id: payload.to },
              select: { id: true, role: true, status: true },
            })
            if (!sender || !receiver || sender.status !== 'ACTIVE' || receiver.status !== 'ACTIVE') return

            const allowed = await isChatAllowed(app, sender, receiver)
            if (!allowed) {
              connection.socket.send(JSON.stringify({ error: 'Conversa não permitida' }))
              return
            }

            const message = await app.prisma.chatMessage.create({
              data: {
                senderId: userId,
                receiverId: payload.to,
                content: String(payload.content).slice(0, 4000),
              },
            })

            const messagePayload = JSON.stringify({ type: 'message', message })

            const peerSocket = wsClients.get(payload.to)
            if (peerSocket && peerSocket.readyState === 1) {
              peerSocket.send(messagePayload)
            }
            if (connection.socket.readyState === 1) {
              connection.socket.send(messagePayload)
            }
          }
        } catch (err) {
          app.log.error({ err }, 'WS message error')
        }
      })

      connection.socket.on('close', () => {
        wsClients.delete(userId)
      })
    } catch (err) {
      try {
        connection.socket.send(JSON.stringify({ error: 'Unauthorized' }))
        connection.socket.close()
      } catch {
        /* socket pode já estar fechado */
      }
    }
  })

  await app.register(serviceRoutes, { prefix: '/api/services' })
  await app.register(appModuleRoutes, { prefix: '/api/modules' })
  await app.register(exportRoutes, { prefix: '/api/export' })
  await app.register(totvsRoutes, { prefix: '/api/totvs' })
  await app.register(notificationRoutes, { prefix: '/api/notifications' })
  await app.register(adminRoutes, { prefix: '/api/admin' })
  await app.register(patientRoutes, { prefix: '/api/patients' })
  await app.register(dentistRoutes, { prefix: '/api/dentists' })
  await app.register(workflowEventRoutes, { prefix: '/api/workflow' })
  await app.register(clinicalRecordRoutes, { prefix: '/api/clinical-records' })
  await app.register(formsRoutes, { prefix: '/api/forms' })
  await app.register(videoRoutes, { prefix: '/api/videos' })
  await app.register(contentRoutes, { prefix: '/api/content' })
  await app.register(dentistFinancialRoutes, { prefix: '/api/dentist-financial' })

  app.get(
    '/api/uploads/*',
    { preHandler: authenticate, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const uploadsRoot = path.resolve(process.cwd(), 'uploads')
      const raw = String((request.params as any)['*'] || '')
      const normalizedPath = raw.split('/').filter(Boolean).join(path.sep)
      const filePath = path.resolve(uploadsRoot, normalizedPath)

      if (!filePath.startsWith(uploadsRoot + path.sep) && filePath !== uploadsRoot) {
        return reply.status(400).send({ error: 'Caminho inválido' })
      }

      // ACL: tenta resolver o key local ↔ documento/foto e checa autorização
      const allowed = await canAccessLocalFile(app, request, normalizedPath)
      if (!allowed) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      try {
        const file = await fs.readFile(filePath)
        return reply.type(getContentType(filePath)).send(file)
      } catch {
        return reply.status(404).send({ error: 'Arquivo não encontrado' })
      }
    }
  )

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  const port = parseInt(env.PORT)
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`Ortholab API running on port ${port}`)
}

/**
 * Política simples de chat:
 *  - ADMIN/FINANCIAL/LAB_TECH podem conversar com qualquer um
 *  - SELLER ↔ DENTISTs do seu portfólio + qualquer FINANCIAL
 *  - DENTIST ↔ seus SELLERs + qualquer FINANCIAL
 */
async function isChatAllowed(
  app: any,
  sender: { id: string; role: string },
  receiver: { id: string; role: string }
): Promise<boolean> {
  if (sender.id === receiver.id) return false
  const elevated = ['ADMIN', 'FINANCIAL', 'LAB_TECH']
  if (elevated.includes(sender.role) || elevated.includes(receiver.role)) return true

  if (sender.role === 'SELLER' && receiver.role === 'DENTIST') {
    const link = await app.prisma.sellerClient.findUnique({
      where: { sellerId_clientId: { sellerId: sender.id, clientId: receiver.id } },
    })
    return !!link
  }
  if (sender.role === 'DENTIST' && receiver.role === 'SELLER') {
    const link = await app.prisma.sellerClient.findUnique({
      where: { sellerId_clientId: { sellerId: receiver.id, clientId: sender.id } },
    })
    return !!link
  }
  return false
}

/**
 * Autorização para arquivos locais:
 *   uploads ficam em pastas como `cases/<caseId>/...`, `patients/<patientId>/...` ou `chat/...`.
 * Verificamos a primeira pasta do path e validamos relação com o usuário autenticado.
 */
async function canAccessLocalFile(app: any, request: any, normalizedPath: string): Promise<boolean> {
  const segments = normalizedPath.replace(/\\/g, '/').split('/').filter(Boolean)
  if (segments.length < 2) return false
  const [scope, scopeId] = segments
  const user = request.user

  if (scope === 'chat') return true // already authenticated

  if (scope === 'cases') {
    const c = await app.prisma.case.findUnique({ where: { id: scopeId }, select: { dentistId: true } })
    if (!c) return false
    if (['ADMIN', 'FINANCIAL', 'LAB_TECH'].includes(user.role)) return true
    if (user.role === 'DENTIST') return c.dentistId === user.id
    if (user.role === 'SELLER') {
      const link = await app.prisma.sellerClient.findUnique({
        where: { sellerId_clientId: { sellerId: user.id, clientId: c.dentistId } },
      })
      return !!link
    }
    return false
  }

  if (scope === 'patients') {
    const p = await app.prisma.patient.findUnique({ where: { id: scopeId }, select: { dentistId: true } })
    if (!p) return false
    if (['ADMIN', 'FINANCIAL', 'LAB_TECH'].includes(user.role)) return true
    if (user.role === 'DENTIST') return p.dentistId === user.id
    if (user.role === 'SELLER') {
      const link = await app.prisma.sellerClient.findUnique({
        where: { sellerId_clientId: { sellerId: user.id, clientId: p.dentistId } },
      })
      return !!link
    }
    return false
  }

  // fallback: nega acesso a paths não conhecidos
  return false
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
