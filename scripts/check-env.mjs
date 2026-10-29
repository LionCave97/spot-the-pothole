#!/usr/bin/env node
/**
 * Fail fast when required deployment env vars are missing.
 * Usage:
 *   node scripts/check-env.mjs --target=vercel
 *   node scripts/check-env.mjs --target=mobile
 *   node scripts/check-env.mjs --target=all
 */
import { parseArgs } from 'node:util'

const GROUPS = {
  vercel: {
    label: 'Vercel (web/) production',
    vars: [
      'NUXT_PUBLIC_SUPABASE_URL',
      'NUXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'BLUR_WEBHOOK_SECRET',
    ],
    optional: [
      'BLUR_QUARANTINE_BUCKET',
      'BLUR_PUBLISHED_BUCKET',
      'NUXT_PUBLIC_MAP_TILE_URL',
      'WEBHOOK_SECRET',
    ],
  },
  mobile: {
    label: 'Android / iOS (local .env or build config)',
    vars: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'WEB_API_BASE'],
  },
}

function isSet(name) {
  const v = process.env[name]
  return typeof v === 'string' && v.trim().length > 0 && !/^your-/.test(v.trim())
}

function checkGroup(key) {
  const group = GROUPS[key]
  if (!group) {
    console.error(`Unknown target "${key}". Use: ${Object.keys(GROUPS).join(', ')}, or all.`)
    process.exit(2)
  }

  const missing = group.vars.filter((name) => !isSet(name))
  if (missing.length === 0) {
    console.log(`OK — ${group.label}: all required variables set.`)
    if (group.optional?.length) {
      const unsetOptional = group.optional.filter((name) => !isSet(name))
      if (unsetOptional.length) {
        console.log(`  (optional defaults apply: ${unsetOptional.join(', ')})`)
      }
    }
    return true
  }

  console.error(`Missing required env for ${group.label}:`)
  for (const name of missing) {
    console.error(`  - ${name}`)
  }
  console.error('\nSee docs/DEPLOY.md and web/.env.example for names and where to set them.')
  return false
}

const { values } = parseArgs({
  options: {
    target: { type: 'string', default: 'vercel' },
  },
})

const target = values.target ?? 'vercel'
const keys = target === 'all' ? Object.keys(GROUPS) : [target]
let ok = true
for (const key of keys) {
  if (!checkGroup(key)) ok = false
}
process.exit(ok ? 0 : 1)
