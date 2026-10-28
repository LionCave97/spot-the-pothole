import { describe, expect, it } from 'vitest'
import { normalizeUsername, validateUsername } from '../../shared/validation/username'

describe('validateUsername', () => {
  it('accepts valid nicknames', () => {
    expect(validateUsername('crater_captain')).toBeNull()
    expect(normalizeUsername(' Crater_Captain ')).toBe('crater_captain')
  })

  it('rejects short and spaced names', () => {
    expect(validateUsername('ab')).toBe('invalidFormat')
    expect(validateUsername('John Smith')).toBe('looksLikeFullName')
  })

  it('blocks reserved words', () => {
    expect(validateUsername('admin')).toBe('blocked')
  })
})
