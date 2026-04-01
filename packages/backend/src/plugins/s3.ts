import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
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
    this.s3Enabled = Boolean(endpoint && accessKeyId && secretAccessKey)

    const clientConfig: Record<string, unknown> = {
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
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
