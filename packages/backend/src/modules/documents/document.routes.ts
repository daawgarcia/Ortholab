import { FastifyInstance } from 'fastify'
import { authenticate } from '../../plugins/auth'

export async function documentRoutes(fastify: FastifyInstance) {
  fastify.post('/upload/:caseId', { preHandler: authenticate }, async (request, reply) => {
    const { caseId } = request.params as { caseId: string }
    const { type } = request.query as { type: string }
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })

    const buffer = await data.toBuffer()
    const { key, url } = await fastify.s3.upload(buffer, data.filename, data.mimetype, `cases/${caseId}`)

    const doc = await fastify.prisma.caseDocument.create({
      data: { caseId, type: type as any, fileName: data.filename, url, size: buffer.length },
    })

    return reply.status(201).send({ document: doc })
  })

  fastify.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const doc = await fastify.prisma.caseDocument.findUnique({ where: { id } })
    if (!doc) return reply.status(404).send({ error: 'Documento não encontrado' })
    await fastify.prisma.caseDocument.delete({ where: { id } })
    return { success: true }
  })
}
