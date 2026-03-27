import { FastifyInstance } from 'fastify'
import { requireRole } from '../../plugins/auth'
import { Role } from '@prisma/client'

export async function contentRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    const pages = await fastify.prisma.contentPage.findMany({ orderBy: { slug: 'asc' } })
    return { pages }
  })

  fastify.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const page = await fastify.prisma.contentPage.findUnique({
      where: { slug },
      select: { id: true, slug: true, title: true, body: true, fileUrl: true, fileName: true, fileMime: true, updatedAt: true, updatedById: true },
    })
    if (!page) return reply.status(404).send({ error: 'Página não encontrada' })
    return { page }
  })

  // Serve o arquivo armazenado no banco
  fastify.get('/:slug/file', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const page = await fastify.prisma.contentPage.findUnique({
      where: { slug },
      select: { fileData: true, fileName: true, fileMime: true },
    })
    if (!page || !page.fileData) return reply.status(404).send({ error: 'Arquivo não encontrado' })

    reply
      .header('Content-Type', page.fileMime || 'application/octet-stream')
      .header('Content-Disposition', `inline; filename="${page.fileName || 'arquivo'}"`)
      .send(page.fileData)
  })

  fastify.put('/:slug', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const body = request.body as any
    const user = (request as any).user

    const page = await fastify.prisma.contentPage.upsert({
      where: { slug },
      update: { ...body, updatedById: user.id },
      create: { slug, title: body.title || slug, body: body.body, fileUrl: body.fileUrl, fileName: body.fileName, updatedById: user.id },
    })
    return { page }
  })

  fastify.post('/:slug/upload', { preHandler: requireRole(Role.ADMIN) }, async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const user = (request as any).user

    const parts = request.parts()
    let fileData: Buffer | null = null
    let fileName = ''
    let fileMime = ''
    let title = slug

    for await (const part of parts) {
      if (part.type === 'file') {
        const chunks: Buffer[] = []
        for await (const chunk of part.file) chunks.push(chunk as Buffer)
        fileData = Buffer.concat(chunks)
        fileName = part.filename
        fileMime = part.mimetype
      } else if (part.fieldname === 'title') {
        title = (part as any).value
      }
    }

    if (!fileData) {
      return reply.status(400).send({ error: 'Nenhum arquivo enviado' })
    }

    const fileUrl = `/api/content/${slug}/file`

    const page = await fastify.prisma.contentPage.upsert({
      where: { slug },
      update: { fileUrl, fileName, fileMime, fileData, updatedById: user.id },
      create: { slug, title, fileUrl, fileName, fileMime, fileData, updatedById: user.id },
    })
    return { page: { id: page.id, slug: page.slug, title: page.title, body: page.body, fileUrl: page.fileUrl, fileName: page.fileName, fileMime: page.fileMime, updatedAt: page.updatedAt } }
  })
}
