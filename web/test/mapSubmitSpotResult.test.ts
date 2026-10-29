import { describe, expect, it } from 'vitest'
import { POTHOL_MERGE_RADIUS_METERS } from '../../shared/constants'
import { mapSubmitSpotResult } from '../server/utils/mapSubmitSpotResult'

describe('mapSubmitSpotResult', () => {
  const ingest = {
    moderationStatus: 'pending' as const,
    publishedPhotoPath: null,
  }

  it('maps merged confirmation with points', () => {
    const result = mapSubmitSpotResult(
      {
        pothole_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        report_id: '11111111-1111-4111-8111-111111111111',
        merged: true,
        confirmation_id: '22222222-2222-4222-8222-222222222222',
        confirmation_count: 2,
        points_awarded: 10,
      },
      ingest,
      { ward_id: 'ward-1', authority: 'City of Johannesburg Roads' },
    )

    expect(result.merged).toBe(true)
    expect(result.points_awarded).toBe(10)
    expect(result.pothole_id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1')
    expect(result.photo_moderation_status).toBe('pending')
    expect(result.ward_id).toBe('ward-1')
  })

  it('maps new spot without merge', () => {
    const result = mapSubmitSpotResult(
      {
        pothole_id: '33333333-3333-4333-8333-333333333333',
        report_id: '44444444-4444-4444-8444-444444444444',
        merged: false,
        confirmation_id: null,
        confirmation_count: 0,
        points_awarded: 0,
      },
      ingest,
      null,
    )

    expect(result.merged).toBe(false)
    expect(result.points_awarded).toBe(0)
    expect(result.authority).toBeNull()
  })
})

describe('POTHOL_MERGE_RADIUS_METERS', () => {
  it('matches Postgres pothole_merge_radius_meters default', () => {
    expect(POTHOL_MERGE_RADIUS_METERS).toBe(15)
  })
})
