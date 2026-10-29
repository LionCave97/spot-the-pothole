/** Username rules mirrored in Postgres `public.validate_username`. */

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/

const BLOCKED = new Set([
  'admin',
  'moderator',
  'support',
  'anonymous',
  'spotthepothole',
])

/** Returns an i18n error key under `onboarding.usernameError.*`, or null if valid. */
export function validateUsername(username: string): string | null {
  const trimmed = username.trim()
  if (/\s/.test(trimmed) || trimmed.includes('@')) {
    return 'looksLikeFullName'
  }
  const segments = trimmed.split(/[\s._-]+/).filter(Boolean)
  if (segments.length >= 2 && segments.every(s => /^[A-Z]/.test(s))) {
    return 'looksLikeFullName'
  }

  const normalized = trimmed.toLowerCase()
  if (!USERNAME_PATTERN.test(normalized)) {
    return 'invalidFormat'
  }
  if (BLOCKED.has(normalized)) {
    return 'blocked'
  }
  return null
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}
