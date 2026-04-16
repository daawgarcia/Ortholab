import { FastifyInstance } from 'fastify'
import { timingSafeEqual } from 'crypto'
import { requireRole } from '../../plugins/auth'
import { Role } from '@prisma/client'

const TOTVS_ENABLED = process.env.TOTVS_ENABLED === 'true'

function validateTotvsSecret(provided: string | string[] | undefined): boolean {
  const expected = process.env.TOTVS_WEBHOOK_SECRET
  if (!expected || !provided || Array.isArray(provided)) return false
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(provided)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function totvsRoutes(fastify: FastifyInstance) {

  // ─── Webhook: TOTVS envia clientes ──────────────────────────────
  fastify.post('/webhooks/clientes', async (request, reply) => {
    if (!validateTotvsSecret(request.headers['x-totvs-secret'])) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const body = request.body as any
    await fastify.prisma.totvsLog.create({
      data: { direction: 'INBOUND', endpoint: '/webhooks/clientes', payload: body, status: 'RECEIVED' },
    })

    return { received: true }
  })

  // ─── Webhook: TOTVS envia títulos/faturas (NFs) ──────────────────
  fastify.post('/webhooks/titulos', async (request, reply) => {
    if (!validateTotvsSecret(request.headers['x-totvs-secret'])) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const body = request.body as any
    await fastify.prisma.totvsLog.create({
      data: { direction: 'INBOUND', endpoint: '/webhooks/titulos', payload: body, status: 'RECEIVED' },
    })

    // Processar os títulos recebidos
    const titulos = Array.isArray(body.titulos) ? body.titulos : (body.titulo ? [body.titulo] : [body])
    const results: Array<{ totvsId: string; status: string; error?: string }> = []

    for (const titulo of titulos) {
      try {
        // Mapear campos TOTVS → Ortholab
        const totvsId = String(titulo.id || titulo.codigoTitulo || titulo.RECNO || '')
        const cnpjDentist = titulo.cnpjCliente || titulo.CNPJ || titulo.cpfCnpj || ''
        const invoiceNumber = titulo.numeroNota || titulo.NUMNOTA || titulo.numero || ''
        const description = titulo.descricao || titulo.DESCTITULO || titulo.historico || `Título ${invoiceNumber}`
        const amount = parseFloat(titulo.valor || titulo.VLRTITULO || titulo.vlrOriginal || 0)
        const dueDate = titulo.vencimento || titulo.DTVENCTO || titulo.dataVencimento
        const caseNumber = titulo.referencia || titulo.NUMCASO || titulo.caseNumber || null

        if (!cnpjDentist && !titulo.dentistId) {
          results.push({ totvsId, status: 'SKIPPED', error: 'Sem CNPJ/dentistId' })
          continue
        }

        // Encontrar dentista pelo CNPJ ou ID direto
        let dentist = null
        if (titulo.dentistId) {
          dentist = await fastify.prisma.user.findUnique({ where: { id: titulo.dentistId } })
        }
        if (!dentist && cnpjDentist) {
          dentist = await fastify.prisma.user.findFirst({
            where: { cnpj: cnpjDentist.replace(/\D/g, ''), role: 'DENTIST' },
          })
        }

        if (!dentist) {
          results.push({ totvsId, status: 'SKIPPED', error: `Dentista não encontrado (CNPJ: ${cnpjDentist})` })
          continue
        }

        // Buscar caseId se tiver referência de caso
        let caseId: string | null = null
        if (caseNumber) {
          const caseData = await fastify.prisma.case.findFirst({
            where: { caseNumber: parseInt(caseNumber), dentistId: dentist.id },
          })
          if (caseData) caseId = caseData.id
        }

        // Upsert: atualizar se já existe, criar se não
        await fastify.prisma.dentistInvoice.upsert({
          where: { totvsId },
          update: {
            invoiceNumber,
            description,
            amount,
            dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: titulo.pago ? 'PAID' : 'OPEN',
            paidAt: titulo.pago ? new Date(titulo.dataPagamento || Date.now()) : null,
          },
          create: {
            dentistId: dentist.id,
            caseId,
            totvsId,
            invoiceNumber,
            description,
            amount,
            dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: titulo.pago ? 'PAID' : 'OPEN',
            paidAt: titulo.pago ? new Date(titulo.dataPagamento || Date.now()) : null,
          },
        })

        results.push({ totvsId, status: 'OK' })
      } catch (err: any) {
        results.push({ totvsId: titulo.id || '?', status: 'ERROR', error: err.message })
      }
    }

    // Atualizar log com resultado
    await fastify.prisma.totvsLog.updateMany({
      where: { endpoint: '/webhooks/titulos', status: 'RECEIVED' },
      data: { status: 'PROCESSED', response: results as any },
    })

    return { received: true, processed: results.length, results }
  })

  // ─── Sync manual: puxa títulos do TOTVS via API ──────────────────
  fastify.post('/sync/titulos', { preHandler: requireRole(Role.ADMIN, Role.FINANCIAL) }, async (request, reply) => {
    if (!TOTVS_ENABLED) {
      return reply.status(400).send({ error: 'Integração TOTVS desabilitada. Ative TOTVS_ENABLED=true.' })
    }

    const baseUrl = process.env.TOTVS_BASE_URL
    const apiKey = process.env.TOTVS_API_KEY

    if (!baseUrl || !apiKey) {
      return reply.status(500).send({ error: 'TOTVS_BASE_URL ou TOTVS_API_KEY não configurados.' })
    }

    const log = await fastify.prisma.totvsLog.create({
      data: { direction: 'OUTBOUND', endpoint: '/sync/titulos', payload: { triggeredBy: (request as any).user.id }, status: 'PENDING' },
    })

    try {
      // Buscar títulos em aberto do TOTVS
      const response = await fetch(`${baseUrl}/api/financeiro/v1/titulos?status=aberto`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errText = await response.text()
        await fastify.prisma.totvsLog.update({ where: { id: log.id }, data: { status: 'ERROR', response: { error: errText } } })
        return reply.status(502).send({ error: `TOTVS retornou ${response.status}: ${errText}` })
      }

      const data = await response.json() as any
      const titulos = data.items || data.titulos || data || []

      // Processar cada título
      let created = 0
      let updated = 0
      let skipped = 0

      for (const titulo of titulos) {
        const cnpj = (titulo.cnpjCliente || titulo.CNPJ || '').replace(/\D/g, '')
        if (!cnpj) { skipped++; continue }

        const dentist = await fastify.prisma.user.findFirst({
          where: { cnpj, role: 'DENTIST' },
        })
        if (!dentist) { skipped++; continue }

        const totvsId = String(titulo.id || titulo.codigoTitulo || titulo.RECNO)
        const existing = await fastify.prisma.dentistInvoice.findFirst({ where: { totvsId } })

        if (existing) {
          await fastify.prisma.dentistInvoice.update({
            where: { id: existing.id },
            data: {
              amount: parseFloat(titulo.valor || titulo.VLRTITULO || 0),
              status: titulo.pago ? 'PAID' : 'OPEN',
              paidAt: titulo.pago ? new Date(titulo.dataPagamento || Date.now()) : null,
            },
          })
          updated++
        } else {
          await fastify.prisma.dentistInvoice.create({
            data: {
              dentistId: dentist.id,
              totvsId,
              invoiceNumber: titulo.numeroNota || titulo.NUMNOTA || `TOTVS-${totvsId}`,
              description: titulo.descricao || titulo.DESCTITULO || `Título TOTVS ${totvsId}`,
              amount: parseFloat(titulo.valor || titulo.VLRTITULO || 0),
              dueDate: titulo.vencimento ? new Date(titulo.vencimento) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          })
          created++
        }
      }

      await fastify.prisma.totvsLog.update({
        where: { id: log.id },
        data: { status: 'SUCCESS', response: { total: titulos.length, created, updated, skipped } },
      })

      return { ok: true, total: titulos.length, created, updated, skipped }
    } catch (err: any) {
      await fastify.prisma.totvsLog.update({
        where: { id: log.id }, data: { status: 'ERROR', response: { error: err.message } },
      })
      return reply.status(500).send({ error: `Erro ao comunicar com TOTVS: ${err.message}` })
    }
  })

  // ─── Status da integração ────────────────────────────────────────
  fastify.get('/status', { preHandler: requireRole(Role.ADMIN) }, async () => {
    const lastSync = await fastify.prisma.totvsLog.findFirst({
      where: { direction: 'OUTBOUND' },
      orderBy: { createdAt: 'desc' },
    })
    const lastWebhook = await fastify.prisma.totvsLog.findFirst({
      where: { direction: 'INBOUND' },
      orderBy: { createdAt: 'desc' },
    })
    return {
      enabled: TOTVS_ENABLED,
      configured: !!process.env.TOTVS_BASE_URL && !!process.env.TOTVS_API_KEY,
      webhookConfigured: !!process.env.TOTVS_WEBHOOK_SECRET,
      lastSync: lastSync ? { status: lastSync.status, at: lastSync.createdAt, response: lastSync.response } : null,
      lastWebhook: lastWebhook ? { status: lastWebhook.status, at: lastWebhook.createdAt } : null,
    }
  })

  // ─── Consulta caso para TOTVS ────────────────────────────────────
  fastify.get('/cases/:id', { preHandler: requireRole(Role.ADMIN, Role.FINANCIAL) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const caseData = await fastify.prisma.case.findUnique({
      where: { id },
      include: { dentist: true, service: { include: { prices: { take: 1, orderBy: { validFrom: 'desc' } } } }, financial: true, payment: true },
    })
    if (!caseData) return reply.status(404).send({ error: 'Caso não encontrado' })
    return { case: caseData }
  })

  // ─── Logs de integração ──────────────────────────────────────────
  fastify.get('/logs', { preHandler: requireRole(Role.ADMIN) }, async () => {
    const logs = await fastify.prisma.totvsLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    return { logs }
  })
}
