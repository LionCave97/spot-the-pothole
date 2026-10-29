<script setup lang="ts">
import type {
  NormalizedBlurRegion,
  PhotoModerationQueueItem,
  PhotoModerationQueueResponse,
} from '@shared/types'

const strings = useStrings()
const supabase = useSupabaseClient()
const { authHeaders: buildAuthHeaders } = useModerationAuth()

const accessDenied = ref(false)
const loading = ref(true)
const queue = ref<PhotoModerationQueueItem[]>([])
const selectedId = ref<string | null>(null)
const rejectReason = ref('')
const actionPending = ref(false)
const errorMessage = ref<string | null>(null)

const blurRegions = ref<NormalizedBlurRegion[]>([])
const drawStart = ref<{ x: number, y: number } | null>(null)
const imageEl = ref<HTMLImageElement | null>(null)

const selectedItem = computed(() =>
  queue.value.find(i => i.report_id === selectedId.value) ?? null,
)

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  return buildAuthHeaders(data.session)
}

async function loadQueue() {
  loading.value = true
  errorMessage.value = null
  try {
    const headers = await authHeaders()
    const res = await $fetch<PhotoModerationQueueResponse>('/api/moderation/photos', { headers })
    queue.value = res.items
    if (!selectedId.value && res.items.length) {
      selectedId.value = res.items[0].report_id
    }
    blurRegions.value = []
  }
  catch (err: unknown) {
    const fetchErr = err as { statusCode?: number, statusMessage?: string }
    if (fetchErr.statusCode === 403) {
      accessDenied.value = true
    }
    else {
      errorMessage.value = fetchErr.statusMessage || strings.errors.generic
    }
  }
  finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const headers = await authHeaders()
    await $fetch('/api/moderation/me', { headers })
    await loadQueue()
  }
  catch (err: unknown) {
    const fetchErr = err as { statusCode?: number }
    if (fetchErr.statusCode === 403) {
      accessDenied.value = true
    }
    else if (fetchErr.statusCode === 401) {
      errorMessage.value = strings.errors.unauthorized
    }
    loading.value = false
  }
})

function normalizedFromEvent(event: MouseEvent, el: HTMLImageElement): { x: number, y: number } {
  const rect = el.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  }
}

function onImagePointerDown(event: MouseEvent) {
  if (!imageEl.value) {
    return
  }
  drawStart.value = normalizedFromEvent(event, imageEl.value)
}

function onImagePointerUp(event: MouseEvent) {
  if (!imageEl.value || !drawStart.value) {
    return
  }
  const end = normalizedFromEvent(event, imageEl.value)
  const x = Math.min(drawStart.value.x, end.x)
  const y = Math.min(drawStart.value.y, end.y)
  const width = Math.abs(end.x - drawStart.value.x)
  const height = Math.abs(end.y - drawStart.value.y)
  drawStart.value = null
  if (width < 0.01 || height < 0.01) {
    return
  }
  blurRegions.value.push({ x, y, width, height })
}

function removeRegion(index: number) {
  blurRegions.value.splice(index, 1)
}

async function approveSelected() {
  if (!selectedItem.value) {
    return
  }
  actionPending.value = true
  errorMessage.value = null
  try {
    const headers = await authHeaders()
    await $fetch(`/api/moderation/photos/${selectedItem.value.report_id}/approve`, {
      method: 'POST',
      headers,
      body: { blur_regions: blurRegions.value },
    })
    queue.value = queue.value.filter(i => i.report_id !== selectedItem.value!.report_id)
    selectedId.value = queue.value[0]?.report_id ?? null
    blurRegions.value = []
  }
  catch (err: unknown) {
    const fetchErr = err as { statusMessage?: string }
    errorMessage.value = fetchErr.statusMessage || strings.errors.generic
  }
  finally {
    actionPending.value = false
  }
}

async function rejectSelected() {
  if (!selectedItem.value) {
    return
  }
  actionPending.value = true
  errorMessage.value = null
  try {
    const headers = await authHeaders()
    await $fetch(`/api/moderation/photos/${selectedItem.value.report_id}/reject`, {
      method: 'POST',
      headers,
      body: { reason: rejectReason.value },
    })
    queue.value = queue.value.filter(i => i.report_id !== selectedItem.value!.report_id)
    selectedId.value = queue.value[0]?.report_id ?? null
    rejectReason.value = ''
    blurRegions.value = []
  }
  catch (err: unknown) {
    const fetchErr = err as { statusMessage?: string }
    errorMessage.value = fetchErr.statusMessage || strings.errors.generic
  }
  finally {
    actionPending.value = false
  }
}
</script>

<template>
  <div>
    <p><NuxtLink to="/">{{ strings.common.back }}</NuxtLink></p>
    <h1>{{ strings.moderation.photoQueueTitle }}</h1>

    <p v-if="loading">{{ strings.common.loading }}</p>
    <p v-else-if="accessDenied">{{ strings.moderation.forbidden }}</p>
    <p v-else-if="errorMessage" class="error">{{ errorMessage }}</p>

    <template v-else>
      <p class="hint">{{ strings.moderation.photoQueueHint }}</p>
      <p v-if="!queue.length">{{ strings.moderation.photoQueueEmpty }}</p>

      <div v-else class="layout">
        <ul class="queue">
          <li
            v-for="item in queue"
            :key="item.report_id"
          >
            <button
              type="button"
              class="queue-item"
              :class="{ active: item.report_id === selectedId }"
              @click="selectedId = item.report_id; blurRegions = []"
            >
              {{ item.pothole_name }}
              <span class="badge">{{ strings.moderation.pendingBadge }}</span>
              <span v-if="item.flag_count" class="badge flagged">{{ strings.moderation.flaggedBadge }} ({{ item.flag_count }})</span>
            </button>
          </li>
        </ul>

        <div v-if="selectedItem" class="review">
          <div class="canvas-wrap">
            <img
              ref="imageEl"
              :src="selectedItem.signed_url"
              alt=""
              class="photo"
              @mousedown.prevent="onImagePointerDown"
              @mouseup.prevent="onImagePointerUp"
            >
            <div
              v-for="(region, idx) in blurRegions"
              :key="idx"
              class="region"
              :style="{
                left: `${region.x * 100}%`,
                top: `${region.y * 100}%`,
                width: `${region.width * 100}%`,
                height: `${region.height * 100}%`,
              }"
              @click.stop="removeRegion(idx)"
            />
          </div>
          <p class="hint">{{ strings.moderation.drawBlurHint }}</p>

          <div class="actions">
            <button
              type="button"
              :disabled="actionPending"
              @click="approveSelected"
            >
              {{ strings.moderation.approve }}
            </button>
            <label>
              {{ strings.moderation.rejectReasonLabel }}
              <input
                v-model="rejectReason"
                type="text"
                :placeholder="strings.moderation.rejectReasonPlaceholder"
              >
            </label>
            <button
              type="button"
              class="danger"
              :disabled="actionPending"
              @click="rejectSelected"
            >
              {{ strings.moderation.reject }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.hint { font-size: 0.85rem; color: #666; }
.error { color: #b00020; }
.layout { display: flex; gap: 1.5rem; flex-wrap: wrap; margin-top: 1rem; }
.queue { list-style: none; padding: 0; margin: 0; min-width: 14rem; }
.queue-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.5rem;
  margin-bottom: 0.35rem;
  border: 1px solid #ccc;
  background: #fff;
  cursor: pointer;
}
.queue-item.active { border-color: #111; background: #f5f5f5; }
.badge {
  display: inline-block;
  margin-left: 0.35rem;
  font-size: 0.7rem;
  padding: 0.1rem 0.35rem;
  background: #eee;
  border-radius: 4px;
}
.badge.flagged { background: #ffe0b2; }
.review { flex: 1; min-width: 280px; }
.canvas-wrap {
  position: relative;
  max-width: 640px;
  user-select: none;
}
.photo {
  display: block;
  width: 100%;
  height: auto;
  cursor: crosshair;
}
.region {
  position: absolute;
  border: 2px dashed #c62828;
  background: rgba(198, 40, 40, 0.15);
  box-sizing: border-box;
  cursor: pointer;
}
.actions {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 420px;
}
.danger { color: #b00020; }
</style>
