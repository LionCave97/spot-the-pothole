import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PHOTO_BLUR_MAX_ATTEMPTS,
  decideClaimWithoutRpc,
  shouldRetryFailure,
  type ReportBlurRow,
} from './claim'

const REPORT_SELECT =
  'id,pothole_id,photo_path,photo_moderation_status,published_photo_path,reporter_id,photo_blur_attempt_count,photo_blur_processing_at,photo_blur_last_error'

export async function fetchReportForBlur(
  supabase: SupabaseClient,
  quarantinePath: string,
  reportId?: string,
): Promise<Record<string, unknown> | null> {
  if (reportId) {
    const { data } = await supabase.from('reports').select(REPORT_SELECT).eq('id', reportId).maybeSingle()
    if (data && String(data.photo_path) === quarantinePath) return data
    return null
  }
  const { data } = await supabase
    .from('reports')
    .select(REPORT_SELECT)
    .eq('photo_path', quarantinePath)
    .limit(1)
    .maybeSingle()
  return data
}

export async function claimReportForProcessing(
  supabase: SupabaseClient,
  report: Record<string, unknown>,
): Promise<{ claimed: boolean, reason: string, report: Record<string, unknown> }> {
  const row: ReportBlurRow = {
    id: String(report.id),
    photo_moderation_status: String(report.photo_moderation_status),
    published_photo_path: report.published_photo_path ? String(report.published_photo_path) : null,
    photo_blur_attempt_count: Number(report.photo_blur_attempt_count ?? 0),
    photo_blur_processing_at: report.photo_blur_processing_at ? String(report.photo_blur_processing_at) : null,
  }

  const pre = decideClaimWithoutRpc(row, Date.now())
  if (pre.action === 'skip') return { claimed: false, reason: pre.reason, report }
  if (pre.action === 'wait') return { claimed: false, reason: pre.reason, report }

  const { data, error } = await supabase.rpc('claim_photo_blur_report', {
    p_report_id: row.id,
    p_max_attempts: PHOTO_BLUR_MAX_ATTEMPTS,
  })

  if (error) {
    return { claimed: false, reason: 'claim_error', report }
  }
  if (!data) {
    return { claimed: false, reason: 'claim_lost_race', report }
  }
  return { claimed: true, reason: 'ok', report: data as Record<string, unknown> }
}

export async function releaseProcessingLock(
  supabase: SupabaseClient,
  reportId: string,
  lastError: string | null,
): Promise<void> {
  await supabase
    .from('reports')
    .update({
      photo_blur_processing_at: null,
      photo_blur_last_error: lastError,
    })
    .eq('id', reportId)
}

export async function clearProcessingAfterPublish(supabase: SupabaseClient, reportId: string): Promise<void> {
  await supabase
    .from('reports')
    .update({
      photo_blur_processing_at: null,
      photo_blur_last_error: null,
    })
    .eq('id', reportId)
}

export { shouldRetryFailure }
