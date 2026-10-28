/** Shared API and domain types for Spot the Pothole (Phase 1). */

export type PotholeStatus = 'open' | 'fixed' | 'comeback'

export type ModerationFlagReason =
  | 'spam'
  | 'unsafe'
  | 'wrong_location'
  | 'other'

export interface Profile {
  id: string
  username: string | null
  is_anonymous: boolean
  points: number
  created_at: string
}

export interface Ward {
  id: string
  name: string
  mdb_code: string
  councillor: string | null
  party: string | null
  as_of: string
  /** GeoJSON polygon (client-side decode). */
  boundary_geojson?: unknown
}

export interface Pothole {
  id: string
  name: string
  status: PotholeStatus
  lat: number
  lng: number
  road_ref: string | null
  authority: string | null
  ward_id: string | null
  first_seen: string
  fixed_at: string | null
  comeback_count: number
  parent_pothole_id: string | null
  confirmation_count: number
  photo_path: string | null
}

export interface Report {
  id: string
  pothole_id: string
  reporter_id: string
  photo_path: string
  lat: number
  lng: number
  created_at: string
}

export interface Confirmation {
  id: string
  pothole_id: string
  confirmer_id: string
  lat: number
  lng: number
  created_at: string
}

export interface TimelineEvent {
  id: string
  pothole_id: string
  event_type: string
  payload: Record<string, unknown>
  created_at: string
}

export interface Badge {
  id: string
  slug: string
  name: string
  description: string
}

export interface UserBadge {
  user_id: string
  badge_id: string
  awarded_at: string
}

export interface Comment {
  id: string
  pothole_id: string
  author_id: string
  body: string
  created_at: string
}

export interface Like {
  id: string
  pothole_id: string
  user_id: string
  created_at: string
}

export interface ModerationFlag {
  id: string
  target_type: 'pothole' | 'comment' | 'report'
  target_id: string
  reporter_id: string
  reason: ModerationFlagReason
  details: string | null
  created_at: string
}

/** Game action requests (web server routes). */
export interface SpotReportRequest {
  lat: number
  lng: number
  name: string
  photo_path: string
  road_ref?: string
}

export interface SpotReportResponse {
  pothole_id: string
  report_id: string
  merged: boolean
  ward_id: string | null
  authority: string | null
  points_awarded: number
  photo_moderation_status: 'pending' | 'published' | 'rejected'
  published_photo_path: string | null
}

export interface ConfirmPotholeRequest {
  pothole_id: string
  lat: number
  lng: number
}

export interface ConfirmPotholeResponse {
  confirmation_id: string
  confirmation_count: number
  points_awarded: number
}

export interface MergeDuplicatesRequest {
  lat: number
  lng: number
  radius_m?: number
}

export interface ResponsibilityLookupResponse {
  ward_id: string | null
  ward_name: string | null
  authority: string | null
  road_ref: string | null
}

export interface ScoreLeaderboardEntry {
  user_id: string
  username: string | null
  is_anonymous: boolean
  points: number
  rank: number
}

export interface WardScorecard {
  ward_id: string
  ward_name: string
  open_count: number
  fixed_count: number
  median_fix_days: number | null
  response_score: number
  councillor: string | null
  party: string | null
  as_of: string
}
