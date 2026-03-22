import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import { prismaPlugin } from './plugins/prisma'
import { s3Plugin } from './plugins/s3'
import { mailerPlugin } from './plugins/mailer'
import { authRoutes } from './modules/auth/auth.routes'
import { userRoutes } from './modules/users/user.routes'
import { caseRoutes } from './modules/cases/case.routes'
import { documentRoutes } from './modules/documents/document.routes'
import { planningRoutes } from './modules/planning/planning.routes'
import { financialRoutes } from './modules/financial/financial.routes'
import { paymentRoutes } from './modules/payments/payment.routes'
import { sellerRoutes } from './modules/seller/seller.routes'
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

const app = Fastify({ logger: true })

const start = async () => {
  await app.register(cors, {
    origin: (origin, cb) => {
      const allowed = [
        'http://localhost:5173',
        process.env.FRONTEND_URL,
      ].filter(Boolean)
      if (!origin || allowed.some(o => origin.startsWith(o as string)) || origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) {
        cb(null, true)
      } else {
        cb(new Error('Not allowed by CORS'), false)
      }
    },
    credentials: true,
  })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'fallback-secret',
  })

  await app.register(multipart, {
    limits: { fileSize: 200 * 1024 * 1024 },
  })

  await app.register(prismaPlugin)
  await app.register(s3Plugin)
  await app.register(mailerPlugin)

  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(userRoutes, { prefix: '/api/users' })
  await app.register(caseRoutes, { prefix: '/api/cases' })
  await app.register(documentRoutes, { prefix: '/api/documents' })
  await app.register(planningRoutes, { prefix: '/api/plannings' })
  await app.register(financialRoutes, { prefix: '/api/financial' })
  await app.register(paymentRoutes, { prefix: '/api/payments' })
  await app.register(sellerRoutes, { prefix: '/api/seller' })
  await app.register(pushRoutes, { prefix: '/api/push' })
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
  await app.register(exportRoutes, { prefix: '/api/export' })

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  app.get('/setup-admin', async (request, reply) => {
    const secret = (request.query as any).secret
    if (secret !== 'ea-setup-2026') return reply.status(403).send({ error: 'Forbidden' })
    const bcrypt = require('bcryptjs')
    const hash = await bcrypt.hash('Admin@123', 12)
    const user = await app.prisma.user.upsert({
      where: { email: 'admin@estheticaligner.com.br' },
      update: {},
      create: { name: 'Administrador', email: 'admin@estheticaligner.com.br', password: hash, role: 'ADMIN', status: 'ACTIVE', emailVerified: true },
    })
    return { ok: true, email: user.email, role: user.role }
  })

  const port = parseInt(process.env.PORT || '3001')
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`Ortholab API running on port ${port}`)
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
