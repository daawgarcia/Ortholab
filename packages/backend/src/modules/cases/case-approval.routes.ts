import { FastifyInstance } from 'fastify'
import { authenticate, JwtPayload } from '../../plugins/auth'
import { Role, ApprovalVideoStatus, ApprovalDocStatus, CaseStatus, PushLevel } from '@prisma/client'
import { whatsappService } from '../../services/whatsapp.service'
import path from 'path'
import { promises as fs } from 'fs'

export async function caseApprovalRoutes(fastify: FastifyInstance) {
  // Upload de vídeo de aprovação
  fastify.post('/:caseId/video', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { caseId } = request.params as { caseId: string }

    // Apenas LAB_TECH, ADMIN e EXPEDITION podem subir vídeos
    const allowedRoles = [Role.ADMIN, Role.LAB_TECH, Role.EXPEDITION]
    if (!(allowedRoles as Role[]).includes(user.role)) {
      return reply.status(403).send({ error: 'Apenas equipe técnica pode subir vídeos de aprovação' })
    }

    const { title, description, videoUrl, thumbnailUrl, fileSize, duration } = request.body as any

    if (!videoUrl) {
      return reply.status(400).send({ error: 'URL do vídeo é obrigatória' })
    }

    // Buscar caso e dentista
    const caseData = await fastify.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        dentist: { select: { id: true, name: true, email: true, phone: true } },
        patient: { select: { id: true, name: true } },
      },
    })

    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })

    // Criar vídeo de aprovação
    const video = await fastify.prisma.caseApprovalVideo.create({
      data: {
        caseId,
        uploadedBy: user.id,
        title: title || 'Vídeo de Aprovação',
        description,
        videoUrl,
        thumbnailUrl,
        fileSize,
        duration,
        status: ApprovalVideoStatus.PENDING,
      },
    })

    // Atualizar status do caso para aguardando aprovação
    await fastify.prisma.case.update({
      where: { id: caseId },
      data: { status: CaseStatus.WAITING_APPROVAL },
    })

    // Criar evento de workflow
    await fastify.prisma.workflowEvent.create({
      data: {
        caseId,
        stage: 99,
        stageName: 'Aguardando Aprovação do Dentista',
        performedBy: user.id,
        notes: `Vídeo de aprovação enviado: ${title}`,
      },
    })

    // Notificar dentista via Push
    await fastify.prisma.pushNotification.create({
      data: {
        createdById: user.id,
        title: '🎬 Vídeo de Aprovação Disponível',
        body: `O caso de ${caseData.patient?.name || 'paciente'} está aguardando sua aprovação. Assista ao vídeo!`,
        level: PushLevel.INFO,
        targetType: 'USER',
        targetId: caseData.dentistId,
        link: `/cases/${caseId}/approval`,
      },
    })

    // Notificar dentista via Email
    if (caseData.dentist?.email) {
      try {
        await fastify.mailer.send({
          to: caseData.dentist.email,
          subject: `Vídeo de Aprovação - ${caseData.patient?.name || 'Paciente'}`,
          html: `
            <h2>Olá, Dr(a). ${caseData.dentist.name}!</h2>
            <p>O caso de <strong>${caseData.patient?.name || 'paciente'}</strong> está pronto para aprovação.</p>
            <p>Um vídeo foi enviado demonstrando o planejamento do caso.</p>
            <p><a href="${process.env.FRONTEND_URL}/cases/${caseId}/approval" style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Ver Vídeo de Aprovação</a></p>
            <p>Ou acesse: ${process.env.FRONTEND_URL}/cases/${caseId}/approval</p>
            <hr>
            <p><small>Ortholab - Esthetic Aligner</small></p>
          `,
        })
      } catch (e) {
        console.error('Erro ao enviar email:', e)
      }
    }

    // Buscar vendedor do dentista para notificar
    const sellerClient = await fastify.prisma.sellerClient.findFirst({
      where: { clientId: caseData.dentistId },
      include: { seller: { select: { id: true, name: true, email: true } } },
    })

    if (sellerClient?.seller) {
      // Notificar vendedor via Push
      await fastify.prisma.pushNotification.create({
        data: {
          createdById: user.id,
          title: '📋 Caso em Aprovação',
          body: `O caso de ${caseData.patient?.name || 'paciente'} (Dr(a). ${caseData.dentist?.name}) está aguardando aprovação do dentista.`,
          level: PushLevel.INFO,
          targetType: 'USER',
          targetId: sellerClient.seller.id,
          link: `/cases/${caseId}`,
        },
      })

      // Notificar vendedor via Email
      if (sellerClient.seller.email) {
        try {
          await fastify.mailer.send({
            to: sellerClient.seller.email,
            subject: `Caso em Aprovação - ${caseData.patient?.name || 'Paciente'}`,
            html: `
              <h2>Olá, ${sellerClient.seller.name}!</h2>
              <p>O caso do seu cliente <strong>Dr(a). ${caseData.dentist?.name}</strong> está aguardando aprovação.</p>
              <p>Paciente: ${caseData.patient?.name || 'N/A'}</p>
              <p>Acompanhe o processo de aprovação junto ao dentista.</p>
              <p><a href="${process.env.FRONTEND_URL}/cases/${caseId}" style="padding: 10px 20px; background: #28a745; color: white; text-decoration: none; border-radius: 5px;">Ver Caso</a></p>
            `,
          })
        } catch (e) {
          console.error('Erro ao enviar email para vendedor:', e)
        }
      }
    }

    // Enviar WhatsApp para o dentista
    if (caseData.dentist?.phone) {
      try {
        await whatsappService.sendCaseApprovalNotification(
          caseData.dentist.phone,
          caseData.dentist.name,
          caseData.caseNumber,
          caseData.patient?.name || 'Paciente',
          process.env.FRONTEND_URL || 'https://ortholab-frontend.vercel.app'
        )
      } catch (e) {
        console.error('[WhatsApp] Erro ao enviar notificação:', e)
        // Não falha o processo se o WhatsApp falhar
      }
    }

    return { video, message: 'Vídeo enviado e dentista notificado' }
  })

  // Upload de PDF de aprovação
  fastify.post('/:caseId/document', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { caseId } = request.params as { caseId: string }

    // Apenas LAB_TECH, ADMIN e EXPEDITION podem subir PDFs
    const allowedRoles = [Role.ADMIN, Role.LAB_TECH, Role.EXPEDITION]
    if (!(allowedRoles as Role[]).includes(user.role)) {
      return reply.status(403).send({ error: 'Apenas equipe técnica pode subir documentos de aprovação' })
    }

    const { title, description, fileUrl, fileName, fileSize } = request.body as any

    if (!fileUrl) {
      return reply.status(400).send({ error: 'URL do arquivo é obrigatória' })
    }

    // Buscar caso e dentista
    const caseData = await fastify.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        dentist: { select: { id: true, name: true, email: true, phone: true } },
        patient: { select: { id: true, name: true } },
      },
    })

    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })

    // Criar documento de aprovação
    const doc = await fastify.prisma.caseApprovalDocument.create({
      data: {
        caseId,
        uploadedBy: user.id,
        title: title || 'Documento de Aprovação',
        description,
        fileUrl,
        fileName: fileName || 'documento.pdf',
        fileSize,
        status: ApprovalDocStatus.PENDING,
      },
    })

    // Atualizar status do caso para aguardando aprovação
    await fastify.prisma.case.update({
      where: { id: caseId },
      data: { status: CaseStatus.WAITING_APPROVAL },
    })

    // Criar evento de workflow
    await fastify.prisma.workflowEvent.create({
      data: {
        caseId,
        stage: 99,
        stageName: 'Aguardando Aprovação do Dentista',
        performedBy: user.id,
        notes: `Documento de aprovação enviado: ${title}`,
      },
    })

    // Notificações (mesmo padrão do vídeo)
    await fastify.prisma.pushNotification.create({
      data: {
        createdById: user.id,
        title: '📄 Documento de Aprovação Disponível',
        body: `O caso de ${caseData.patient?.name || 'paciente'} está aguardando sua aprovação.`,
        level: PushLevel.INFO,
        targetType: 'USER',
        targetId: caseData.dentistId,
        link: `/cases/${caseId}/approval`,
      },
    })

    // Email para dentista
    if (caseData.dentist?.email) {
      try {
        await fastify.mailer.send({
          to: caseData.dentist.email,
          subject: `Documento de Aprovação - ${caseData.patient?.name || 'Paciente'}`,
          html: `
            <h2>Olá, Dr(a). ${caseData.dentist.name}!</h2>
            <p>O caso de <strong>${caseData.patient?.name || 'paciente'}</strong> está pronto para aprovação.</p>
            <p>Um documento PDF foi enviado para sua análise.</p>
            <p><a href="${process.env.FRONTEND_URL}/cases/${caseId}/approval" style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Ver Documento</a></p>
          `,
        })
      } catch (e) {
        console.error('Erro ao enviar email:', e)
      }
    }

    // Notificar vendedor
    const sellerClient = await fastify.prisma.sellerClient.findFirst({
      where: { clientId: caseData.dentistId },
      include: { seller: { select: { id: true, name: true, email: true } } },
    })

    if (sellerClient?.seller) {
      await fastify.prisma.pushNotification.create({
        data: {
          createdById: user.id,
          title: '📋 Caso em Aprovação',
          body: `O caso de ${caseData.patient?.name || 'paciente'} (Dr(a). ${caseData.dentist?.name}) está aguardando aprovação.`,
          level: PushLevel.INFO,
          targetType: 'USER',
          targetId: sellerClient.seller.id,
          link: `/cases/${caseId}`,
        },
      })
    }

    // Enviar WhatsApp para o dentista
    if (caseData.dentist?.phone) {
      try {
        await whatsappService.sendCaseApprovalNotification(
          caseData.dentist.phone,
          caseData.dentist.name,
          caseData.caseNumber,
          caseData.patient?.name || 'Paciente',
          process.env.FRONTEND_URL || 'https://ortholab-frontend.vercel.app'
        )
      } catch (e) {
        console.error('[WhatsApp] Erro ao enviar notificação:', e)
      }
    }

    return { document: doc, message: 'Documento enviado e dentista notificado' }
  })

  // Listar vídeos e documentos de aprovação do caso
  fastify.get('/:caseId/approvals', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { caseId } = request.params as { caseId: string }

    const caseData = await fastify.prisma.case.findUnique({
      where: { id: caseId },
      select: { dentistId: true },
    })

    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })

    // Verificar permissão
    if (user.role === Role.DENTIST && caseData.dentistId !== user.id) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }

    const [videos, documents] = await Promise.all([
      fastify.prisma.caseApprovalVideo.findMany({
        where: { caseId },
        orderBy: { createdAt: 'desc' },
        include: {
          uploader: { select: { id: true, name: true } },
        },
      }),
      fastify.prisma.caseApprovalDocument.findMany({
        where: { caseId },
        orderBy: { createdAt: 'desc' },
        include: {
          uploader: { select: { id: true, name: true } },
        },
      }),
    ])

    return { videos, documents }
  })

  // Stream de vídeo — aceita token como query param para uso em <video src>
  fastify.get('/video/:videoId/stream', async (request, reply) => {
    const query = request.query as { token?: string }
    const header = request.headers.authorization

    let rawToken = ''
    if (header?.startsWith('Bearer ')) rawToken = header.slice('Bearer '.length).trim()
    else if (query.token) rawToken = query.token

    if (!rawToken) return reply.status(401).send({ error: 'Unauthorized' })

    let userPayload!: JwtPayload
    try {
      userPayload = (request.server as any).tokens.verifyAccess(rawToken)
    } catch {
      return reply.status(401).send({ error: 'Token inválido' })
    }

    const { videoId } = request.params as { videoId: string }
    const video = await fastify.prisma.caseApprovalVideo.findUnique({
      where: { id: videoId },
      include: { case: { select: { dentistId: true } } },
    })

    if (!video) return reply.status(404).send({ error: 'Vídeo não encontrado' })

    if (userPayload.role === Role.DENTIST && video.case.dentistId !== userPayload.id) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }

    const videoUrl = video.videoUrl

    // S3: gera presigned URL e redireciona
    if (!videoUrl.includes('/api/uploads/')) {
      try {
        const signed = await fastify.s3.signedUrlForUrl(videoUrl, 3600)
        return reply.status(307).redirect(signed)
      } catch {
        return reply.status(500).send({ error: 'Erro ao gerar URL de streaming' })
      }
    }

    // Local: extrai path relativo e faz streaming direto
    const marker = '/api/uploads/'
    const idx = videoUrl.indexOf(marker)
    if (idx >= 0) {
      const relativePath = videoUrl.slice(idx + marker.length).split('/').filter(Boolean).join(path.sep)
      const uploadsRoot = path.resolve(process.cwd(), 'uploads')
      const filePath = path.resolve(uploadsRoot, relativePath)

      if (!filePath.startsWith(uploadsRoot + path.sep)) {
        return reply.status(400).send({ error: 'Caminho inválido' })
      }

      try {
        const file = await fs.readFile(filePath)
        const ext = path.extname(filePath).toLowerCase()
        const mimeTypes: Record<string, string> = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' }
        return reply
          .header('Content-Type', mimeTypes[ext] || 'video/mp4')
          .header('Accept-Ranges', 'bytes')
          .send(file)
      } catch {
        return reply.status(404).send({ error: 'Arquivo não encontrado' })
      }
    }

    return reply.redirect(videoUrl, 307)
  })

  // Marcar vídeo como visualizado
  fastify.post('/video/:videoId/view', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { videoId } = request.params as { videoId: string }

    const video = await fastify.prisma.caseApprovalVideo.findUnique({
      where: { id: videoId },
      include: { case: { select: { dentistId: true } } },
    })

    if (!video) return reply.status(404).send({ error: 'Vídeo não encontrado' })

    // Apenas o dentista do caso pode marcar como visualizado
    if (user.role === Role.DENTIST && video.case.dentistId !== user.id) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }

    const updated = await fastify.prisma.caseApprovalVideo.update({
      where: { id: videoId },
      data: {
        status: ApprovalVideoStatus.VIEWED,
        viewedAt: new Date(),
      },
    })

    return { video: updated }
  })

  // Marcar vídeo como baixado
  fastify.post('/video/:videoId/download', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { videoId } = request.params as { videoId: string }

    const video = await fastify.prisma.caseApprovalVideo.findUnique({
      where: { id: videoId },
      include: { case: { select: { dentistId: true } } },
    })

    if (!video) return reply.status(404).send({ error: 'Vídeo não encontrado' })

    // Apenas o dentista do caso pode baixar
    if (user.role === Role.DENTIST && video.case.dentistId !== user.id) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }

    const updated = await fastify.prisma.caseApprovalVideo.update({
      where: { id: videoId },
      data: {
        status: ApprovalVideoStatus.DOWNLOADED,
        downloadedAt: new Date(),
      },
    })

    return { video: updated, downloadUrl: video.videoUrl }
  })

  // Aprovar/Rejeitar caso via vídeo
  fastify.post('/video/:videoId/approve', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { videoId } = request.params as { videoId: string }
    const { approved, notes } = request.body as { approved: boolean; notes?: string }

    const video = await fastify.prisma.caseApprovalVideo.findUnique({
      where: { id: videoId },
      include: { 
        case: { 
          select: { 
            id: true, 
            dentistId: true,
            patient: { select: { name: true } },
          } 
        } 
      },
    })

    if (!video) return reply.status(404).send({ error: 'Vídeo não encontrado' })

    // Apenas o dentista do caso pode aprovar
    if (user.role === Role.DENTIST && video.case.dentistId !== user.id) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }

    const newStatus = approved ? ApprovalVideoStatus.APPROVED : ApprovalVideoStatus.REJECTED

    const updated = await fastify.prisma.caseApprovalVideo.update({
      where: { id: videoId },
      data: { status: newStatus },
    })

    // Atualizar status do caso
    const caseStatus = approved ? CaseStatus.APPROVED : CaseStatus.REVISION_REQUESTED
    await fastify.prisma.case.update({
      where: { id: video.case.id },
      data: { status: caseStatus },
    })

    // Criar evento de workflow
    await fastify.prisma.workflowEvent.create({
      data: {
        caseId: video.case.id,
        stage: 100,
        stageName: approved ? 'Caso Aprovado pelo Dentista' : 'Revisão Solicitada',
        performedBy: user.id,
        notes: notes || (approved ? 'Caso aprovado via vídeo' : 'Revisão solicitada'),
      },
    })

    return { 
      video: updated, 
      approved,
      message: approved ? 'Caso aprovado com sucesso!' : 'Revisão solicitada.' 
    }
  })

  // Upload direto de PDF para Relatório (multipart)
  fastify.post('/:caseId/upload-pdf', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { caseId } = request.params as { caseId: string }
    const allowedRoles = [Role.ADMIN, Role.LAB_TECH, Role.EXPEDITION]
    if (!(allowedRoles as Role[]).includes(user.role)) {
      return reply.status(403).send({ error: 'Apenas equipe técnica pode fazer upload' })
    }
    const caseData = await fastify.prisma.case.findUnique({ where: { id: caseId }, select: { id: true } })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })

    const mp = await request.file({ limits: { fileSize: 50 * 1024 * 1024 } })
    if (!mp) return reply.status(400).send({ error: 'Arquivo não fornecido' })
    if (mp.mimetype !== 'application/pdf') return reply.status(400).send({ error: 'Apenas PDFs são aceitos' })

    const buffer = await mp.toBuffer()
    const { url } = await fastify.s3.upload(buffer, mp.filename || 'relatorio.pdf', mp.mimetype, `cases/${caseId}/reports`)

    const doc = await fastify.prisma.caseApprovalDocument.create({
      data: {
        caseId,
        uploadedBy: user.id,
        title: mp.filename || 'Relatório',
        fileUrl: url,
        fileName: mp.filename || 'relatorio.pdf',
        fileSize: buffer.length,
        fileType: 'application/pdf',
      },
    })
    return reply.status(201).send({ document: doc })
  })

  // Upload direto de vídeo para Checagem Virtual 3D (multipart)
  fastify.post('/:caseId/upload-video', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { caseId } = request.params as { caseId: string }
    const allowedRoles = [Role.ADMIN, Role.LAB_TECH, Role.EXPEDITION]
    if (!(allowedRoles as Role[]).includes(user.role)) {
      return reply.status(403).send({ error: 'Apenas equipe técnica pode fazer upload' })
    }
    const caseData = await fastify.prisma.case.findUnique({ where: { id: caseId }, select: { id: true } })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })

    const mp = await request.file({ limits: { fileSize: 500 * 1024 * 1024 } })
    if (!mp) return reply.status(400).send({ error: 'Arquivo não fornecido' })
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime']
    if (!allowedVideoTypes.includes(mp.mimetype)) return reply.status(400).send({ error: 'Apenas MP4/WebM/MOV são aceitos' })

    const buffer = await mp.toBuffer()
    const { url } = await fastify.s3.upload(buffer, mp.filename || 'checagem3d.mp4', mp.mimetype, `cases/${caseId}/videos`)

    const video = await fastify.prisma.caseApprovalVideo.create({
      data: {
        caseId,
        uploadedBy: user.id,
        title: mp.filename || 'Checagem Virtual 3D',
        videoUrl: url,
        fileSize: buffer.length,
      },
    })
    return reply.status(201).send({ video })
  })

  // GET /patient/:patientId/approvals — agrega vídeos e docs de todos os casos do paciente
  fastify.get('/patient/:patientId/approvals', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { patientId } = request.params as { patientId: string }

    const where = user.role === Role.DENTIST
      ? { patientId, dentistId: user.id }
      : { patientId }

    const cases = await fastify.prisma.case.findMany({ where, select: { id: true, caseNumber: true } })
    const caseIds = cases.map(c => c.id)
    if (caseIds.length === 0) return { videos: [], documents: [] }

    const [videos, documents] = await Promise.all([
      fastify.prisma.caseApprovalVideo.findMany({
        where: { caseId: { in: caseIds } },
        orderBy: { createdAt: 'desc' },
        include: { uploader: { select: { name: true } }, case: { select: { caseNumber: true } } },
      }),
      fastify.prisma.caseApprovalDocument.findMany({
        where: { caseId: { in: caseIds } },
        orderBy: { createdAt: 'desc' },
        include: { uploader: { select: { name: true } }, case: { select: { caseNumber: true } } },
      }),
    ])
    return { videos, documents }
  })

  // Marcar documento como visualizado
  fastify.post('/document/:docId/view', { preHandler: authenticate }, async (request, reply) => {
    const { docId } = request.params as { docId: string }
    const user = request.user as JwtPayload
    const doc = await fastify.prisma.caseApprovalDocument.findUnique({
      where: { id: docId },
      include: { case: { select: { dentistId: true } } },
    })
    if (!doc) return reply.status(404).send({ error: 'Documento não encontrado' })
    if (user.role === Role.DENTIST && doc.case.dentistId !== user.id) {
      return reply.status(403).send({ error: 'Acesso negado' })
    }
    const updated = await fastify.prisma.caseApprovalDocument.update({
      where: { id: docId },
      data: { status: ApprovalDocStatus.VIEWED, viewedAt: new Date() },
    })
    return { document: updated }
  })
}
