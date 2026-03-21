import { PrismaClient, Role, UserStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const adminPassword = await bcrypt.hash('Admin@123', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@estheticaligner.com.br' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@estheticaligner.com.br',
      password: adminPassword,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
    },
  })
  console.log('Admin created:', admin.email)

  const existingModule = await prisma.appModule.findUnique({ where: { slug: 'agenda' } })
  if (!existingModule) {
    await prisma.appModule.create({
      data: {
        name: 'Agenda',
        slug: 'agenda',
        icon: 'Calendar',
        url: 'https://agenda.estheticaligner.com.br',
        roles: [Role.ADMIN, Role.DENTIST, Role.SELLER],
        status: 'INACTIVE',
        openInNewTab: false,
        order: 1,
      },
    })
    console.log('Agenda module created')
  }

  const servicesList = [
    { name: 'Alinhadores Full', type: 'FULL', productionDays: 20, maxRevisions: 2, description: 'Tratamento completo com alinhadores', price: 1200 },
    { name: 'Alinhadores Express', type: 'EXPRESS', productionDays: 10, maxRevisions: 1, description: 'Tratamento express com alinhadores', price: 800 },
    { name: 'Refinamento', type: 'REFINEMENT', productionDays: 15, maxRevisions: 1, description: 'Refinamento de tratamento existente', price: 600 },
    { name: 'Contencao', type: 'RETAINER', productionDays: 7, maxRevisions: 0, description: 'Contencao removivel', price: 300 },
  ]

  for (const svc of servicesList) {
    const existing = await prisma.service.findFirst({ where: { name: svc.name } })
    if (!existing) {
      const service = await prisma.service.create({
        data: {
          name: svc.name,
          type: svc.type,
          productionDays: svc.productionDays,
          maxRevisions: svc.maxRevisions,
          description: svc.description,
        },
      })
      await prisma.price.create({
        data: { serviceId: service.id, price: svc.price },
      })
      console.log('Service created:', svc.name)
    }
  }

  console.log('Seed completed!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
