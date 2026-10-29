import type { SpotReportResponse } from '@shared/types'
import type { PhotoModerationStatus } from '../../../shared/media/constants.ts'

export interface SubmitSpotRpcRow {
  pothole_id: string
  report_id: string
  merged: boolean
  confirmation_id: string | null
  confirmation_count: number
  points_awarded: number
}

export interface SubmitSpotWardLookup {
  ward_id: string | null
  authority: string | null
}

export interface SubmitSpotIngest {
  moderationStatus: PhotoModerationStatus
  publishedPhotoPath: string | null
}

/** Map `submit_spot` RPC row + server-side ingest/ward data to the public API response. */
export function mapSubmitSpotResult(
  row: SubmitSpotRpcRow,
  ingest: SubmitSpotIngest,
  wardRow: SubmitSpotWardLookup | null | undefined,
): SpotReportResponse {
  return {
    pothole_id: row.pothole_id,
    report_id: row.report_id,
    merged: row.merged,
    ward_id: wardRow?.ward_id ?? null,
    authority: wardRow?.authority ?? null,
    points_awarded: row.points_awarded ?? 0,
    photo_moderation_status: ingest.moderationStatus,
    published_photo_path: ingest.publishedPhotoPath,
  }
}
