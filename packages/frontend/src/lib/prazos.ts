/**
 * Regras de prazo por setor — as mesmas do Dashboard de Produção EA (dashboardproducaoea).
 * Dias úteis em São Paulo: sem sábado, domingo e feriados (nacionais, estaduais de SP e móveis).
 */

function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(ano, mes - 1, dia)
}
const cacheFeriados = new Map<number, Set<string>>()
const chave = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
function feriados(ano: number): Set<string> {
  let s = cacheFeriados.get(ano)
  if (s) return s
  s = new Set(['1-1', '4-21', '5-1', '7-9', '9-7', '10-12', '11-2', '11-15', '11-20', '12-25'].map(md => `${ano}-${md}`))
  const p = pascoa(ano)
  for (const desloc of [-48, -47, -2, 60]) { // carnaval (seg e ter), sexta-feira santa, Corpus Christi
    const d = new Date(p); d.setDate(d.getDate() + desloc); s.add(chave(d))
  }
  cacheFeriados.set(ano, s)
  return s
}
/** Data no fuso de São Paulo (meio-dia, para não virar o dia). */
function diaSP(d: Date | string): Date {
  const x = typeof d === 'string' ? new Date(d) : d
  const [ano, mes, dia] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(x).split('-').map(Number)
  return new Date(ano, mes - 1, dia, 12)
}
export function ehDiaUtil(d: Date): boolean {
  const w = d.getDay()
  return w !== 0 && w !== 6 && !feriados(d.getFullYear()).has(chave(d))
}
/** Dias úteis entre duas datas (não conta o dia de início; conta o de fim). */
export function diasUteis(de: Date | string, ate: Date | string = new Date()): number {
  const ini = diaSP(de), fim = diaSP(ate)
  let n = 0
  const cur = new Date(ini)
  while (cur < fim) { cur.setDate(cur.getDate() + 1); if (ehDiaUtil(cur)) n++ }
  return n
}
export function diasCorridos(de: Date | string, ate: Date | string = new Date()): number {
  return Math.max(0, Math.round((diaSP(ate).getTime() - diaSP(de).getTime()) / 86400000))
}

export type Tom = 'vermelho' | 'amarelo' | 'normal'

/** Regras por setor (iguais ao Dashboard EA). */
export const REGRAS = {
  planning: { limiteDiasUteis: 2, aprovacaoDentistaDiasCorridos: 30 },
  impressao3d: { amarelo: 1, vermelho: 2 },
  recorte: { amarelo: 1, vermelho: 2 },
}

/** Planning Center: vermelho com mais de 2 dias úteis na etapa; "Casos a alterar" em amarelo; aguardando aprovação do dentista fica vermelho a partir de 30 dias corridos. */
export function tomPlanning(coluna: string, desde: string): { tom: Tom; diasUteis: number; diasCorridos: number } {
  const du = diasUteis(desde), dc = diasCorridos(desde)
  if (coluna === 'WAITING_APPROVAL') return { tom: dc >= REGRAS.planning.aprovacaoDentistaDiasCorridos ? 'vermelho' : 'normal', diasUteis: du, diasCorridos: dc }
  if (du > REGRAS.planning.limiteDiasUteis) return { tom: 'vermelho', diasUteis: du, diasCorridos: dc }
  if (coluna === 'REVISION_REQUESTED') return { tom: 'amarelo', diasUteis: du, diasCorridos: dc }
  return { tom: 'normal', diasUteis: du, diasCorridos: dc }
}
/** Impressão 3D e Recorte: amarelo com 1 dia útil, vermelho a partir de 2. */
export function tomSetor(setor: 'impressao3d' | 'recorte', desde: string): { tom: Tom; diasUteis: number } {
  const r = REGRAS[setor], du = diasUteis(desde)
  return { tom: du >= r.vermelho ? 'vermelho' : du >= r.amarelo ? 'amarelo' : 'normal', diasUteis: du }
}
export const CLASSE_TOM: Record<Tom, string> = {
  vermelho: 'bg-rose-50 ring-1 ring-inset ring-rose-200',
  amarelo: 'bg-amber-50 ring-1 ring-inset ring-amber-200',
  normal: '',
}
export const SELO_TOM: Record<Tom, string> = {
  vermelho: 'text-rose-700 bg-rose-100 font-semibold',
  amarelo: 'text-amber-800 bg-amber-100 font-semibold',
  normal: 'text-gray-500 bg-gray-100',
}
