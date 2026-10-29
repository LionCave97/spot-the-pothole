import type { SupabaseClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import {
  claimReportForProcessing,
  clearProcessingAfterPublish,
  fetchReportForBlur,
  releaseProcessingLock,
  shouldRetryFailure,
} from './reportClaim'
import { decodeToBgr } from './imageBgr'
import { detectRegions } from './detectRegions'
import { applyPrivacyBlur, shouldPublish } from './privacyBlur'
import type { BlurSettings, ProcessOutcome } from './types'

function publishedStoragePath(userId: string, quarantinePath: string): string {
  const fileName = quarantinePath.split('/').pop() || `${Date.now()}.jpg`
  return `${userId}/${fileName}`
}

export async function processQuarantinePhoto(
  supabase: SupabaseClient,
  settings: BlurSettings,
  quarantinePath: string,
  reportId?: string,
): Promise<ProcessOutcome> {
  if (quarantinePath.includes('..') || quarantinePath.startsWith('/')) {
    return { status: 'skipped', reason: 'invalid_path' }
  }
  const parts = quarantinePath.split('/')
  if (parts.length < 2) return { status: 'skipped', reason: 'invalid_path' }
  const userId = parts[0]

  let report = await fetchReportForBlur(supabase, quarantinePath, reportId)
  if (!report) return { status: 'deferred', reason: 'report_not_found_yet' }

  if (report.photo_moderation_status === 'published' && report.published_photo_path) {
    return {
      status: 'skipped',
      reason: 'already_published',
      report_id: String(report.id),
      published_path: String(report.published_photo_path),
    }
  }

  const claim = await claimReportForProcessing(supabase, report)
  if (!claim.claimed) {
    if (claim.reason === 'processing_locked' || claim.reason === 'claim_lost_race') {
      return { status: 'retry', reason: claim.reason, report_id: String(report.id) }
    }
    if (claim.reason === 'max_attempts_exceeded') {
      return { status: 'pending', reason: 'max_attempts_exceeded', report_id: String(report.id) }
    }
    return { status: 'skipped', reason: claim.reason, report_id: String(report.id) }
  }

  report = claim.report
  const rid = String(report.id)
  const attemptCount = Number(report.photo_blur_attempt_count ?? 1)

  try {
    const { data: blob, error: dlErr } = await supabase.storage
      .from(settings.quarantineBucket)
      .download(quarantinePath)
    if (dlErr || !blob) {
      await releaseProcessingLock(supabase, rid, 'download_failed')
      return { status: 'pending', reason: 'download_failed', report_id: rid, retryable: true }
    }

    const raw = Buffer.from(await blob.arrayBuffer())
    const { bgr, width, height } = await decodeToBgr(raw)
    const oriented = sharp(raw, { autoOrient: true }).removeAlpha()
    const rgb = await oriented.raw().toBuffer()
    const meta = await oriented.metadata()
    const rgbW = meta.width ?? width
    const rgbH = meta.height ?? height

    const detections = await detectRegions(bgr, width, height)
    const blurResult = await applyPrivacyBlur(rgb, rgbW, rgbH, detections, {
      faceMinScore: settings.faceBlurMinScore,
      plateMinScore: settings.plateBlurMinScore,
      paddingRatio: settings.blurPaddingRatio,
      jpegQuality: settings.jpegQuality,
    })

    const publishCheck = shouldPublish(detections, blurResult.minScoreUsed, settings)
    if (!publishCheck.ok) {
      await releaseProcessingLock(supabase, rid, publishCheck.reason)
      return { status: 'pending', reason: publishCheck.reason, report_id: rid, retryable: false }
    }

    const publishedPath = publishedStoragePath(userId, quarantinePath)
    const { error: upErr } = await supabase.storage
      .from(settings.publishedBucket)
      .upload(publishedPath, blurResult.jpegBytes, { contentType: 'image/jpeg', upsert: false })

    if (upErr && !String(upErr.message).includes('Duplicate')) {
      await releaseProcessingLock(supabase, rid, 'upload_failed')
      return {
        status: 'pending',
        reason: 'upload_failed',
        report_id: rid,
        retryable: shouldRetryFailure('upload_failed', attemptCount),
      }
    }

    const { error: repErr } = await supabase
      .from('reports')
      .update({
        photo_moderation_status: 'published',
        published_photo_path: publishedPath,
        photo_blur_processing_at: null,
        photo_blur_last_error: null,
      })
      .eq('id', report.id)
      .eq('photo_moderation_status', 'pending')
    if (repErr) {
      await releaseProcessingLock(supabase, rid, 'report_update_failed')
      return { status: 'pending', reason: 'report_update_failed', report_id: rid, retryable: true }
    }

    await supabase.from('potholes').update({ photo_path: publishedPath }).eq('id', report.pothole_id)
    await clearProcessingAfterPublish(supabase, rid)
    await supabase.storage.from(settings.quarantineBucket).remove([quarantinePath])

    return {
      status: 'published',
      reason: 'ok',
      report_id: rid,
      published_path: publishedPath,
    }
  }
  catch {
    await releaseProcessingLock(supabase, rid, 'error')
    return {
      status: 'pending',
      reason: 'error',
      report_id: rid,
      retryable: shouldRetryFailure('error', attemptCount),
    }
  }
}
