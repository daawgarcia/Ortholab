import { FastifyInstance } from 'fastify'
import { Prisma, PrismaClient, Role } from '@prisma/client'
import { authenticate, JwtPayload } from '../../plugins/auth'

/**
 * Busca "inteligente" de pacientes e dentistas:
 * - ignora acentos e maiúsculas;
 * - cada palavra pode estar em qualquer campo (nome, caixa, dentista...), em qualquer ordem;
 * - nº da caixa com ou sem zeros à esquerda (28542 acha 028542);
 * - tolera erro de digitação (Massaroti acha MASSAROTTI) via similaridade (pg_trgm).
 */

let preparado = false
export async function prepararBusca(prisma: PrismaClient) {
  if (preparado) return
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS unaccent`)
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION f_busca(t text) RETURNS text
      LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, coalesce(t, ''))) $$`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS patient_nome_busca_idx ON "Patient" USING gin (f_busca(name) gin_trgm_ops)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS user_nome_busca_idx ON "User" USING gin (f_busca(name) gin_trgm_ops)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS patient_caixa_idx ON "Patient" ("boxNumber")`)
    preparado = true
  } catch (err) {
    console.error('[busca] não foi possível preparar extensões de busca', err)
  }
}

export function normalizar(q: string) {
  return q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function tokens(q: string) {
  return normalizar(q).split(' ').filter(t => t.length >= 1 && !['de', 'da', 'do', 'das', 'dos', 'e'].includes(t)).slice(0, 6)
}

/** IDs de pacientes que batem com a busca, em ordem de relevância. */
export async function buscarPacientes(
  prisma: PrismaClient,
  q: string,
  opts: { dentistIds?: string[] | null; limit?: number; offset?: number } = {},
): Promise<{ ids: string[]; total: number }> {
  await prepararBusca(prisma)
  const qn = normalizar(q)
  const toks = tokens(q)
  if (!qn || !toks.length) return { ids: [], total: 0 }
  const digits = qn.replace(/\D/g, '')
  const soNumero = /^\d+$/.test(qn.replace(/\s/g, ''))

  const restr = opts.dentistIds
    ? (opts.dentistIds.length ? Prisma.sql`AND p."dentistId" IN (${Prisma.join(opts.dentistIds)})` : Prisma.sql`AND false`)
    : Prisma.empty

  const tokConds = Prisma.join(
    toks.map(t => {
      const like = `%${t}%`
      return Prisma.sql`(f_busca(p.name) LIKE ${like} OR f_busca(u.name) LIKE ${like} OR f_busca(u.clinic) LIKE ${like} OR coalesce(p."boxNumber",'') LIKE ${like})`
    }),
    ' AND ',
  )
  const caixaCond = soNumero && digits
    ? Prisma.sql`OR ltrim(coalesce(p."boxNumber",''), '0') = ltrim(${digits}, '0')`
    : Prisma.empty
  const fuzzy = soNumero
    ? Prisma.sql`false`
    : Prisma.sql`(word_similarity(${qn}, f_busca(p.name)) > 0.55 OR similarity(f_busca(p.name), ${qn}) > 0.35)`

  const rows = await prisma.$queryRaw<Array<{ id: string; total: bigint }>>`
    SELECT p.id, count(*) OVER () AS total
    FROM "Patient" p JOIN "User" u ON u.id = p."dentistId"
    WHERE ((${tokConds}) ${caixaCond} OR ${fuzzy}) ${restr}
    ORDER BY
      (ltrim(coalesce(p."boxNumber",''), '0') = ltrim(${digits || '-'}, '0')) DESC,
      (f_busca(p.name) LIKE ${qn + '%'}) DESC,
      (${tokConds}) DESC,
      greatest(word_similarity(${qn}, f_busca(p.name)), similarity(f_busca(p.name), ${qn})) DESC,
      p.name ASC
    LIMIT ${opts.limit ?? 50} OFFSET ${opts.offset ?? 0}`
  return { ids: rows.map(r => r.id), total: Number(rows[0]?.total ?? 0) }
}

/** IDs de dentistas que batem com a busca (nome, clínica, CRO, e-mail, CPF/CNPJ, código TOTVS). */
export async function buscarDentistas(
  prisma: PrismaClient,
  q: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ ids: string[]; total: number }> {
  await prepararBusca(prisma)
  const qn = normalizar(q)
  const toks = tokens(q)
  if (!qn || !toks.length) return { ids: [], total: 0 }
  const tokConds = Prisma.join(
    toks.map(t => {
      const like = `%${t}%`
      return Prisma.sql`(f_busca(u.name) LIKE ${like} OR f_busca(u.clinic) LIKE ${like} OR lower(coalesce(u.cro,'')) LIKE ${like}
        OR lower(u.email) LIKE ${like} OR coalesce(u.cpf,'') LIKE ${like} OR coalesce(u.cnpj,'') LIKE ${like}
        OR coalesce(u."totvsCode",'') LIKE ${like})`
    }),
    ' AND ',
  )
  const rows = await prisma.$queryRaw<Array<{ id: string; total: bigint }>>`
    SELECT u.id, count(*) OVER () AS total
    FROM "User" u
    WHERE u.role = 'DENTIST'::"Role"
      AND ((${tokConds}) OR word_similarity(${qn}, f_busca(u.name)) > 0.55 OR similarity(f_busca(u.name), ${qn}) > 0.35)
    ORDER BY (f_busca(u.name) LIKE ${qn + '%'}) DESC, (${tokConds}) DESC,
      greatest(word_similarity(${qn}, f_busca(u.name)), similarity(f_busca(u.name), ${qn})) DESC,
      (u.status = 'ACTIVE'::"UserStatus") DESC, u.name ASC
    LIMIT ${opts.limit ?? 50} OFFSET ${opts.offset ?? 0}`
  return { ids: rows.map(r => r.id), total: Number(rows[0]?.total ?? 0) }
}

/** Dentistas que o usuário pode ver (null = todos). */
export async function dentistasPermitidos(prisma: PrismaClient, user: JwtPayload): Promise<string[] | null> {
  if (user.role === Role.DENTIST) return [user.id]
  if (user.role === Role.SELLER) {
    const p = await prisma.sellerClient.findMany({ where: { sellerId: user.id }, select: { clientId: true } })
    return p.map(x => x.clientId)
  }
  return null
}

export function ordenarPor<T extends { id: string }>(ids: string[], itens: T[]) {
  const pos = new Map(ids.map((id, i) => [id, i]))
  return [...itens].sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0))
}

/** GET /api/busca?q=  — busca rápida do topo (pacientes + dentistas). */
export async function buscaRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: authenticate }, async (request) => {
    const user = request.user as JwtPayload
    const q = String((request.query as any)?.q || '').trim()
    if (q.length < 2) return { pacientes: [], dentistas: [] }

    const permitidos = await dentistasPermitidos(fastify.prisma, user)
    const pac = await buscarPacientes(fastify.prisma, q, { dentistIds: permitidos, limit: 8 })
    const pacientes = ordenarPor(pac.ids, await fastify.prisma.patient.findMany({
      where: { id: { in: pac.ids } },
      select: {
        id: true, name: true, boxNumber: true, active: true,
        dentist: { select: { id: true, name: true } },
        cases: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, caseNumber: true } },
      },
    }))

    let dentistas: any[] = []
    if (user.role !== Role.DENTIST) {
      const den = await buscarDentistas(fastify.prisma, q, { limit: 5 })
      const ids = permitidos ? den.ids.filter(id => permitidos.includes(id)) : den.ids
      dentistas = ordenarPor(ids, await fastify.prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, cro: true, clinic: true, status: true, _count: { select: { patients: true } } },
      }))
    }
    return { pacientes, totalPacientes: pac.total, dentistas }
  })
}
