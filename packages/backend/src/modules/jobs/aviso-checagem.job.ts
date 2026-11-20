import { FastifyInstance } from 'fastify'

/**
 * Aviso automático da Checagem Virtual 3D: quando o caso está aguardando aprovação há 25 dias
 * (a partir de 30 dias a checagem passa a ser cobrada — R$ 320), envia e-mail e notificação ao dentista.
 * Só avisa casos entre 25 e 30 dias (não dispara para casos antigos importados) e uma vez por envio.
 */
export function startAvisoChecagemJob(fastify: FastifyInstance) {
  const rodar = () => verificar(fastify).catch(err => fastify.log.error(err, '[aviso-checagem]'))
  setTimeout(rodar, 60_000)
  const t = setInterval(rodar, 60 * 60 * 1000)
  return () => clearInterval(t)
}

async function verificar(fastify: FastifyInstance) {
  const agora = Date.now()
  const casos = await fastify.prisma.case.findMany({
    where: { status: 'WAITING_APPROVAL' as any },
    select: {
      id: true, caseNumber: true, patientName: true, patientId: true, dentistId: true, avisoChecagemEm: true,
      dentist: { select: { name: true, email: true } },
      workflowEvents: { where: { stage: 4 }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
    },
  })
  let enviados = 0
  for (const c of casos) {
    const enviadoEm = c.workflowEvents[0]?.createdAt
    if (!enviadoEm) continue
    const dias = (agora - enviadoEm.getTime()) / 86400000
    if (dias < 25 || dias >= 30) continue
    if (c.avisoChecagemEm && c.avisoChecagemEm > enviadoEm) continue
    const prazo = new Date(enviadoEm.getTime() + 30 * 86400000).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const link = `${process.env.FRONTEND_URL || ''}/patients/${c.patientId}`
    if (c.dentist?.email && !c.dentist.email.endsWith('.local')) {
      await fastify.mailer.send({
        to: c.dentist.email,
        subject: `Checagem 3D aguardando sua aprovação — ${c.patientName}`,
        html: `<p>Olá, ${c.dentist.name}.</p>
<p>A Checagem Virtual 3D do paciente <strong>${c.patientName}</strong> está aguardando sua aprovação há 25 dias.</p>
<p>Aprovando até <strong>${prazo}</strong>, a checagem continua inclusa. Depois desse prazo é cobrada a taxa de R$ 320,00.</p>
<p><a href="${link}">Clique aqui para ver e aprovar o caso</a></p>
<p>Equipe Esthetic Aligner</p>`,
      }).catch(err => fastify.log.error(err, '[aviso-checagem] e-mail'))
    }
    await fastify.prisma.notification.create({
      data: {
        userId: c.dentistId,
        title: 'Checagem 3D aguardando aprovação',
        message: `${c.patientName}: aprove até ${prazo} para não ter a cobrança da checagem (R$ 320).`,
        link: `/patients/${c.patientId}`,
      },
    }).catch(() => {})
    await fastify.prisma.case.update({ where: { id: c.id }, data: { avisoChecagemEm: new Date() } })
    enviados++
  }
  if (enviados) fastify.log.info(`[aviso-checagem] ${enviados} aviso(s) enviado(s)`)
}
