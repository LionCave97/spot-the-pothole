// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url'

const sharedRoot = fileURLToPath(new URL('../shared', import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint'],
  runtimeConfig: {
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    blurWebhookSecret: process.env.BLUR_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '',
    blurQuarantineBucket: process.env.BLUR_QUARANTINE_BUCKET || 'spot-photos-quarantine',
    blurPublishedBucket: process.env.BLUR_PUBLISHED_BUCKET || 'spot-photos',
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || '',
      mapTileUrl:
        process.env.NUXT_PUBLIC_MAP_TILE_URL
        || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    },
  },
  nitro: {
    preset: 'vercel',
    serverAssets: [
      {
        baseName: 'blur-models',
        dir: './server/assets/blur-models',
      },
    ],
    externals: {
      inline: ['onnxruntime-web'],
    },
    publicAssets: [
      {
        baseURL: 'ort-wasm',
        dir: '../node_modules/onnxruntime-web/dist',
        maxAge: 60 * 60 * 24 * 365,
      },
    ],
    vercel: {
      config: {
        functions: {
          'api/internal/blur': {
            memory: 2048,
            maxDuration: 300,
          },
        },
      },
    },
  },
  alias: {
    '@shared': sharedRoot,
    '@shared/types': `${sharedRoot}/types/index.ts`,
    '@shared/validation/username': `${sharedRoot}/validation/username.ts`,
    '@shared/strings/en.json': `${sharedRoot}/strings/en.json`,
  },
})
