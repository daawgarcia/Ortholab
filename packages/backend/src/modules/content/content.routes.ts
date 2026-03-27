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
    const page = await fastify.prisma.contentPage.findUnique({ where: { slug } })
    if (!page) return reply.status(404).send({ error: 'Página não encontrada' })
    return { page }
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
    let fileUrl = ''
    let fileName = ''
    let title = slug

    for await (const part of parts) {
      if (part.type === 'file') {
        const chunks: Buffer[] = []
        for await (const chunk of part.file) chunks.push(chunk as Buffer)
        const buffer = Buffer.concat(chunks)
        fileName = part.filename
        try {
          const result = await fastify.s3.upload(buffer, fileName, part.mimetype, `content/${slug}`)
          fileUrl = result.url
        } catch (err) {
          request.log.error(err, 'Erro no upload S3')
          return reply.status(500).send({ error: 'Erro ao fazer upload do arquivo. Verifique a configuração do S3.' })
        }
      } else if (part.fieldname === 'title') {
        title = (part as any).value
      }
    }

    const page = await fastify.prisma.contentPage.upsert({
      where: { slug },
      update: { fileUrl, fileName, updatedById: user.id },
      create: { slug, title, fileUrl, fileName, updatedById: user.id },
    })
    return { page }
  })
}
