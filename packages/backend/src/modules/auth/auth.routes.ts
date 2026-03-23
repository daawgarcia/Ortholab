import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { Role, UserStatus } from '@prisma/client'
import { authenticate, JwtPayload } from '../../plugins/auth'

const registerSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(Role).optional(),
  cro: z.string().optional(),
  clinic: z.string().optional(),
  cnpj: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  deliveryAddress: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', async (request, reply) => {
    const data = registerSchema.parse(request.body)
    
    const existing = await fastify.prisma.user.findUnique({ where: { email: data.email } })
    if (existing) {
      return reply.status(400).send({ error: 'Email já cadastrado' })
    }

    const hashedPassword = await bcrypt.hash(data.password, 12)
    const role = data.role || Role.DENTIST
    const status = role === Role.DENTIST ? UserStatus.PENDING : UserStatus.ACTIVE

    const user = await fastify.prisma.user.create({
      data: { ...data, password: hashedPassword, role, status } as any,
      select: { id: true, name: true, email: true, role: true, status: true },
    })

    return reply.status(201).send({ user, message: 'Cadastro realizado. Aguarde aprovação do administrador.' })
  })

  fastify.post('/login', async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body)

    const user = await fastify.prisma.user.findUnique({ where: { email } })
    if (!user) return reply.status(401).send({ error: 'Credenciais inválidas' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return reply.status(401).send({ error: 'Credenciais inválidas' })

    if (user.status === UserStatus.PENDING) {
      return reply.status(403).send({ error: 'Cadastro aguardando aprovação do administrador' })
    }
    if (user.status === UserStatus.INACTIVE) {
      return reply.status(403).send({ error: 'Conta desativada. Entre em contato com o suporte.' })
    }

    const payload = { id: user.id, email: user.email, role: user.role, name: user.name }
    const accessToken = fastify.jwt.sign(payload, { expiresIn: '15m' })
    const refreshToken = fastify.jwt.sign({ id: user.id } as any, { expiresIn: '7d' })

    const unreadPushes = await fastify.prisma.pushNotification.findMany({
      where: {
        AND: [
          { OR: [
            { targetType: 'ALL' },
            { targetType: 'ROLE', targetId: user.role },
            { targetType: 'USER', targetId: user.id },
            { targetType: 'SELLER_PORTFOLIO', createdBy: { sellerClients: { some: { clientId: user.id } } } },
          ]},
          { reads: { none: { userId: user.id } } },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        ]
      },
      orderBy: { createdAt: 'desc' },
    })

    return { accessToken, refreshToken, user: payload, pendingPushes: unreadPushes }
  })

  fastify.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string }
    try {
      const payload = fastify.jwt.verify<{ id: string }>(refreshToken)
      const user = await fastify.prisma.user.findUnique({ where: { id: payload.id } })
      if (!user || user.status !== UserStatus.ACTIVE) {
        return reply.status(401).send({ error: 'Token inválido' })
      }
      const newPayload = { id: user.id, email: user.email, role: user.role, name: user.name }
      const accessToken = fastify.jwt.sign(newPayload, { expiresIn: '15m' })
      return { accessToken }
    } catch {
      return reply.status(401).send({ error: 'Token inválido ou expirado' })
    }
  })

  fastify.post('/forgot-password', async (request, reply) => {
    const { email } = request.body as { email: string }
    const user = await fastify.prisma.user.findUnique({ where: { email } })
    if (!user) return { message: 'Se o e-mail existir, você receberá as instruções.' }

    const token = require('crypto').randomBytes(32).toString('hex')
    const expiry = new Date(Date.now() + 60 * 60 * 1000)

    await fastify.prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordToken: token, resetPasswordExpiry: expiry },
    })

    const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`
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

    return { message: 'Se o e-mail existir, você receberá as instruções.' }
  })

  fastify.post('/reset-password', async (request, reply) => {
    const { token, password } = request.body as { token: string; password: string }
    
    const user = await fastify.prisma.user.findFirst({
      where: { resetPasswordToken: token, resetPasswordExpiry: { gt: new Date() } },
    })
    if (!user) return reply.status(400).send({ error: 'Token inválido ou expirado' })

    const hashedPassword = await bcrypt.hash(password, 12)
    await fastify.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, resetPasswordToken: null, resetPasswordExpiry: null },
    })

    return { message: 'Senha redefinida com sucesso' }
  })

  fastify.get('/me', { preHandler: authenticate }, async (request) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: (request.user as JwtPayload).id },
      select: { id: true, name: true, email: true, role: true, status: true, cro: true, clinic: true, cnpj: true, phone: true, address: true, city: true, state: true, zipCode: true, createdAt: true },
    })
    return { user }
  })

  fastify.post('/logout', { preHandler: authenticate }, async (request, reply) => {
    // Com JWT stateless, logout é apenas confirmação no frontend
    // Poderia implementar blacklist em Redis se necessário
    return { message: 'Logout realizado com sucesso' }
  })
}
