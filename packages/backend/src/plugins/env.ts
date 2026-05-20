import { z } from 'zod'

/**
 * Validação obrigatória das variáveis de ambiente no boot do backend.
 * Falha rápido (process.exit) se algo crítico estiver ausente em produção.
 */

const isProd = process.env.NODE_ENV === 'production'

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().regex(/^\d+$/).default('3001'),

  DATABASE_URL: z.string().url(),

  // Segredos: mínimo 16 chars em qualquer ambiente (o Render gera valores curtos).
  // Recomendamos 32+ em produção, mas não bloqueamos o boot por isso.
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // URLs principais
  FRONTEND_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),

  // SMTP — apenas avisado se ausente em prod
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().regex(/^\d+$/).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // S3 — em prod o backend só usa storage privado se configurado
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),

  // Webhooks — opcionais. Sem segredo, os handlers rejeitam com 503.
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  REDE_WEBHOOK_AUTH: z.string().optional(),

  REDE_PV: z.string().optional(),
  REDE_TOKEN: z.string().optional(),
  REDE_ENV: z.enum(['sandbox', 'production']).optional(),

  TOTVS_ENABLED: z.string().optional(),
  TOTVS_BASE_URL: z.string().optional(),
  TOTVS_API_KEY: z.string().optional(),
  TOTVS_WEBHOOK_SECRET: z.string().optional(),

  PIX_KEY: z.string().optional(),
  PIX_MERCHANT_NAME: z.string().optional(),
  PIX_MERCHANT_CITY: z.string().optional(),

  API_PUBLIC_URL: z.string().optional(),
  BACKEND_URL: z.string().optional(),
  RENDER_EXTERNAL_URL: z.string().optional(),
})

export type AppEnv = z.infer<typeof baseSchema>

export function validateEnv(): AppEnv {
  const result = baseSchema.safeParse(process.env)

  if (!result.success) {
    console.error('❌ Variáveis de ambiente inválidas:')
    for (const issue of result.error.issues) {
      console.error(`  • ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  // Avisos não-fatais
  const env = result.data
  const warn = (msg: string) => console.warn(`⚠️  ${msg}`)

  if (env.NODE_ENV === 'production') {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
      warn('SMTP não configurado: e-mails de reset de senha falharão silenciosamente')
    }
    if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) {
      warn('S3 não configurado: uploads cairão em disco local (não persistente em PaaS)')
    }
    if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
      console.error('❌ JWT_SECRET e JWT_REFRESH_SECRET devem ser DIFERENTES em produção')
      process.exit(1)
    }
    if (!env.FRONTEND_URL) warn('FRONTEND_URL ausente — CORS bloqueará todas as origens')
    if (!env.APP_URL) warn('APP_URL ausente — links de e-mail (reset de senha) ficarão quebrados')
  }

  return env
}
