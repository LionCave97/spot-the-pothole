import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  NormalizedBlurRegion,
  PhotoModerationQueueItem,
  PhotoModerationQueueResponse,
} from '@shared/types'
import { SPOT_PHOTOS_QUARANTINE_BUCKET } from '../../../shared/media/constants.ts'
import {
  publishSpotPhotoToPublicBucket,
} from './spotPhotoQuarantine'
import { applyManualBlurRegions } from './photoBlur'

const SIGNED_URL_TTL_SEC = 300

interface PendingReportRow {
  id: string
  pothole_id: string
  reporter_id: string
  photo_path: string
  photo_moderation_status: 'pending' | 'published' | 'rejected'
  created_at: string
  potholes: { name: string } | { name: string }[] | null
}

export async function listPhotoModerationQueue(
  supabase: SupabaseClient,
): Promise<PhotoModerationQueueResponse> {
  const { data: reports, error } = await supabase
    .from('reports')
    .select(
      'id,pothole_id,reporter_id,photo_path,photo_moderation_status,created_at,potholes(name)',
    )
    .eq('photo_moderation_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = (reports ?? []) as PendingReportRow[]
  const reportIds = rows.map(r => r.id)

  const flagCounts = new Map<string, number>()
  if (reportIds.length) {
    const { data: flags } = await supabase
      .from('moderation_flags')
      .select('target_id')
      .eq('target_type', 'report')
      .in('target_id', reportIds)

    for (const flag of flags ?? []) {
      const id = flag.target_id as string
      flagCounts.set(id, (flagCounts.get(id) ?? 0) + 1)
    }
  }

  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SEC * 1000).toISOString()
  const items: PhotoModerationQueueItem[] = []

  for (const row of rows) {
    const potholeRel = row.potholes
    const potholeName = Array.isArray(potholeRel)
      ? potholeRel[0]?.name
      : potholeRel?.name

    const { data: signed, error: signErr } = await supabase.storage
      .from(SPOT_PHOTOS_QUARANTINE_BUCKET)
      .createSignedUrl(row.photo_path, SIGNED_URL_TTL_SEC)

    if (signErr || !signed?.signedUrl) {
      throw createError({
        statusCode: 500,
        statusMessage: signErr?.message || 'Failed to sign quarantine URL',
      })
    }

    items.push({
      report_id: row.id,
      pothole_id: row.pothole_id,
      pothole_name: potholeName ?? 'Unknown',
      reporter_id: row.reporter_id,
      quarantine_path: row.photo_path,
      signed_url: signed.signedUrl,
      signed_url_expires_at: expiresAt,
      photo_moderation_status: row.photo_moderation_status,
      flag_count: flagCounts.get(row.id) ?? 0,
      created_at: row.created_at,
    })
  }

  // Also surface flagged pending-adjacent items already in pending set — flag_count covers badge.
  return { items }
}

async function downloadQuarantinePhoto(
  supabase: SupabaseClient,
  quarantinePath: string,
): Promise<Buffer> {
  const { data, error } = await supabase.storage
    .from(SPOT_PHOTOS_QUARANTINE_BUCKET)
    .download(quarantinePath)

  if (error || !data) {
    throw createError({ statusCode: 404, statusMessage: 'Quarantine photo not found' })
  }

  return Buffer.from(await data.arrayBuffer())
}

async function deleteQuarantinePhoto(
  supabase: SupabaseClient,
  quarantinePath: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(SPOT_PHOTOS_QUARANTINE_BUCKET)
    .remove([quarantinePath])

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
}

async function insertAuditLog(
  supabase: SupabaseClient,
  params: {
    reportId: string
    moderatorId: string
    decision: 'approved' | 'rejected'
    rejectionReason?: string | null
    extraBlurRegions?: NormalizedBlurRegion[]
  },
): Promise<void> {
  const { error } = await supabase.from('photo_moderation_audit_log').insert({
    report_id: params.reportId,
    moderator_id: params.moderatorId,
    decision: params.decision,
    rejection_reason: params.rejectionReason ?? null,
    extra_blur_regions: params.extraBlurRegions ?? [],
  })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
}

export async function approveModerationPhoto(
  supabase: SupabaseClient,
  moderatorId: string,
  reportId: string,
  blurRegions: NormalizedBlurRegion[],
): Promise<{ published_photo_path: string }> {
  const { data: report, error } = await supabase
    .from('reports')
    .select('id,pothole_id,reporter_id,photo_path,photo_moderation_status')
    .eq('id', reportId)
    .maybeSingle()

  if (error || !report) {
    throw createError({ statusCode: 404, statusMessage: 'Report not found' })
  }

  if (report.photo_moderation_status !== 'pending') {
    throw createError({ statusCode: 409, statusMessage: 'Report is not pending moderation' })
  }

  const quarantinePath = report.photo_path as string
  const reporterId = report.reporter_id as string
  const raw = await downloadQuarantinePhoto(supabase, quarantinePath)
  const blurred = await applyManualBlurRegions(raw, blurRegions)
  const publishedPath = await publishSpotPhotoToPublicBucket(
    supabase,
    reporterId,
    quarantinePath,
    new Blob([blurred], { type: 'image/jpeg' }),
  )

  const { error: reportErr } = await supabase
    .from('reports')
    .update({
      photo_moderation_status: 'published',
      published_photo_path: publishedPath,
      rejection_reason: null,
    })
    .eq('id', reportId)

  if (reportErr) {
    throw createError({ statusCode: 500, statusMessage: reportErr.message })
  }

  const { error: potholeErr } = await supabase
    .from('potholes')
    .update({ photo_path: publishedPath })
    .eq('id', report.pothole_id)

  if (potholeErr) {
    throw createError({ statusCode: 500, statusMessage: potholeErr.message })
  }

  await deleteQuarantinePhoto(supabase, quarantinePath)

  await insertAuditLog(supabase, {
    reportId,
    moderatorId,
    decision: 'approved',
    extraBlurRegions: blurRegions,
  })

  return { published_photo_path: publishedPath }
}

export async function rejectModerationPhoto(
  supabase: SupabaseClient,
  moderatorId: string,
  reportId: string,
  reason: string,
): Promise<void> {
  const trimmed = reason.trim()
  if (trimmed.length < 3 || trimmed.length > 500) {
    throw createError({ statusCode: 400, statusMessage: 'Rejection reason required (3–500 chars)' })
  }

  const { data: report, error } = await supabase
    .from('reports')
    .select('id,photo_path,photo_moderation_status')
    .eq('id', reportId)
    .maybeSingle()

  if (error || !report) {
    throw createError({ statusCode: 404, statusMessage: 'Report not found' })
  }

  if (report.photo_moderation_status !== 'pending') {
    throw createError({ statusCode: 409, statusMessage: 'Report is not pending moderation' })
  }

  const quarantinePath = report.photo_path as string
  await deleteQuarantinePhoto(supabase, quarantinePath)

  const { error: reportErr } = await supabase
    .from('reports')
    .update({
      photo_moderation_status: 'rejected',
      published_photo_path: null,
      rejection_reason: trimmed,
    })
    .eq('id', reportId)

  if (reportErr) {
    throw createError({ statusCode: 500, statusMessage: reportErr.message })
  }

  await insertAuditLog(supabase, {
    reportId,
    moderatorId,
    decision: 'rejected',
    rejectionReason: trimmed,
  })
}
