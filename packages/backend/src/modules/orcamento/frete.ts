import { PrismaClient } from '@prisma/client'

/** Tabela "SEDEX por região" (Esthetic Aligner, nov/2026) — valor por estado. */
export const FRETE_SEDEX_2026: Record<string, number> = {
  AC: 140, AL: 100, AP: 100, AM: 100, BA: 90, CE: 100, DF: 60, ES: 60, GO: 70, MA: 100,
  MT: 90, MS: 80, MG: 80, PA: 110, PB: 100, PR: 70, PE: 90, PI: 100, RJ: 60, RN: 100,
  RS: 70, RO: 140, RR: 120, SC: 70, SP: 35, SE: 100, TO: 100,
}

const NOMES_UF: Record<string, string> = {
  ACRE: 'AC', ALAGOAS: 'AL', AMAPA: 'AP', AMAZONAS: 'AM', BAHIA: 'BA', CEARA: 'CE', 'DISTRITO FEDERAL': 'DF',
  'ESPIRITO SANTO': 'ES', GOIAS: 'GO', MARANHAO: 'MA', 'MATO GROSSO': 'MT', 'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG', PARA: 'PA', PARAIBA: 'PB', PARANA: 'PR', PERNAMBUCO: 'PE', PIAUI: 'PI',
  'RIO DE JANEIRO': 'RJ', 'RIO GRANDE DO NORTE': 'RN', 'RIO GRANDE DO SUL': 'RS', RONDONIA: 'RO',
  RORAIMA: 'RR', 'SANTA CATARINA': 'SC', 'SAO PAULO': 'SP', SERGIPE: 'SE', TOCANTINS: 'TO',
}

const norm = (s?: string | null) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()

/** Converte "SP", "sp", "São Paulo" -> "SP". */
export function siglaUF(valor?: string | null): string | null {
  const v = norm(valor)
  if (!v) return null
  if (/^[A-Z]{2}$/.test(v)) return v
  return NOMES_UF[v] || null
}

/** Cadastra a tabela padrão se ainda não houver nenhuma faixa de frete. */
export async function prepararFrete(prisma: PrismaClient) {
  const n = await prisma.freightRate.count()
  if (n > 0) return
  await prisma.freightRate.createMany({
    data: Object.entries(FRETE_SEDEX_2026).map(([uf, valor]) => ({ uf, cidade: null, valor })),
  })
}

export type ResultadoFrete = { valor: number | null; uf: string | null; cidade: string | null; origem: string }

/**
 * Frete pelo endereço de ENTREGA do dentista (se não houver, usa o endereço do cadastro).
 * Regra: cidade específica cadastrada > valor do estado. Fora do Brasil: a combinar.
 */
export async function calcularFrete(prisma: PrismaClient, dentista: any): Promise<ResultadoFrete> {
  const pais = norm(dentista?.country)
  if (pais && !['BR', 'BRASIL', 'BRAZIL'].includes(pais)) {
    return { valor: null, uf: null, cidade: null, origem: 'Entrega internacional — frete a combinar' }
  }
  const uf = siglaUF(dentista?.deliveryState) || siglaUF(dentista?.state)
  const cidade = (dentista?.deliveryState ? dentista?.deliveryCity : dentista?.city) || null
  if (!uf) return { valor: null, uf: null, cidade, origem: 'Endereço sem estado — atualize o cadastro do dentista' }
  const faixas = await prisma.freightRate.findMany({ where: { uf } })
  const daCidade = cidade ? faixas.find(f => f.cidade && norm(f.cidade) === norm(cidade)) : undefined
  const doEstado = faixas.find(f => !f.cidade)
  const escolhida = daCidade || doEstado
  if (!escolhida) return { valor: null, uf, cidade, origem: `Sem frete cadastrado para ${uf}` }
  return {
    valor: Number(escolhida.valor),
    uf,
    cidade,
    origem: daCidade ? `SEDEX ${cidade}/${uf}` : `SEDEX ${uf}`,
  }
}
