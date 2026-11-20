import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const run = promisify(execFile)

/**
 * Indicação da Checagem Virtual 3D, lida do PDF do planejamento
 * (normalmente na penúltima página, bloco "Observação").
 */
export interface Checagem {
  estimativaSuperior?: { min: number; max: number }
  estimativaInferior?: { min: number; max: number }
  /** estimativa única, quando o PDF não separa por arcada */
  estimativaGeral?: { min: number; max: number }
  versao?: number
  seriesFaseSuperior?: number
  seriesFaseInferior?: number
  tipoIndicado?: 'UNIDADE' | 'MID' | 'FULL' | null
  pagina?: number
  arquivo?: string
  arquivoId?: string
  lidoEm: string
}

const norm = (s: string) => s.replace(/\s+/g, ' ').replace(/[ºª°]/g, '°').trim()

/** Interpreta o texto de uma página. Retorna null se não achar nada da checagem. */
export function interpretarTexto(texto: string): Omit<Checagem, 'lidoEm'> | null {
  const t = norm(texto)
  const out: Omit<Checagem, 'lidoEm'> = {}
  const sup = t.match(/Arcada\s+Superior\)?\s*:?\s*(\d{1,3})\s*(?:-|–|a|até)\s*(\d{1,3})\s*s[ée]ries/i)
  const inf = t.match(/Arcada\s+Inferior\)?\s*:?\s*(\d{1,3})\s*(?:-|–|a|até)\s*(\d{1,3})\s*s[ée]ries/i)
  if (sup) out.estimativaSuperior = { min: +sup[1], max: +sup[2] }
  if (inf) out.estimativaInferior = { min: +inf[1], max: +inf[2] }
  if (!sup && !inf) {
    const geral = t.match(/movimenta[çc][ãa]o\s*:\s*(\d{1,3})\s*(?:-|–|a|até)\s*(\d{1,3})\s*s[ée]ries/i)
    if (geral) out.estimativaGeral = { min: +geral[1], max: +geral[2] }
  }
  // "produção de 6 séries superiores e 6 séries inferiores"
  const prod = t.match(/produ[çc][ãa]o\s+de\s+(.{0,120}?)\s+para\s+esta\s+fase/i)
  const trecho = prod ? prod[1] : t
  const fs = trecho.match(/(\d{1,3})\s*s[ée]ries?\s+superiores?/i)
  const fi = trecho.match(/(\d{1,3})\s*s[ée]ries?\s+inferiores?/i)
  if (fs) out.seriesFaseSuperior = +fs[1]
  if (fi) out.seriesFaseInferior = +fi[1]
  const ambos = trecho.match(/(\d{1,3})\s*s[ée]ries?\s+(?:superiores?\s+e\s+inferiores?|em\s+ambas)/i)
  if (ambos && !fs && !fi) { out.seriesFaseSuperior = +ambos[1]; out.seriesFaseInferior = +ambos[1] }
  const achou = out.estimativaSuperior || out.estimativaInferior || out.estimativaGeral || out.seriesFaseSuperior != null || out.seriesFaseInferior != null
  return achou ? out : null
}

/**
 * Regra de classificação Unidade / MID / FULL.
 * PENDENTE: a regra oficial ainda será definida pela Esthetic Aligner; até lá não classifica.
 */
export function classificar(_c: Omit<Checagem, 'lidoEm'>): Checagem['tipoIndicado'] {
  return null
}

/** Lê o PDF (via pdftotext/poppler) começando pela penúltima página. */
export async function lerChecagemDoPdf(buffer: Buffer, arquivo?: string): Promise<Checagem | null> {
  const dir = await mkdtemp(path.join(tmpdir(), 'checagem-'))
  const file = path.join(dir, 'planejamento.pdf')
  try {
    await writeFile(file, buffer)
    const { stdout } = await run('pdftotext', ['-layout', file, '-'], { maxBuffer: 64 * 1024 * 1024 })
    const paginas = stdout.split('\f')
    while (paginas.length && !paginas[paginas.length - 1].trim()) paginas.pop()
    const n = paginas.length
    // penúltima, última e depois as demais de trás para frente
    const ordem = [n - 2, n - 1, ...Array.from({ length: Math.max(0, n - 2) }, (_, i) => n - 3 - i)].filter(i => i >= 0 && i < n)
    for (const i of ordem) {
      const r = interpretarTexto(paginas[i])
      if (r) {
        r.tipoIndicado = classificar(r)
        return { ...r, pagina: i + 1, arquivo, versao: 2, lidoEm: new Date().toISOString() }
      }
    }
    return null
  } catch (err) {
    console.error('[checagem] falha ao ler PDF', err)
    return null
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
