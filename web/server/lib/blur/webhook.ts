import { timingSafeEqual } from 'node:crypto'

export interface StorageObjectEvent {
  bucket_id: string
  object_path: string
  event_type: string
}

export interface ReportEvent {
  report_id: string
  photo_path: string
  moderation_status: string
  published_photo_path: string | null
}

export function verifyWebhookSecret(
  provided: string | null | undefined,
  expected: string,
  authorization?: string | null,
): boolean {
  if (!expected) return false
  if (provided && safeEqual(provided.trim(), expected)) return true
  if (authorization) {
    const prefix = 'Bearer '
    if (authorization.startsWith(prefix)) {
      const token = authorization.slice(prefix.length).trim()
      if (safeEqual(token, expected)) return true
    }
  }
  return false
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export function parseStorageWebhook(payload: Record<string, unknown>): StorageObjectEvent | null {
  const record = (payload.record ?? {}) as Record<string, unknown>
  const bucket_id = (record.bucket_id ?? record.bucketId) as string | undefined
  const name = (record.name ?? record.path) as string | undefined
  if (!bucket_id || !name) return null
  const event_type = String(payload.type ?? payload.eventType ?? 'INSERT').toUpperCase()
  return { bucket_id: String(bucket_id), object_path: String(name), event_type }
}

export function parseReportWebhook(payload: Record<string, unknown>): ReportEvent | null {
  const record = (payload.record ?? {}) as Record<string, unknown>
  const report_id = record.id
  const photo_path = record.photo_path
  if (!report_id || !photo_path) return null
  return {
    report_id: String(report_id),
    photo_path: String(photo_path),
    moderation_status: String(record.photo_moderation_status ?? 'pending'),
    published_photo_path: record.published_photo_path ? String(record.published_photo_path) : null,
  }
}
