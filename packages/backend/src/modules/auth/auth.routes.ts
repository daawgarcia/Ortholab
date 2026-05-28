import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { Role, UserStatus } from '@prisma/client'
import { authenticate, JwtPayload } from '../../plugins/auth'

// Política de senha: mínimo 10 chars, ao menos 1 maiúscula, 1 minúscula, 1 número e 1 símbolo.
const PASSWORD_POLICY = z
  .string()
  .min(10, 'A senha deve ter no mínimo 10 caracteres')
  .max(128, 'A senha deve ter no máximo 128 caracteres')
  .refine((v) => /[A-Z]/.test(v), 'Inclua ao menos uma letra maiúscula')
  .refine((v) => /[a-z]/.test(v), 'Inclua ao menos uma letra minúscula')
  .refine((v) => /[0-9]/.test(v), 'Inclua ao menos um número')
  .refine((v) => /[^A-Za-z0-9]/.test(v), 'Inclua ao menos um caractere especial')

// Auto-cadastro público é sempre como DENTIST PENDING.
// Criação de outros perfis ocorre apenas via /api/admin/users.
const registerSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: PASSWORD_POLICY,
  cro: z.string().optional(),
  clinic: z.string().optional(),
  cnpj: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
})

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hora
const FAKE_BCRYPT_HASH =
  '$2a$12$CwTycUXWue0Thq9StjUM0uJ8ePF8vYJeQ9NfXGHQjQqcZrQHfkX9C' // valor inerte só p/ uniformizar tempo

function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex')
}

function safeStringEq(a: string, b: string) {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', async (request, reply) => {
    const data = registerSchema.parse(request.body)

    const existing = await fastify.prisma.user.findUnique({ where: { email: data.email } })
    if (existing) {
      // Resposta genérica para evitar enumeração de e-mails
      return reply.status(202).send({ message: 'Cadastro recebido. Se o e-mail for válido, você receberá retorno por e-mail.' })
    }

    const hashedPassword = await bcrypt.hash(data.password, 12)

    // Sempre DENTIST PENDING — outros perfis só via /api/admin/users
    const user = await fastify.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        role: Role.DENTIST,
        status: UserStatus.PENDING,
      } as any,
      select: { id: true, name: true, email: true, role: true, status: true },
    })

    await fastify.audit.log(request, {
      action: 'auth.register',
      resource: 'User',
      resourceId: user.id,
      metadata: { email: user.email },
    })

    return reply
      .status(202)
      .send({ message: 'Cadastro recebido. Se o e-mail for válido, você receberá retorno por e-mail.' })
  })

  fastify.post('/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Credenciais inválidas' })
    }
    const { email, password } = parsed.data

    const user = await fastify.prisma.user.findUnique({ where: { email } })

    // Compara mesmo se usuário não existir, para uniformizar tempo
    if (!user) {
      await bcrypt.compare(password, FAKE_BCRYPT_HASH)
      await fastify.audit.log(request, { action: 'auth.login', status: 'FAILED', metadata: { email, reason: 'user_not_found' } })
      return reply.status(401).send({ error: 'Credenciais inválidas' })
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await fastify.audit.log(request, {
        action: 'auth.login',
        status: 'DENIED',
        resource: 'User',
        resourceId: user.id,
        metadata: { reason: 'locked', until: user.lockedUntil },
      })
      return reply.status(423).send({
        error: `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em ${Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)} minuto(s).`,
      })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      const attempts = (user.failedLoginAttempts ?? 0) + 1
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : attempts,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null,
        },
      })
      await fastify.audit.log(request, {
        action: 'auth.login',
        status: 'FAILED',
        resource: 'User',
        resourceId: user.id,
        metadata: { attempts, locked: shouldLock },
      })
      return reply.status(401).send({ error: 'Credenciais inválidas' })
    }

    if (user.status === UserStatus.PENDING) {
      return reply.status(403).send({ error: 'Cadastro aguardando aprovação do administrador' })
    }
    if (user.status === UserStatus.INACTIVE) {
      return reply.status(403).send({ error: 'Conta desativada. Entre em contato com o suporte.' })
    }

    // Sucesso — zera contadores
    if ((user.failedLoginAttempts ?? 0) > 0 || user.lockedUntil) {
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      })
    }

    const accessToken = fastify.tokens.signAccess(user)
    const refreshToken = fastify.tokens.signRefresh(user)

    const unreadPushes = await fastify.prisma.pushNotification.findMany({
      where: {
        AND: [
          {
            OR: [
              { targetType: 'ALL' },
              { targetType: 'ROLE', targetId: user.role },
              { targetType: 'USER', targetId: user.id },
              { targetType: 'SELLER_PORTFOLIO', createdBy: { sellerClients: { some: { clientId: user.id } } } },
            ],
          },
          { reads: { none: { userId: user.id } } },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })

    await fastify.audit.log(request, {
      action: 'auth.login',
      status: 'OK',
      resource: 'User',
      resourceId: user.id,
    })

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role, name: user.name, mustChangePassword: user.mustChangePassword },
      pendingPushes: unreadPushes,
    }
  })

  fastify.post('/refresh', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { refreshToken } = (request.body || {}) as { refreshToken?: string }
    if (!refreshToken) return reply.status(401).send({ error: 'Token inválido' })

    try {
      const payload = fastify.tokens.verifyRefresh(refreshToken)

      const user = await fastify.prisma.user.findUnique({ where: { id: payload.id } })
      if (!user || user.status !== UserStatus.ACTIVE) {
        return reply.status(401).send({ error: 'Token inválido' })
      }
      if ((user.tokenVersion ?? 0) !== (payload.tv ?? 0)) {
        return reply.status(401).send({ error: 'Sessão revogada' })
      }

      const accessToken = fastify.tokens.signAccess(user)
      return { accessToken }
    } catch {
      return reply.status(401).send({ error: 'Token inválido ou expirado' })
    }
  })

  fastify.post(
    '/forgot-password',
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const { email } = ((request.body as any) || {}) as { email?: string }
      const startedAt = Date.now()

      // Resposta genérica e tempo mínimo constante para reduzir enumeração
      const respond = async () => {
        const elapsed = Date.now() - startedAt
        const minMs = 800
        if (elapsed < minMs) await new Promise((r) => setTimeout(r, minMs - elapsed))
        return reply.send({ message: 'Se o e-mail existir, você receberá as instruções.' })
      }

      if (!email || typeof email !== 'string') return respond()

      const user = await fastify.prisma.user.findUnique({ where: { email } })
      if (!user) return respond()

      const rawToken = randomBytes(32).toString('hex')
      const tokenHash = hashToken(rawToken)
      const expiry = new Date(Date.now() + RESET_TOKEN_TTL_MS)

      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { resetPasswordToken: tokenHash, resetPasswordExpiry: expiry },
      })

      const resetUrl = `${process.env.APP_URL || ''}/reset-password?token=${rawToken}`
      try {
        await fastify.mailer.send({
          to: email,
          subject: 'Redefinição de senha - Ortholab',
          html: fastify.mailer.getTemplate(
            'Redefinição de senha',
            `<p>Olá, ${user.name}!</p><p>Clique no botão abaixo para redefinir sua senha. O link expira em 1 hora.</p>`,
            resetUrl,
            'Redefinir Senha'
          ),
        })
      } catch (err) {
        fastify.log.error({ err }, 'reset password email failed')
      }

      await fastify.audit.log(request, {
        action: 'auth.forgot_password',
        resource: 'User',
        resourceId: user.id,
      })

      return respond()
    }
  )

  fastify.post(
    '/reset-password',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const body = (request.body as any) || {}
      const token = String(body.token || '')
      const password = String(body.password || '')

      const passwordCheck = PASSWORD_POLICY.safeParse(password)
      if (!passwordCheck.success) {
        return reply.status(400).send({ error: passwordCheck.error.issues[0]?.message || 'Senha fraca' })
      }
      if (!token || token.length < 32) {
        return reply.status(400).send({ error: 'Token inválido ou expirado' })
      }

      const tokenHash = hashToken(token)
      const user = await fastify.prisma.user.findFirst({
        where: { resetPasswordToken: tokenHash, resetPasswordExpiry: { gt: new Date() } },
      })
      if (!user || !user.resetPasswordToken || !safeStringEq(user.resetPasswordToken, tokenHash)) {
        return reply.status(400).send({ error: 'Token inválido ou expirado' })
      }

      const hashedPassword = await bcrypt.hash(password, 12)
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpiry: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
          tokenVersion: { increment: 1 },
          passwordChangedAt: new Date(),
          mustChangePassword: false,
        },
      })

      await fastify.audit.log(request, {
        action: 'auth.reset_password',
        status: 'OK',
        resource: 'User',
        resourceId: user.id,
      })

      return { message: 'Senha redefinida com sucesso' }
    }
  )

  fastify.post('/change-password', { preHandler: authenticate }, async (request, reply) => {
    const body = (request.body as any) || {}
    const currentPassword = String(body.currentPassword || '')
    const newPassword = String(body.newPassword || '')

    const me = request.user as JwtPayload
    const user = await fastify.prisma.user.findUnique({ where: { id: me.id } })
    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado' })

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) {
      await fastify.audit.log(request, { action: 'auth.change_password', status: 'FAILED', resource: 'User', resourceId: user.id })
      return reply.status(400).send({ error: 'Senha atual incorreta' })
    }

    const passwordCheck = PASSWORD_POLICY.safeParse(newPassword)
    if (!passwordCheck.success) {
      return reply.status(400).send({ error: passwordCheck.error.issues[0]?.message || 'Senha fraca' })
    }
    if (newPassword === currentPassword) {
      return reply.status(400).send({ error: 'A nova senha deve ser diferente da atual' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)
    await fastify.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      },
    })

    await fastify.audit.log(request, { action: 'auth.change_password', status: 'OK', resource: 'User', resourceId: user.id })

    return { message: 'Senha alterada com sucesso. Faça login novamente.' }
  })

  fastify.get('/me', { preHandler: authenticate }, async (request) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: (request.user as JwtPayload).id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        cro: true,
        clinic: true,
        cnpj: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        createdAt: true,
        mustChangePassword: true,
      },
    })
    return { user }
  })

  fastify.post('/logout', { preHandler: authenticate }, async (request) => {
    // Logout server-side: incrementa tokenVersion, invalidando todos os tokens existentes deste usuário.
    const me = request.user as JwtPayload
    await fastify.prisma.user.update({
      where: { id: me.id },
      data: { tokenVersion: { increment: 1 } },
    })
    await fastify.audit.log(request, { action: 'auth.logout', resource: 'User', resourceId: me.id })
    return { message: 'Logout realizado com sucesso' }
  })
}
