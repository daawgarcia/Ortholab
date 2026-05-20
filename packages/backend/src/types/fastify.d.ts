import { PrismaClient } from '@prisma/client'
import { FastifyInstance } from 'fastify'
import { AuditService } from './plugins/audit'
import { S3Service } from './plugins/s3'
import { MailerService } from './plugins/mailer'
import { RedeService } from './plugins/rede'
import { PixService } from './plugins/pix'
import { TokenService, AccessTokenPayload } from './plugins/auth'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
    audit: AuditService
    s3: S3Service
    mailer: MailerService
    rede: RedeService
    pix: PixService
    tokens: TokenService
  }

  interface FastifyRequest {
    user: AccessTokenPayload
  }
}
