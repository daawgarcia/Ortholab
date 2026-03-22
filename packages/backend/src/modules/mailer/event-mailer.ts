import { FastifyInstance } from 'fastify'

export class EventMailer {
  constructor(private fastify: FastifyInstance) {}

  private get mailer() { return this.fastify.mailer }
  private get prisma() { return this.fastify.prisma }

  private caseLink(caseId: string) {
    return `${process.env.APP_URL}/cases/${caseId}`
  }

  private async getAdminEmails(): Promise<string[]> {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { email: true },
    })
    return admins.map(a => a.email)
  }

  private async getLabEmails(): Promise<string[]> {
    const labs = await this.prisma.user.findMany({
      where: { role: 'LAB_TECH', status: 'ACTIVE' },
      select: { email: true },
    })
    return labs.map(l => l.email)
  }

  private async getFinancialEmails(): Promise<string[]> {
    const financial = await this.prisma.user.findMany({
      where: { role: 'FINANCIAL', status: 'ACTIVE' },
      select: { email: true },
    })
    return financial.map(f => f.email)
  }

  private async getSellerEmailsForDentist(dentistId: string): Promise<string[]> {
    const sellers = await this.prisma.sellerClient.findMany({
      where: { clientId: dentistId },
      include: { seller: { select: { email: true } } },
    })
    return sellers.map(s => s.seller.email)
  }

  private async logEmail(event: string, recipients: string[], subject: string, caseId?: string) {
    await this.prisma.emailLog.create({
      data: { event, recipients, subject, caseId, status: 'SENT' },
    }).catch(console.error)
  }

  async onCaseSubmitted(caseData: any) {
    const adminEmails = await this.getAdminEmails()
    const labEmails = await this.getLabEmails()
    const sellerEmails = await this.getSellerEmailsForDentist(caseData.dentistId)
    const recipients = [...new Set([...adminEmails, ...labEmails, ...sellerEmails])]
    if (!recipients.length) return

    const subject = `Novo caso submetido - ${caseData.patientName} (${caseData.dentist?.clinic || caseData.dentist?.name})`
    const html = this.mailer.getTemplate(
      'Novo caso recebido',
      `<p>Um novo caso foi submetido pelo Dr(a). <strong>${caseData.dentist?.name}</strong>.</p>
       <p><strong>Paciente:</strong> ${caseData.patientName}<br/>
       <strong>Clínica:</strong> ${caseData.dentist?.clinic || '-'}<br/>
       <strong>Serviço:</strong> ${caseData.service?.name || '-'}</p>`,
      this.caseLink(caseData.id), 'Ver Caso'
    )
    await this.mailer.send({ to: recipients, subject, html })
    await this.logEmail('CASE_SUBMITTED', recipients, subject, caseData.id)
  }

  async onCasePlanningStarted(caseData: any) {
    const subject = `Seu caso está em planejamento - ${caseData.patientName}`
    const html = this.mailer.getTemplate(
      'Caso em planejamento',
      `<p>Olá Dr(a). <strong>${caseData.dentist?.name}</strong>,</p>
       <p>O caso do paciente <strong>${caseData.patientName}</strong> foi recebido e está sendo planejado pela nossa equipe. Em breve você receberá o setup para aprovação.</p>`,
      this.caseLink(caseData.id), 'Acompanhar Caso'
    )
    await this.mailer.send({ to: caseData.dentist?.email, subject, html })
    await this.logEmail('PLANNING_STARTED', [caseData.dentist?.email], subject, caseData.id)
  }

  async onSetupReady(caseData: any) {
    const subject = `Setup pronto para aprovação - ${caseData.patientName}`
    const html = this.mailer.getTemplate(
      'Setup pronto para aprovação',
      `<p>Olá Dr(a). <strong>${caseData.dentist?.name}</strong>,</p>
       <p>O planejamento do caso <strong>${caseData.patientName}</strong> está pronto! Acesse o Ortholab para visualizar e aprovar o setup.</p>`,
      this.caseLink(caseData.id), 'Visualizar e Aprovar'
    )
    await this.mailer.send({ to: caseData.dentist?.email, subject, html })
    await this.logEmail('SETUP_READY', [caseData.dentist?.email], subject, caseData.id)
  }

  async onRevisionRequested(caseData: any, notes: string) {
    const labEmails = await this.getLabEmails()
    const adminEmails = await this.getAdminEmails()
    const recipients = [...new Set([...labEmails, ...adminEmails])]

    const subject = `Revisão solicitada - ${caseData.patientName}`
    const html = this.mailer.getTemplate(
      'Revisão solicitada pelo dentista',
      `<p>O Dr(a). <strong>${caseData.dentist?.name}</strong> solicitou uma revisão no caso de <strong>${caseData.patientName}</strong>.</p>
       <p><strong>Observações:</strong></p><p style="background:#f8f9fa;padding:12px;border-radius:8px;border-left:4px solid #e94560;">${notes}</p>`,
      this.caseLink(caseData.id), 'Ver Caso'
    )
    await this.mailer.send({ to: recipients, subject, html })
    await this.logEmail('REVISION_REQUESTED', recipients, subject, caseData.id)
  }

  async onCaseApproved(caseData: any) {
    const labEmails = await this.getLabEmails()
    const adminEmails = await this.getAdminEmails()
    const financialEmails = await this.getFinancialEmails()
    const recipients = [...new Set([...labEmails, ...adminEmails, ...financialEmails])]

    const subject = `Caso aprovado pelo dentista - ${caseData.patientName}`
    const html = this.mailer.getTemplate(
      'Caso aprovado!',
      `<p>O Dr(a). <strong>${caseData.dentist?.name}</strong> aprovou o planejamento do caso <strong>${caseData.patientName}</strong>. O caso está liberado para produção.</p>`,
      this.caseLink(caseData.id), 'Ver Caso'
    )
    await this.mailer.send({ to: recipients, subject, html })
    await this.logEmail('CASE_APPROVED', recipients, subject, caseData.id)
  }

  async onCaseInProduction(caseData: any) {
    const subject = `Caso em produção - ${caseData.patientName}`
    const html = this.mailer.getTemplate(
      'Seus alinhadores estão sendo produzidos!',
      `<p>Olá Dr(a). <strong>${caseData.dentist?.name}</strong>,</p>
       <p>Os alinhadores do paciente <strong>${caseData.patientName}</strong> estão sendo produzidos. Em breve você receberá o código de rastreamento.</p>`,
      this.caseLink(caseData.id), 'Acompanhar'
    )
    await this.mailer.send({ to: caseData.dentist?.email, subject, html })
    await this.logEmail('IN_PRODUCTION', [caseData.dentist?.email], subject, caseData.id)
  }

  async onCaseShipped(caseData: any, trackingCode: string) {
    const subject = `Caso enviado! Rastreamento: ${trackingCode} - ${caseData.patientName}`
    const html = this.mailer.getTemplate(
      'Seus alinhadores foram enviados!',
      `<p>Olá Dr(a). <strong>${caseData.dentist?.name}</strong>,</p>
       <p>Os alinhadores do paciente <strong>${caseData.patientName}</strong> foram enviados!</p>
       <p><strong>Código de rastreamento:</strong> <span style="font-size:18px;font-weight:700;color:#e94560;">${trackingCode}</span></p>`,
      this.caseLink(caseData.id), 'Ver Caso'
    )
    await this.mailer.send({ to: caseData.dentist?.email, subject, html })
    await this.logEmail('CASE_SHIPPED', [caseData.dentist?.email], subject, caseData.id)
  }

  async onCaseCompleted(caseData: any) {
    const sellerEmails = await this.getSellerEmailsForDentist(caseData.dentistId)
    const dentistEmail = caseData.dentist?.email

    const subject = `Caso concluído - ${caseData.patientName}`
    const html = this.mailer.getTemplate(
      'Caso concluído com sucesso!',
      `<p>Olá Dr(a). <strong>${caseData.dentist?.name}</strong>,</p>
       <p>O caso do paciente <strong>${caseData.patientName}</strong> foi concluído. Caso precise de refinamentos, você pode solicitá-los diretamente pelo Ortholab.</p>`,
      this.caseLink(caseData.id), 'Ver Caso'
    )
    const allRecipients = [...new Set([dentistEmail, ...sellerEmails].filter(Boolean))]
    await this.mailer.send({ to: allRecipients, subject, html })
    await this.logEmail('CASE_COMPLETED', allRecipients, subject, caseData.id)
  }

  async onPaymentConfirmed(caseData: any) {
    const financialEmails = await this.getFinancialEmails()
    const adminEmails = await this.getAdminEmails()

    const dentistHtml = this.mailer.getTemplate(
      'Pagamento confirmado!',
      `<p>Olá Dr(a). <strong>${caseData.dentist?.name}</strong>,</p>
       <p>O pagamento do caso <strong>${caseData.patientName}</strong> foi confirmado com sucesso!</p>`,
      this.caseLink(caseData.id), 'Ver Caso'
    )
    await this.mailer.send({ to: caseData.dentist?.email, subject: `Pagamento confirmado - ${caseData.patientName}`, html: dentistHtml })

    const internalRecipients = [...new Set([...financialEmails, ...adminEmails])]
    if (internalRecipients.length) {
      const internalHtml = this.mailer.getTemplate(
        'Pagamento recebido',
        `<p>O Dr(a). <strong>${caseData.dentist?.name}</strong> realizou o pagamento do caso <strong>${caseData.patientName}</strong>.</p>`,
        this.caseLink(caseData.id), 'Ver Caso'
      )
      await this.mailer.send({ to: internalRecipients, subject: `Pagamento recebido - ${caseData.patientName}`, html: internalHtml })
    }
    await this.logEmail('PAYMENT_CONFIRMED', [caseData.dentist?.email, ...internalRecipients], `Pagamento confirmado - ${caseData.patientName}`, caseData.id)
  }

  async onPaymentFailed(caseData: any) {
    const subject = `Falha no pagamento - ${caseData.patientName}`
    const html = this.mailer.getTemplate(
      'Problema no pagamento',
      `<p>Olá Dr(a). <strong>${caseData.dentist?.name}</strong>,</p>
       <p>Houve um problema ao processar o pagamento do caso <strong>${caseData.patientName}</strong>. Por favor, tente novamente.</p>`,
      this.caseLink(caseData.id), 'Tentar Novamente'
    )
    await this.mailer.send({ to: caseData.dentist?.email, subject, html })
    await this.logEmail('PAYMENT_FAILED', [caseData.dentist?.email], subject, caseData.id)
  }

  async onRefinementRequested(parentCaseData: any, refinementCaseData: any, notes: string) {
    const labEmails = await this.getLabEmails()
    const adminEmails = await this.getAdminEmails()
    const recipients = [...new Set([...labEmails, ...adminEmails])]

    const subject = `Refinamento solicitado - ${parentCaseData.patientName}`
    const html = this.mailer.getTemplate(
      'Refinamento solicitado',
      `<p>O Dr(a). <strong>${parentCaseData.dentist?.name}</strong> solicitou um refinamento no caso de <strong>${parentCaseData.patientName}</strong>.</p>
       <p><strong>Tipo:</strong> Refinamento</p>
       <p><strong>Observações:</strong></p><p style="background:#f8f9fa;padding:12px;border-radius:8px;border-left:4px solid #e94560;">${notes}</p>`,
      this.caseLink(refinementCaseData.id), 'Ver Refinamento'
    )
    await this.mailer.send({ to: recipients, subject, html })
    await this.logEmail('REFINEMENT_REQUESTED', recipients, subject, refinementCaseData.id)
  }
}
