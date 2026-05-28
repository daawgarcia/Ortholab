import { FastifyInstance } from 'fastify'
import path from 'path'
import { fromBuffer } from 'file-type'
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

// Mimetypes detectados pelo file-type (magic bytes) que aceitamos.
const SAFE_DETECTED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'application/zip',
  'video/mp4', 'video/webm', 'video/quicktime',
])

// Cabeçalhos reconhecidos para STL ASCII / OBJ (texto)
function looksLikeStlAscii(buf: Buffer) {
  const head = buf.slice(0, 80).toString('utf8').trimStart().toLowerCase()
  return head.startsWith('solid')
}
function looksLikeObj(buf: Buffer) {
  const head = buf.slice(0, 1024).toString('utf8')
  return /(^|\n)\s*(v|vn|vt|f)\s/.test(head)
}
// STL binário: 80 bytes header + uint32 little-endian (count) + 50 * count bytes
function looksLikeStlBinary(buf: Buffer) {
  if (buf.length < 84) return false
  const count = buf.readUInt32LE(80)
  return buf.length === 84 + 50 * count
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

export async function documentRoutes(fastify: FastifyInstance) {
  fastify.post('/upload/:caseId', { preHandler: authenticate }, async (request, reply) => {
    const { caseId } = request.params as { caseId: string }
    const { type } = request.query as { type: string }
    const user = request.user as JwtPayload

    const caseData = await fastify.prisma.case.findUnique({ where: { id: caseId }, select: { id: true, dentistId: true } })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })
    if (user.role === Role.DENTIST && caseData.dentistId !== user.id) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })

    const ext = path.extname(data.filename).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return reply.status(400).send({ error: `Tipo de arquivo não permitido: ${ext}` })
    }
    if (!ALLOWED_MIME_TYPES.has(data.mimetype)) {
      return reply.status(400).send({ error: `Tipo MIME não permitido: ${data.mimetype}` })
    }

    const buffer = await data.toBuffer()
    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(400).send({ error: 'Arquivo muito grande. Limite: 50 MB' })
    }

    // Validação de magic bytes — bloqueia SVG/HTML disfarçados de imagem etc.
    const detected = await fromBuffer(buffer)
    const isStl = ext === '.stl' && (looksLikeStlAscii(buffer) || looksLikeStlBinary(buffer))
    const isObj = ext === '.obj' && looksLikeObj(buffer)

    if (detected) {
      if (!SAFE_DETECTED_MIMES.has(detected.mime)) {
        return reply.status(400).send({ error: `Conteúdo não permitido (${detected.mime})` })
      }
      // Verifica se o conteúdo bate com a extensão declarada — evita PDF mascarado de JPG
      const expected: Record<string, string[]> = {
        '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'],
        '.png': ['image/png'], '.gif': ['image/gif'], '.webp': ['image/webp'],
        '.pdf': ['application/pdf'], '.zip': ['application/zip'],
        '.mp4': ['video/mp4'], '.webm': ['video/webm'], '.mov': ['video/quicktime'],
      }
      const allowed = expected[ext]
      if (allowed && !allowed.includes(detected.mime)) {
        return reply.status(400).send({ error: `Conteúdo (${detected.mime}) não corresponde à extensão (${ext})` })
      }
    } else if (!isStl && !isObj) {
      return reply.status(400).send({ error: 'Não foi possível validar o conteúdo do arquivo' })
    }

    const { key, url } = await fastify.s3.upload(buffer, data.filename, data.mimetype, `cases/${caseId}`)

    const doc = await fastify.prisma.caseDocument.create({
      data: { caseId, type: type as any, fileName: data.filename, url, size: buffer.length },
    })

    await fastify.audit.log(request, {
      action: 'document.upload',
      resource: 'CaseDocument',
      resourceId: doc.id,
      metadata: { caseId, type, size: buffer.length, mime: data.mimetype, key },
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

    if (user.role === Role.DENTIST && doc.case.dentistId !== user.id) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    await fastify.prisma.caseDocument.delete({ where: { id } })
    await fastify.audit.log(request, { action: 'document.delete', resource: 'CaseDocument', resourceId: id })
    return { success: true }
  })

  // Signed URL: gera link temporário (S3) ou URL local autenticada para o documento.
  // Usa permissões já conferidas em /api/uploads/* (ACL por caso/paciente).
  fastify.get('/:id/signed-url', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user as JwtPayload

    const doc = await fastify.prisma.caseDocument.findUnique({
      where: { id },
      include: { case: { select: { id: true, dentistId: true } } },
    })
    if (!doc) return reply.status(404).send({ error: 'Documento não encontrado' })
    if (user.role === Role.DENTIST && doc.case.dentistId !== user.id) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const url = await fastify.s3.signedUrlForUrl(doc.url, 600) // 10 min
    return { url, expiresInSeconds: 600 }
  })
}
