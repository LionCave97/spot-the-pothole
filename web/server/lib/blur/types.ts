export interface Detection {
  x: number
  y: number
  w: number
  h: number
  score: number
  label: 'face' | 'plate'
}

export interface BlurSettings {
  faceBlurMinScore: number
  plateBlurMinScore: number
  publishMinScore: number
  blurPaddingRatio: number
  jpegQuality: number
  quarantineBucket: string
  publishedBucket: string
}

export const defaultBlurSettings: BlurSettings = {
  faceBlurMinScore: 0.55,
  plateBlurMinScore: 0.55,
  publishMinScore: 0.5,
  blurPaddingRatio: 0.12,
  jpegQuality: 82,
  quarantineBucket: 'spot-photos-quarantine',
  publishedBucket: 'spot-photos',
}

export interface ProcessOutcome {
  status: 'published' | 'pending' | 'skipped' | 'deferred' | 'retry'
  reason: string
  report_id?: string
  published_path?: string
  retryable?: boolean
}
