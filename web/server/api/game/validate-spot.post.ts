import type { SpotReportRequest } from '@shared/types'
import spotSchema from '@shared/schemas/spot-report.request.json'

export default defineEventHandler(async (event) => {
  const body = await readBody<SpotReportRequest>(event)
  const required = (spotSchema.required ?? []) as string[]
  const missing = required.filter(k => !(body as Record<string, unknown>)?.[k])
  return { valid: missing.length === 0, missing }
})
