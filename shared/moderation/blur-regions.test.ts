import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { blurRegionsToPixels, validateBlurRegions } from './blur-regions.ts'

describe('validateBlurRegions', () => {
  it('accepts valid normalized boxes', () => {
    const regions = validateBlurRegions([{ x: 0.1, y: 0.2, width: 0.3, height: 0.4 }])
    assert.ok(regions)
    assert.equal(regions!.length, 1)
  })

  it('rejects out-of-bounds boxes', () => {
    assert.equal(validateBlurRegions([{ x: 0.9, y: 0.1, width: 0.3, height: 0.2 }]), null)
  })

  it('rejects non-arrays', () => {
    assert.equal(validateBlurRegions({}), null)
  })
})

describe('blurRegionsToPixels', () => {
  it('maps to pixel coordinates', () => {
    const pixels = blurRegionsToPixels(
      [{ x: 0.5, y: 0.5, width: 0.25, height: 0.25 }],
      800,
      600,
    )
    assert.deepEqual(pixels[0], { left: 400, top: 300, width: 200, height: 150 })
  })
})
