import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import nodemailer from 'nodemailer'

declare module 'fastify' {
  interface FastifyInstance {
    mailer: MailerService
  }
}

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
}

class MailerService {
  private transporter: nodemailer.Transporter

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }

  async send(options: EmailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@estheticaligner.com.br',
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
      })
    } catch (err) {
      console.error('Email send error:', err)
    }
  }

  getTemplate(title: string, content: string, ctaUrl?: string, ctaText?: string): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin: 0; padding: 0; background: #f4f6f9; font-family: 'Segoe UI', Arial, sans-serif; }
  .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 32px 40px; text-align: center; }
  .header img { height: 48px; }
  .header h1 { color: #fff; margin: 12px 0 0; font-size: 20px; font-weight: 600; }
  .header span { color: #e94560; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; }
  .body { padding: 36px 40px; }
  .body h2 { color: #1a1a2e; font-size: 18px; margin: 0 0 16px; }
  .body p { color: #555; line-height: 1.7; margin: 0 0 16px; font-size: 15px; }
  .cta { text-align: center; margin: 28px 0; }
  .cta a { background: #e94560; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; }
  .footer { background: #f8f9fa; padding: 20px 40px; text-align: center; border-top: 1px solid #eee; }
  .footer p { color: #999; font-size: 12px; margin: 0; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <span>ESTHETIC ALIGNER</span>
    <h1>Ortholab</h1>
  </div>
  <div class="body">
    <h2>${title}</h2>
    ${content}
    ${ctaUrl ? `<div class="cta"><a href="${ctaUrl}">${ctaText || 'Acessar Ortholab'}</a></div>` : ''}
  </div>
  <div class="footer">
    <p>Esthetic Aligner &mdash; ortholab.estheticaligner.com.br</p>
    <p>Este e-mail foi enviado automaticamente. Por favor, não responda.</p>
  </div>
</div>
</body>
</html>`
  }
}

const mailerPlugin: FastifyPluginAsync = fp(async (server) => {
  server.decorate('mailer', new MailerService())
})

export { mailerPlugin }
