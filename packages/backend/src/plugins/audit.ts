import fp from 'fastify-plugin'
import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    audit: AuditService
  }
}

export interface AuditEntry {
  action: string
  resource?: string
  resourceId?: string
  status?: 'OK' | 'DENIED' | 'FAILED'
  metadata?: Record<string, unknown>
}

class AuditService {
  constructor(private app: FastifyInstance) {}

  async log(request: FastifyRequest | null, entry: AuditEntry) {
    try {
      const actor = request?.user as any | undefined
      const ip =
        (request?.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        request?.ip ||
        null
      const userAgent = (request?.headers['user-agent'] as string) || null

      await this.app.prisma.auditLog.create({
        data: {
          actorId: actor?.id ?? null,
          actorEmail: actor?.email ?? null,
          actorRole: actor?.role ?? null,
          action: entry.action,
          resource: entry.resource ?? null,
          resourceId: entry.resourceId ?? null,
          ip: ip ?? null,
          userAgent,
          status: entry.status ?? 'OK',
          metadata: (entry.metadata as any) ?? undefined,
        },
      })
    } catch (err) {
      // Auditoria nunca deve quebrar a request
      this.app.log.error({ err, entry }, 'audit log failed')
    }
  }
}

const auditPlugin: FastifyPluginAsync = fp(async (server) => {
  server.decorate('audit', new AuditService(server))
})

export { auditPlugin, AuditService }
