// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url'

const sharedRoot = fileURLToPath(new URL('../shared', import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint'],
  runtimeConfig: {
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || '',
      mapTileUrl:
        process.env.NUXT_PUBLIC_MAP_TILE_URL
        || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    },
  },
  alias: {
    '@shared': sharedRoot,
    '@shared/types': `${sharedRoot}/types/index.ts`,
    '@shared/validation/username': `${sharedRoot}/validation/username.ts`,
    '@shared/strings/en.json': `${sharedRoot}/strings/en.json`,
  },
})
