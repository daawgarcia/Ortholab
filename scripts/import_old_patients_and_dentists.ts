import fs from 'fs'
import path from 'path'
import { PrismaClient, Role, CaseStatus, UserStatus } from '@prisma/client'

const prisma = new PrismaClient()
const ROOT = path.join(__dirname, '..')
const MIGRATION_DIR = path.join(ROOT, 'tmp-migration')

function uniqueList<T>(items: T[]) {
  return [...new Set(items.filter(Boolean) as any)]
}

function parseBirthday(value: unknown): Date | undefined {
  if (!value || typeof value !== 'string') return undefined
  const raw = value.trim()
  if (!raw) return undefined

  const iso = raw.match(/^\d{4}-\d{2}-\d{2}$/)
  if (iso) return new Date(`${raw}T00:00:00Z`)

  const br = raw.match(/^\d{2}\/\d{2}\/\d{4}$/)
  if (br) {
    const [day, month, year] = raw.split('/')
    return new Date(`${year}-${month}-${day}T00:00:00Z`)
  }

  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function normalizePatientRecord(raw: any) {
  if (!raw || typeof raw !== 'object') return null
  const patient =
    raw.patient ||
    raw.order?.patient ||
    raw.case_to_move?.order?.patient ||
    raw.case_to_be_approved_by_resp_for_lab?.order?.patient ||
    raw.case_to_change?.order?.patient ||
    raw.case_to_prepare?.order?.patient ||
    raw.case_to_move?.patient ||
    raw.order?.patient ||
    null

  if (!patient || !patient.id || !patient.name) return null

  return {
    id: String(patient.id),
    name: String(patient.name).trim(),
    gender: patient.gender ? String(patient.gender).trim() : null,
    birthday: parseBirthday(patient.birthday),
    dentistId: patient.dentist_id != null ? String(patient.dentist_id) : (patient.dentistId ? String(patient.dentistId) : null),
    active: patient.active !== false,
    boxNumber: patient.box_number ? String(patient.box_number).trim() : null,
  }
}

function walk(node: any, out: Map<string, any>) {
  if (!node || typeof node !== 'object') return

  if (Array.isArray(node)) {
    for (const item of node) walk(item, out)
    return
  }

  const record = normalizePatientRecord(node)
  if (record) {
    out.set(record.id, record)
  }

  for (const value of Object.values(node)) {
    walk(value, out)
  }
}

async function ensureDentist(oldDentistId: string) {
  const email = `old-dentist-${oldDentistId}@migration.local`
  const randomPassword = `OldMig!${oldDentistId}#2026`

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: `Dentista importado #${oldDentistId}`,
      role: Role.DENTIST,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      clinic: 'Migrado do Ortholab antigo',
    },
    create: {
      name: `Dentista importado #${oldDentistId}`,
      email,
      password: randomPassword,
      role: Role.DENTIST,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      clinic: 'Migrado do Ortholab antigo',
    },
  })

  return user
}

async function ensurePatient(record: any, dentistUserId: string) {
  const metadata = JSON.stringify({
    source: 'old-ortholab',
    oldPatientId: record.id,
    oldDentistId: record.dentistId,
    oldBoxNumber: record.boxNumber,
    migratedAt: new Date().toISOString(),
  })

  const existing = await prisma.patient.findFirst({
    where: {
      importantNotes: { contains: `"oldPatientId":"${record.id}"` },
    },
    select: { id: true, dentistId: true, name: true },
  })

  if (existing) {
    if (existing.dentistId !== dentistUserId) {
      await prisma.patient.update({
        where: { id: existing.id },
        data: { dentistId: dentistUserId, active: record.active !== false },
      })
    }
    return existing
  }

  const patient = await prisma.patient.create({
    data: {
      name: record.name,
      gender: record.gender || undefined,
      dob: record.birthday || undefined,
      dentistId: dentistUserId,
      active: record.active !== false,
      importantNotes: metadata,
    },
    select: { id: true, name: true, dentistId: true },
  })

  await prisma.case.create({
    data: {
      dentistId: dentistUserId,
      patientId: patient.id,
      patientName: patient.name,
      patientDob: record.birthday || undefined,
      gender: record.gender || undefined,
      status: CaseStatus.DRAFT,
      notes: JSON.stringify({ source: 'old-ortholab', oldPatientId: record.id, originalBoxNumber: record.boxNumber }),
    },
  })

  return patient
}

async function main() {
  const files = fs.readdirSync(MIGRATION_DIR)
    .filter((file) => file.endsWith('.json'))
    .filter((file) => !file.startsWith('manifest-'))
    .sort()

  const patientsByOldId = new Map<string, any>()

  for (const file of files) {
    const fullPath = path.join(MIGRATION_DIR, file)
    const text = fs.readFileSync(fullPath, 'utf8')
    const parsed = JSON.parse(text)
    walk(parsed, patientsByOldId)
  }

  const patientRecords = Array.from(patientsByOldId.values())
    .filter((patient) => patient && patient.name && patient.id)
    .sort((a, b) => a.name.localeCompare(b.name))

  const uniqueDentistIds = uniqueList(patientRecords.map((p) => p.dentistId).filter(Boolean))
  console.log(`Encontrados ${patientRecords.length} pacientes únicos e ${uniqueDentistIds.length} dentistas únicos no dump local.`)

  for (const oldDentistId of uniqueDentistIds) {
    const user = await ensureDentist(String(oldDentistId))
    console.log(`Dentista importado/validado: oldId=${oldDentistId} -> userId=${user.id}`)
  }

  let created = 0
  let updated = 0

  for (const record of patientRecords) {
    const dentistId = record.dentistId
    if (!dentistId) continue

    const dentistUser = await prisma.user.findFirst({
      where: { email: `old-dentist-${dentistId}@migration.local` },
      select: { id: true },
    })

    if (!dentistUser) {
      console.warn(`Dentista ausente para paciente ${record.name} (${record.id})`)
      continue
    }

    const existing = await prisma.patient.findFirst({
      where: {
        importantNotes: { contains: `"oldPatientId":"${record.id}"` },
      },
      select: { id: true },
    })

    if (existing) {
      updated += 1
      continue
    }

    await ensurePatient(record, dentistUser.id)
    created += 1
  }

  console.log(`Importação finalizada: ${created} pacientes criados, ${updated} já existentes.`)

  const stats = await prisma.$transaction([
    prisma.user.count({ where: { role: Role.DENTIST } }),
    prisma.patient.count(),
    prisma.case.count(),
  ])

  console.log('ESTATISTICAS_NOVAS', JSON.stringify({ dentists: stats[0], patients: stats[1], cases: stats[2] }, null, 2))
}

main()
  .catch((error) => {
    console.error('ERRO_IMPORTACAO_OLD_TO_NEW', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
