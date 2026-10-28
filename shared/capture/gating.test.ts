import assert from 'node:assert/strict'
import test from 'node:test'

import { evaluateSpotCaptureGate, type SpotLocationSample } from './gating.ts'

function sample(overrides: Partial<SpotLocationSample> = {}): SpotLocationSample {
  return {
    lat: -26.2041,
    lng: 28.0473,
    accuracyMeters: 10,
    speedMps: 0,
    capturedAt: new Date().toISOString(),
    ...overrides,
  }
}

test('allows capture when stationary with good accuracy', () => {
  const result = evaluateSpotCaptureGate(sample())
  assert.equal(result.allowed, true)
  assert.equal(result.reason, null)
})

test('blocks when speed above threshold', () => {
  const result = evaluateSpotCaptureGate(sample({ speedMps: 4 })) // ~14.4 km/h
  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'speed')
})

test('blocks when accuracy is poor', () => {
  const result = evaluateSpotCaptureGate(sample({ accuracyMeters: 120 }))
  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'accuracy')
})

test('blocks when location missing', () => {
  const result = evaluateSpotCaptureGate(null)
  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'no_location')
})
