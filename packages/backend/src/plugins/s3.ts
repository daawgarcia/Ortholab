import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

declare module 'fastify' {
  interface FastifyInstance {
    s3: S3Service
  }
}

class S3Service {
  private client: S3Client
  private bucket: string

  constructor() {
    this.client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
      },
      forcePathStyle: true,
    })
    this.bucket = process.env.S3_BUCKET || 'ortholab-files'
  }

  async upload(buffer: Buffer, originalName: string, mimeType: string, folder: string = 'uploads'): Promise<{ key: string; url: string }> {
    const ext = originalName.split('.').pop()
    const key = `${folder}/${uuidv4()}.${ext}`
    
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }))

    const url = `${process.env.S3_ENDPOINT}/${this.bucket}/${key}`
    return { key, url }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    return getSignedUrl(this.client, command, { expiresIn })
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }
}

const s3Plugin: FastifyPluginAsync = fp(async (server) => {
  server.decorate('s3', new S3Service())
})

export { s3Plugin }
