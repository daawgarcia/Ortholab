import { FastifyInstance } from 'fastify'
import { authenticate, requireRole, JwtPayload } from '../../plugins/auth'
import { CaseStatus, Role } from '@prisma/client'
import { EventMailer } from '../mailer/event-mailer'

export async function planningRoutes(fastify: FastifyInstance) {
  const mailer = new EventMailer(fastify)

  fastify.post('/', { preHandler: requireRole(Role.LAB_TECH, Role.ADMIN) }, async (request, reply) => {
    const { caseId, notes, alignerUpper, alignerLower } = request.body as any

    const planning = await fastify.prisma.planning.create({
      data: { caseId, labTechId: (request.user as JwtPayload).id, notes, alignerUpper, alignerLower },
    })

    await fastify.prisma.case.update({ where: { id: caseId }, data: { status: CaseStatus.IN_PLANNING } })
    await fastify.prisma.caseActivity.create({
      data: { caseId, userId: (request.user as JwtPayload).id, action: 'PLANNING_STARTED', description: 'Planejamento iniciado pelo laboratório' },
    })

    const caseData = await fastify.prisma.case.findUnique({ where: { id: caseId }, include: { dentist: true } })
    if (caseData) await mailer.onCasePlanningStarted(caseData)

    return reply.status(201).send({ planning })
  })

  fastify.patch('/:id/submit-setup', { preHandler: requireRole(Role.LAB_TECH, Role.ADMIN) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = await request.file()

    const planning = await fastify.prisma.planning.findUnique({ where: { id }, include: { case: { include: { dentist: true } } } })
    if (!planning) return reply.status(404).send({ error: 'Planejamento não encontrado' })

    let setupUrl = (request.body as any)?.setupUrl
    let setupFileName: string | undefined

    if (data) {
      const buffer = await data.toBuffer()
      const result = await fastify.s3.upload(buffer, data.filename, data.mimetype, `setups/${planning.caseId}`)
      setupUrl = result.url
      setupFileName = data.filename
    }

    await fastify.prisma.planning.update({ where: { id }, data: { setupUrl, setupFileName } })
    await fastify.prisma.case.update({ where: { id: planning.caseId }, data: { status: CaseStatus.WAITING_APPROVAL } })
    await fastify.prisma.caseActivity.create({
      data: { caseId: planning.caseId, userId: (request.user as JwtPayload).id, action: 'SETUP_READY', description: 'Setup enviado para aprovação do dentista' },
    })

    if (planning.case) await mailer.onSetupReady(planning.case)

    return { message: 'Setup enviado com sucesso' }
  })
}
