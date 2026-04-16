import { FastifyInstance } from 'fastify'
import path from 'path'
import { authenticate, JwtPayload } from '../../plugins/auth'
import { Role } from '@prisma/client'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'model/stl',
  'model/obj',
  'application/octet-stream', // STL/OBJ às vezes chega assim
  'application/zip',
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  '.pdf', '.stl', '.obj', '.zip',
  '.mp4', '.webm', '.mov',
])

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

export async function documentRoutes(fastify: FastifyInstance) {
  fastify.post('/upload/:caseId', { preHandler: authenticate }, async (request, reply) => {
    const { caseId } = request.params as { caseId: string }
    const { type } = request.query as { type: string }
    const user = request.user as JwtPayload

    // Verificar que o caso existe e pertence ao usuário (dentistas só acessam os próprios)
    const caseData = await fastify.prisma.case.findUnique({ where: { id: caseId }, select: { id: true, dentistId: true } })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })
    if (user.role === Role.DENTIST && caseData.dentistId !== user.id) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })

    // Validar extensão
    const ext = path.extname(data.filename).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return reply.status(400).send({ error: `Tipo de arquivo não permitido: ${ext}` })
    }

    // Validar mimetype
    if (!ALLOWED_MIME_TYPES.has(data.mimetype)) {
      return reply.status(400).send({ error: `Tipo MIME não permitido: ${data.mimetype}` })
    }

    const buffer = await data.toBuffer()

    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(400).send({ error: 'Arquivo muito grande. Limite: 50 MB' })
    }

    const { key, url } = await fastify.s3.upload(buffer, data.filename, data.mimetype, `cases/${caseId}`)

    const doc = await fastify.prisma.caseDocument.create({
      data: { caseId, type: type as any, fileName: data.filename, url, size: buffer.length },
    })

    return reply.status(201).send({ document: doc })
  })

  fastify.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user as JwtPayload

    const doc = await fastify.prisma.caseDocument.findUnique({
      where: { id },
      include: { case: { select: { dentistId: true } } },
    })
    if (!doc) return reply.status(404).send({ error: 'Documento não encontrado' })

    // Dentistas só podem deletar documentos dos próprios casos
    if (user.role === Role.DENTIST && doc.case.dentistId !== user.id) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    await fastify.prisma.caseDocument.delete({ where: { id } })
    return { success: true }
  })
}
