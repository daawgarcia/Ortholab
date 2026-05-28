import { FastifyInstance } from 'fastify'
import { authenticate, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'
import { whatsappService } from '../../services/whatsapp.service'

export async function whatsappRoutes(fastify: FastifyInstance) {
  fastify.get('/status', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    if (user.role !== Role.ADMIN) return reply.status(403).send({ error: 'Acesso negado' })
    const isConnected = await whatsappService.checkSession()
    return { connected: isConnected, session: process.env.WAHA_SESSION_NAME || 'ortholab', timestamp: new Date().toISOString() }
  })

  fastify.post('/start', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    if (user.role !== Role.ADMIN) return reply.status(403).send({ error: 'Acesso negado' })
    try {
      const result = await whatsappService.startSession()
      return { success: true, message: 'Sessão iniciada. Escaneie o QR code.', data: result }
    } catch (error: any) {
      return reply.status(500).send({ error: 'Erro ao iniciar sessão', details: error.message })
    }
  })

  fastify.post('/stop', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    if (user.role !== Role.ADMIN) return reply.status(403).send({ error: 'Acesso negado' })
    const success = await whatsappService.stopSession()
    return { success, message: success ? 'Sessão parada' : 'Erro ao parar sessão' }
  })

  fastify.get('/qr', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    if (user.role !== Role.ADMIN) return reply.status(403).send({ error: 'Acesso negado' })
    const qrCode = await whatsappService.getQrCode()
    if (!qrCode) return reply.status(404).send({ error: 'QR Code não disponível. Inicie a sessão primeiro.' })
    return { qrCode }
  })

  fastify.post('/test', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    if (user.role !== Role.ADMIN) return reply.status(403).send({ error: 'Acesso negado' })
    const { phone, message } = request.body as { phone: string; message: string }
    if (!phone || !message) return reply.status(400).send({ error: 'Telefone e mensagem são obrigatórios' })
    const success = await whatsappService.sendTextMessage(phone, message)
    return { success, message: success ? 'Mensagem enviada' : 'Erro ao enviar mensagem' }
  })

  fastify.post('/send-approval', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    if (user.role !== Role.ADMIN && user.role !== Role.LAB_TECH) return reply.status(403).send({ error: 'Acesso negado' })
    const { phone, dentistName, caseNumber, patientName } = request.body as { phone: string; dentistName: string; caseNumber: number; patientName: string }
    if (!phone || !dentistName || !caseNumber || !patientName) return reply.status(400).send({ error: 'Dados incompletos' })
    const success = await whatsappService.sendCaseApprovalNotification(phone, dentistName, caseNumber, patientName, process.env.FRONTEND_URL || 'https://ortholab-frontend.vercel.app')
    return { success, message: success ? 'Notificação de aprovação enviada' : 'Erro ao enviar notificação' }
  })
}