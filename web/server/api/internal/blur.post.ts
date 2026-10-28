import { useServerSupabase } from '../../utils/supabase'
import { processQuarantinePhoto } from '../../lib/blur/pipeline'
import { defaultBlurSettings } from '../../lib/blur/types'
import {
  parseReportWebhook,
  parseStorageWebhook,
  verifyWebhookSecret,
} from '../../lib/blur/webhook'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const secret = config.blurWebhookSecret
  if (!secret) {
    throw createError({ statusCode: 500, statusMessage: 'BLUR_WEBHOOK_SECRET is not configured' })
  }

  const xSecret = getHeader(event, 'x-webhook-secret')
  const authorization = getHeader(event, 'authorization')
  if (!verifyWebhookSecret(xSecret, secret, authorization)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid webhook secret' })
  }

  const payload = await readBody<Record<string, unknown>>(event)
  const settings = {
    ...defaultBlurSettings,
    quarantineBucket: config.blurQuarantineBucket || defaultBlurSettings.quarantineBucket,
    publishedBucket: config.blurPublishedBucket || defaultBlurSettings.publishedBucket,
  }

  const supabase = useServerSupabase(event)

  let outcome
  const storage = parseStorageWebhook(payload)
  if (storage && storage.bucket_id === settings.quarantineBucket) {
    if (!['INSERT', 'UPDATE'].includes(storage.event_type)) {
      return { status: 'ignored', reason: storage.event_type }
    }
    outcome = await processQuarantinePhoto(supabase, settings, storage.object_path)
  }
  else {
    const report = parseReportWebhook(payload)
    if (report) {
      if (report.moderation_status !== 'pending') {
        return { status: 'ignored', reason: 'not_pending' }
      }
      if (report.published_photo_path) {
        return { status: 'skipped', reason: 'already_published' }
      }
      outcome = await processQuarantinePhoto(supabase, settings, report.photo_path, report.report_id)
    }
    else {
      throw createError({ statusCode: 400, statusMessage: 'Unrecognized payload' })
    }
  }

  if (outcome.status === 'retry') {
    setResponseStatus(event, 202)
  }
  return outcome
})

export const maxDuration = 300
