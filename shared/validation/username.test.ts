import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateUsername } from './username.ts'

describe('validateUsername', () => {
  it('accepts valid nicknames', () => {
    assert.equal(validateUsername('crater_captain'), null)
  })

  it('rejects spaced names', () => {
    assert.equal(validateUsername('John Smith'), 'looksLikeFullName')
  })
})
