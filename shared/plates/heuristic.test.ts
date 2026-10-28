import assert from 'node:assert/strict'
import test from 'node:test'

import { findPlateTokensInText, isLikelyPlateToken, platesMatchExpected } from './heuristic.ts'

test('detects modern spaced plate token', () => {
  assert.equal(isLikelyPlateToken('CA 123 ABC'), true)
})

test('rejects short noise', () => {
  assert.equal(isLikelyPlateToken('CA'), false)
})

test('finds tokens in multiline OCR', () => {
  const found = findPlateTokensInText('Some text\nGP 123 ABC\nmore')
  assert.ok(found.includes('GP 123 ABC'))
})

test('platesMatchExpected ignores spacing', () => {
  assert.equal(platesMatchExpected('CA123ABC', 'CA 123 ABC'), true)
})
