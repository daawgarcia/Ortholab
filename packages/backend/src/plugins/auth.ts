import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import jwt from 'jsonwebtoken'
import { Role } from '@prisma/client'

declare module 'fastify' {
  interface FastifyInstance {
    tokens: TokenService
  }
}

export interface AccessTokenPayload {
  id: string
  email: string
  role: Role
  name: string
  type: 'access'
  tv: number
}

export interface RefreshTokenPayload {
  id: string
  type: 'refresh'
  tv: number
}

// Compatível com o tipo antigo usado em todo o backend
export type JwtPayload = AccessTokenPayload

class TokenService {
  private accessSecret: string
  private refreshSecret: string
  private accessTtl: string
  private refreshTtl: string

  constructor() {
    this.accessSecret = process.env.JWT_SECRET || ''
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || this.accessSecret
    this.accessTtl = process.env.JWT_EXPIRES_IN || '15m'
    this.refreshTtl = process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  }

  signAccess(user: { id: string; email: string; role: Role; name: string; tokenVersion: number }, ttl?: string) {
    const payload: AccessTokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      type: 'access',
      tv: user.tokenVersion ?? 0,
    }
    return jwt.sign(payload, this.accessSecret, { expiresIn: (ttl || this.accessTtl) as any })
  }

  signRefresh(user: { id: string; tokenVersion: number }) {
    const payload: RefreshTokenPayload = { id: user.id, type: 'refresh', tv: user.tokenVersion ?? 0 }
    return jwt.sign(payload, this.refreshSecret, { expiresIn: this.refreshTtl as any })
  }

  verifyAccess(token: string): AccessTokenPayload {
    const decoded = jwt.verify(token, this.accessSecret) as AccessTokenPayload
    if (decoded.type !== 'access') throw new Error('Invalid token type')
    return decoded
  }

  verifyRefresh(token: string): RefreshTokenPayload {
    const decoded = jwt.verify(token, this.refreshSecret) as RefreshTokenPayload
    if (decoded.type !== 'refresh') throw new Error('Invalid token type')
    return decoded
  }
}

const tokenPlugin: FastifyPluginAsync = fp(async (server) => {
  server.decorate('tokens', new TokenService())
})

/**
 * Valida o access token, hidrata request.user e checa tokenVersion no banco
 * para invalidar sessões após troca de senha / logout global.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const auth = request.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const token = auth.slice('Bearer '.length).trim()
    const decoded = (request.server as any).tokens.verifyAccess(token) as AccessTokenPayload

    const user = await request.server.prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, name: true, status: true, tokenVersion: true },
    })

    if (!user || user.status !== 'ACTIVE') {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    if ((user.tokenVersion ?? 0) !== (decoded.tv ?? 0)) {
      return reply.status(401).send({ error: 'Sessão expirada — faça login novamente' })
    }

    ;(request as any).user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      type: 'access',
      tv: user.tokenVersion ?? 0,
    } satisfies AccessTokenPayload
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply)
    if (reply.sent) return
    const user = request.user as JwtPayload
    if (!roles.includes(user.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
  }
}

export { tokenPlugin }
