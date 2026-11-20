import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'
import { promises as fs } from 'fs'
import path from 'path'

declare module 'fastify' {
  interface FastifyInstance {
    s3: S3Service
  }
}

class S3Service {
  private client: S3Client
  private bucket: string
  private region: string
  private isAWS: boolean
  private uploadsRoot: string
  private s3Enabled: boolean

  constructor() {
    const endpoint = process.env.S3_ENDPOINT || ''
    const accessKeyId = process.env.S3_ACCESS_KEY || ''
    const secretAccessKey = process.env.S3_SECRET_KEY || ''
    this.region = process.env.S3_REGION || 'us-east-1'
    this.bucket = process.env.S3_BUCKET || 'ortholab-files'
    this.isAWS = endpoint.includes('amazonaws.com')
    this.uploadsRoot = path.resolve(process.cwd(), 'uploads')
    // Na AWS sem chaves: usa a permissão (IAM role) do servidor pela cadeia padrão do SDK.
    const hasKeys = Boolean(accessKeyId && secretAccessKey)
    this.s3Enabled = Boolean(endpoint && (hasKeys || this.isAWS))

    const clientConfig: Record<string, unknown> = { region: this.region }
    if (hasKeys) {
      clientConfig.credentials = { accessKeyId, secretAccessKey }
    }

    if (!this.isAWS && endpoint) {
      // MinIO or S3-compatible (local dev)
      clientConfig.endpoint = endpoint
      clientConfig.forcePathStyle = true
    }

    this.client = new S3Client(clientConfig as any)
  }

  async upload(buffer: Buffer, originalName: string, mimeType: string, folder: string = 'uploads'): Promise<{ key: string; url: string }> {
    if (!this.s3Enabled) {
      return this.saveLocally(buffer, originalName, mimeType, folder)
    }

    const ext = originalName.split('.').pop()
    const key = `${folder}/${uuidv4()}.${ext}`

    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }))

      const url = this.isAWS
        ? `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`
        : `${process.env.S3_ENDPOINT}/${this.bucket}/${key}`
      return { key, url }
    } catch {
      return this.saveLocally(buffer, originalName, mimeType, folder)
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    return getSignedUrl(this.client, command, { expiresIn })
  }

  /**
   * Recebe a URL armazenada (pode ser S3 público OU /api/uploads/...) e devolve
   * uma URL temporária autenticada apropriada para o frontend.
   */
  async signedUrlForUrl(url: string, expiresIn: number = 600): Promise<string> {
    if (!url) return url

    // Local fallback: já autenticado pelo /api/uploads/*
    if (url.includes('/api/uploads/')) return url

    if (!this.s3Enabled) return url

    // Formato AWS "virtual-hosted": https://<bucket>.s3.<regiao>.amazonaws.com/<key>
    const hosted = `https://${this.bucket}.s3.`
    if (url.startsWith(hosted)) {
      const key = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''))
      // Arquivos do Ortholab 1 ainda em cópia para o bucket novo: se não estiver lá ainda,
      // entrega um link temporário de LEITURA do bucket antigo (nada é alterado lá).
      const legado = process.env.OL1_LEGACY_BUCKET
      if (legado && key.startsWith('ortholab1-arquivos/') && !(await this.exists(key))) {
        const cmd = new GetObjectCommand({ Bucket: legado, Key: key.replace(/^ortholab1-arquivos\//, '') })
        return getSignedUrl(this.legacyClient(), cmd, { expiresIn })
      }
      return this.getSignedUrl(key, expiresIn)
    }

    // Formato "path-style" / MinIO: .../<bucket>/<key>
    const bucketMarker = `/${this.bucket}/`
    const idx = url.indexOf(bucketMarker)
    if (idx >= 0) {
      const key = url.slice(idx + bucketMarker.length)
      return this.getSignedUrl(key, expiresIn)
    }
    return url
  }

  private _legacy?: S3Client
  private legacyClient() {
    if (!this._legacy) this._legacy = new S3Client({ region: process.env.OL1_LEGACY_REGION || 'us-east-1' })
    return this._legacy
  }

  private existsCache = new Map<string, boolean>()
  private async exists(key: string): Promise<boolean> {
    if (this.existsCache.get(key)) return true
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      this.existsCache.set(key, true)
      if (this.existsCache.size > 50000) this.existsCache.clear()
      return true
    } catch {
      return false
    }
  }

  async delete(key: string): Promise<void> {
    if (key.startsWith('local/')) {
      const localPath = path.resolve(this.uploadsRoot, key.replace(/^local\//, ''))
      try {
        await fs.unlink(localPath)
      } catch {
        // Ignore missing local files.
      }
      return
    }

    if (!this.s3Enabled) return
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  private async saveLocally(buffer: Buffer, originalName: string, mimeType: string, folder: string) {
    const safeFolder = folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    const ext = path.extname(originalName) || this.extensionFromMimeType(mimeType)
    const key = `local/${safeFolder}/${uuidv4()}${ext}`
    const relativePath = key.replace(/^local\//, '')
    const targetPath = path.resolve(this.uploadsRoot, relativePath)

    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, buffer)

    const publicPath = relativePath.split(path.sep).join('/').split('/').map(encodeURIComponent).join('/')
    return {
      key,
      url: `${this.getPublicBaseUrl()}/api/uploads/${publicPath}`,
    }
  }

  private extensionFromMimeType(mimeType: string) {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
      'application/zip': '.zip',
      'application/octet-stream': '',
      'model/stl': '.stl',
      'model/obj': '.obj',
      'application/sla': '.stl',
    }

    return map[mimeType] || ''
  }

  private getPublicBaseUrl() {
    const configured = process.env.API_PUBLIC_URL || process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL
    if (configured) {
      return configured.startsWith('http') ? configured : `https://${configured}`
    }

    return `http://localhost:${process.env.PORT || '3001'}`
  }
}

const s3Plugin: FastifyPluginAsync = fp(async (server) => {
  server.decorate('s3', new S3Service())
})

export { s3Plugin }
