import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import websocket from '@fastify/websocket'
import rateLimit from '@fastify/rate-limit'
import { promises as fs } from 'fs'
import path from 'path'
import { prismaPlugin } from './plugins/prisma'
import { s3Plugin } from './plugins/s3'
import { mailerPlugin } from './plugins/mailer'
import { redePlugin } from './plugins/rede'
import { pixPlugin } from './plugins/pix'
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
import { entryRoutes } from './modules/entries/entry.routes'
import { caseApprovalRoutes } from './modules/cases/case-approval.routes'
import { whatsappRoutes } from './modules/whatsapp/whatsapp.routes'
import { reportsRoutes } from './modules/reports/reports.routes'
import { startStalledCasesJob } from './modules/jobs/stalled-cases.job'

// Fail fast if required secrets are missing
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required')
if (!process.env.JWT_REFRESH_SECRET && !process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required')

const app = Fastify({ logger: true })

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

  await app.register(jwt, {
    secret: process.env.JWT_SECRET!,
  })

  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  })

  const wsClients = new Map<string, any>()

  await app.register(prismaPlugin)
  await app.register(s3Plugin)
  await app.register(mailerPlugin)
  await app.register(redePlugin)
  await app.register(pixPlugin)
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

  app.get('/api/chat/ws', { websocket: true }, (connection, request) => {
    const url = new URL(request.url!, `http://${request.headers.host}`)
    const token = url.searchParams.get('token') || (request.headers.authorization?.split(' ')[1] ?? '')

    try {
      const user = app.jwt.verify(token as string) as any
      const userId = user.id
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

            const receiver = await app.prisma.user.findUnique({
              where: { id: payload.to },
              select: { id: true, status: true },
            })
            if (!receiver || receiver.status !== 'ACTIVE') return

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
          console.error('WS message error', err)
        }
      })

      connection.socket.on('close', () => {
        wsClients.delete(userId)
      })

    } catch (err) {
      connection.socket.send(JSON.stringify({ error: 'Unauthorized' }))
      connection.socket.close()
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
  await app.register(entryRoutes, { prefix: '/api/entries' })
  await app.register(caseApprovalRoutes, { prefix: '/api/cases' })
  await app.register(whatsappRoutes, { prefix: '/api/whatsapp' })
  await app.register(reportsRoutes, { prefix: '/api/reports' })

  // Iniciar job de verificação de casos parados
  startStalledCasesJob(app)

  app.get('/api/uploads/*', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const uploadsRoot = path.resolve(process.cwd(), 'uploads')
    const raw = String((request.params as any)['*'] || '')
    const normalizedPath = raw.split('/').filter(Boolean).join(path.sep)
    const filePath = path.resolve(uploadsRoot, normalizedPath)

    if (!filePath.startsWith(uploadsRoot + path.sep) && filePath !== uploadsRoot) {
      return reply.status(400).send({ error: 'Caminho inválido' })
    }

    try {
      const file = await fs.readFile(filePath)
      return reply.type(getContentType(filePath)).send(file)
    } catch {
      return reply.status(404).send({ error: 'Arquivo não encontrado' })
    }
  })

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  const port = parseInt(process.env.PORT || '3001')
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`Ortholab API running on port ${port}`)
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
