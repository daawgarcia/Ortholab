import fs from 'fs'
import path from 'path'
import https from 'https'
import { pathToFileURL } from 'url'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE = 'https://ortholab.estheticaligner.com.br'
const EMAIL = 'marketing@estheticaligner.com.br'
const PASSWORD = 'Otavio2805@'

function request(url: string, options: { method?: string; headers?: Record<string, string>; data?: string } = {}) {
  return new Promise<{ status: number; headers: Record<string, any>; body: string }>((resolve, reject) => {
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 30000,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          headers: (res.headers || {}) as Record<string, any>,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      })
    })

    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('timeout')))
    if (options.data) req.write(options.data)
    req.end()
  })
}

function parseCookies(headers: string | string[] | undefined): string {
  const list = Array.isArray(headers) ? headers : headers ? [headers] : []
  return list
    .map((h) => String(h).split(';')[0].trim())
    .filter(Boolean)
    .join('; ')
}

async function loginToOld(): Promise<string> {
  const loginPage = await request(`${BASE}/pt-BR/users/sign_in`)
  const csrf = (loginPage.body.match(/name="authenticity_token"\s+value="([^"]+)"/i) || [])[1]
  if (!csrf) throw new Error('CSRF do login do old não encontrado')

  const form = new URLSearchParams({
    authenticity_token: csrf || '',
    'user[email]': EMAIL,
    'user[password]': PASSWORD,
    commit: 'Entrar',
  }).toString()

  const post = await request(`${BASE}/pt-BR/users/sign_in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: `${BASE}/pt-BR/users/sign_in`,
      Origin: BASE,
      Cookie: parseCookies(loginPage.headers['set-cookie']),
      'User-Agent': 'Mozilla/5.0',
    },
    data: form,
  })

  const cookieMap = new Map<string, string>()
  for (const part of [
    ...parseCookies(loginPage.headers['set-cookie']).split('; ').filter(Boolean),
    ...parseCookies(post.headers['set-cookie']).split('; ').filter(Boolean),
  ]) {
    const idx = part.indexOf('=')
    if (idx > 0) cookieMap.set(part.slice(0, idx), part)
  }

  const cookie = Array.from(cookieMap.values()).join('; ')
  if (!cookie.includes('_easysmile-web_session')) {
    throw new Error('Sessão _easysmile-web_session não foi obtida do old')
  }

  return cookie
}

function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  if (trimmed.startsWith('/')) return `${BASE}${trimmed}`
  return `${BASE}/${trimmed}`
}

function isImage(ext: string) {
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext.toLowerCase())
}

function isModel(ext: string) {
  return ['stl', 'obj', 'ply', 'step', 'stp', 'iges', 'igs'].includes(ext.toLowerCase())
}

function isVideo(ext: string) {
  return ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'mpeg'].includes(ext.toLowerCase())
}

function basenameFromUrl(url: string) {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() || '').trim() || 'arquivo'
  } catch {
    return decodeURIComponent(url.split('/').pop() || '').trim() || 'arquivo'
  }
}

function resolveFileName(candidate: string | null | undefined, fallbackUrl: string | null | undefined) {
  const value = (candidate || '').trim()
  if (value) return value
  return basenameFromUrl(fallbackUrl || 'arquivo')
}

export function extractCandidateFilesFromHtml(html: string): Array<{ name: string; url: string; isPrivate: boolean }> {
  const files: Array<{ name: string; url: string; isPrivate: boolean }> = []
  if (!html || !html.includes('<')) return files

  const filePattern = /([A-Za-z0-9_.\- ()]+\.(?:pdf|doc|docx|xlsx|zip|rar|ppt|pptx|jpg|jpeg|png|webp|gif|bmp|mp4|mov|avi|mkv|webm|m4v|mpeg|stl|obj|ply|step|stp|iges|igs))/i
  const tagRegex = /<a\b[^>]*?(?:href|data-href|src|data-url)=['"]([^'"]+)['"][^>]*>(.*?)<\/a>/gi
  const linkMatches = Array.from(html.matchAll(tagRegex))

  for (const match of linkMatches) {
    const candidate = (match[1] || '').trim()
    if (!candidate) continue

    const normalized = normalizeUrl(candidate)
    if (!normalized) continue

    const innerText = (match[2] || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').trim()
    const anchorName = innerText.match(filePattern)?.[1] || null
    const fallbackName = basenameFromUrl(normalized)
    const name = (anchorName || fallbackName || 'arquivo').trim()
    const ext = (name.split('.').pop() || '').toLowerCase()
    const isEligible = !ext || isImage(ext) || isModel(ext) || isVideo(ext) || ['pdf', 'doc', 'docx', 'xlsx', 'zip', 'rar', 'ppt', 'pptx'].includes(ext)
    if (!isEligible) continue

    if (!files.some((item) => item.url === normalized)) {
      files.push({ name, url: normalized, isPrivate: false })
    }
  }

  const fallbackMatches = Array.from(html.matchAll(/(?:href|data-href|src|data-url)=['"]([^'"]+)['"]/gi))
  for (const match of fallbackMatches) {
    const candidate = (match[1] || '').trim()
    if (!candidate) continue
    const normalized = normalizeUrl(candidate)
    if (!normalized) continue
    if (files.some((item) => item.url === normalized)) continue

    const fileNameFromUrl = basenameFromUrl(normalized)
    const ext = (fileNameFromUrl.split('.').pop() || '').toLowerCase()
    const isEligible = !ext || isImage(ext) || isModel(ext) || isVideo(ext) || ['pdf', 'doc', 'docx', 'xlsx', 'zip', 'rar', 'ppt', 'pptx'].includes(ext)
    if (isEligible) {
      files.push({ name: fileNameFromUrl || 'arquivo', url: normalized, isPrivate: false })
    }
  }

  return files
}

function walkForFiles(node: any, out: Array<{ name: string; url: string; isPrivate: boolean }>) {
  if (!node || typeof node !== 'object') return

  if (Array.isArray(node)) {
    for (const item of node) walkForFiles(item, out)
    return
  }

  const obj = node as Record<string, any>

  const urlCandidate =
    obj.file_url ||
    obj.fileUrl ||
    obj.url ||
    obj.href ||
    obj.path ||
    obj.attachment_url ||
    obj.attachmentUrl ||
    obj.download_url ||
    obj.downloadUrl || null

  const nameCandidate =
    obj.file_name ||
    obj.fileName ||
    obj.filename ||
    obj.name ||
    obj.title ||
    obj.original_filename ||
    obj.originalFileName || null

  const isPrivate = Boolean(
    obj.is_private === true ||
    obj.private === true ||
    obj.isPrivate === true ||
    obj.restricted === true ||
    obj.private_file === true
  )

  if (typeof urlCandidate === 'string' && urlCandidate.trim()) {
    const normalized = normalizeUrl(urlCandidate)
    if (normalized) {
      const fileName = resolveFileName(typeof nameCandidate === 'string' ? nameCandidate : null, normalized)
      const ext = (fileName.split('.').pop() || '').toLowerCase()
      const isEligible = !ext || isImage(ext) || isModel(ext) || isVideo(ext) || ['pdf', 'doc', 'docx', 'xlsx', 'zip', 'rar', 'ppt', 'pptx'].includes(ext)
      if (isEligible) {
        out.push({ name: fileName, url: normalized, isPrivate })
      }
    }
  }

  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) walkForFiles(value, out)
  }
}

async function fetchPatientWorkFiles(oldPatientId: string, cookie: string) {
  const jsonEndpoints = [
    `/pt-BR/patients/${oldPatientId}/v2/works.json`,
    `/patients/${oldPatientId}/v2/works.json`,
  ]

  for (const endpoint of jsonEndpoints) {
    const res = await request(`${BASE}${endpoint}`, {
      headers: {
        Cookie: cookie,
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
    })

    if (res.status !== 200) continue

    try {
      const parsed = JSON.parse(res.body)
      const files: Array<{ name: string; url: string; isPrivate: boolean }> = []
      walkForFiles(parsed, files)
      if (files.length > 0) return files
    } catch {
      // try next format
    }
  }

  const htmlEndpoints = [
    `/pt-BR/patients/${oldPatientId}/v2/works`,
    `/patients/${oldPatientId}/v2/works`,
    `/pt-BR/patients/${oldPatientId}/works`,
    `/patients/${oldPatientId}/works`,
  ]

  for (const endpoint of htmlEndpoints) {
    const res = await request(`${BASE}${endpoint}`, {
      headers: {
        Cookie: cookie,
        'User-Agent': 'Mozilla/5.0',
        Accept: 'text/html,application/xhtml+xml',
      },
    })

    if (res.status !== 200) continue
    const files = extractCandidateFilesFromHtml(res.body)
    if (files.length > 0) return files
  }

  return []
}

async function ensurePatientSourceMapping() {
  const patients = await prisma.patient.findMany({
    select: { id: true, importantNotes: true },
  })

  const mapped: Array<{ patientId: string; oldPatientId: string }> = []

  for (const patient of patients) {
    const text = patient.importantNotes || ''
    if (!text) continue

    try {
      const parsed = JSON.parse(text)
      const oldPatientId = parsed?.oldPatientId ? String(parsed.oldPatientId) : null
      if (oldPatientId) mapped.push({ patientId: patient.id, oldPatientId })
    } catch {
      // ignore malformed notes
    }
  }

  return mapped
}

async function main() {
  const cookie = await loginToOld()
  const mappings = await ensurePatientSourceMapping()

  if (mappings.length === 0) {
    console.log('Nenhum paciente migrado com oldPatientId encontrado no banco local.')
    return
  }

  let totalFilesCreated = 0
  let totalPhotos = 0
  let totalWorkFiles = 0
  let totalDigitalModels = 0

  for (const mapping of mappings) {
    const files = await fetchPatientWorkFiles(mapping.oldPatientId, cookie)
    if (!files.length) {
      console.log(`Paciente ${mapping.patientId} (oldId=${mapping.oldPatientId}) sem arquivos/relatórios detectados.`)
      continue
    }

    const seen = new Set<string>()

    for (const file of files) {
      const key = `${mapping.oldPatientId}:${file.url}`
      if (seen.has(key)) continue
      seen.add(key)

      const name = file.name || 'arquivo'
      const ext = (name.split('.').pop() || '').toLowerCase()

      const target = {
        patientId: mapping.patientId,
        url: file.url,
        filename: name,
        size: null,
      }

      if (isImage(ext)) {
        const exists = await prisma.photo.findFirst({
          where: { patientId: mapping.patientId, url: file.url },
          select: { id: true },
        })

        if (!exists) {
          await prisma.photo.create({
            data: {
              patientId: mapping.patientId,
              url: file.url,
              filename: name,
              size: null,
              isPrivate: file.isPrivate,
            },
          })
          totalPhotos += 1
        }
      } else if (isModel(ext)) {
        const exists = await prisma.digitalModel.findFirst({
          where: { patientId: mapping.patientId, url: file.url },
          select: { id: true },
        })

        if (!exists) {
          await prisma.digitalModel.create({
            data: {
              patientId: mapping.patientId,
              url: file.url,
              filename: name,
              size: null,
              kind: ext || 'model',
            },
          })
          totalDigitalModels += 1
        }
      } else {
        const exists = await prisma.workFile.findFirst({
          where: { patientId: mapping.patientId, url: file.url },
          select: { id: true },
        })

        if (!exists) {
          await prisma.workFile.create({
            data: {
              patientId: mapping.patientId,
              url: file.url,
              filename: name,
              size: null,
            },
          })
          totalWorkFiles += 1
        }
      }

      totalFilesCreated += 1
    }

    console.log(`Paciente ${mapping.patientId} -> oldId=${mapping.oldPatientId}: ${files.length} arquivos candidatos processados.`)
  }

  console.log(JSON.stringify({
    patientsMapped: mappings.length,
    created: totalFilesCreated,
    photos: totalPhotos,
    workFiles: totalWorkFiles,
    digitalModels: totalDigitalModels,
  }, null, 2))
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

const compatExports = { extractCandidateFilesFromHtml }
export default compatExports

if (typeof module !== 'undefined') {
  module.exports = compatExports
}

if (isDirectExecution) {
  main()
    .catch((error) => {
      console.error('ERRO_IMPORTACAO_ARQUIVOS_OLD_TO_NEW', error)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
