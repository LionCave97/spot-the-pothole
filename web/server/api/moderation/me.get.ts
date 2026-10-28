import { requireModerator } from '../../utils/moderator'

/** Returns 403 for non-moderators; used by the admin page SSR gate. */
export default defineEventHandler(async (event) => {
  await requireModerator(event)
  return { ok: true }
})
