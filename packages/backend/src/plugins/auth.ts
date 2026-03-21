import { FastifyRequest, FastifyReply } from 'fastify'
import { Role } from '@prisma/client'

export interface JwtPayload {
  id: string
  email: string
  role: Role
  name: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    const payload = request.user as JwtPayload
    request.user = payload
  } catch {
    reply.status(401).send({ error: 'Unauthorized' })
  }
}

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply)
    if (!roles.includes(request.user.role)) {
      reply.status(403).send({ error: 'Forbidden' })
    }
  }
}
