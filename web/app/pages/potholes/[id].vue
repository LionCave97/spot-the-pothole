<script setup lang="ts">
const strings = useStrings()
const route = useRoute()
const supabase = useSupabaseClient()
const config = useRuntimeConfig()

const id = computed(() => route.params.id as string)

function publicSpotPhotoUrl(storagePath: string): string {
  const base = config.public.supabaseUrl.replace(/\/$/, '')
  return `${base}/storage/v1/object/public/spot-photos/${storagePath}`
}

const { data: pothole, pending } = await useAsyncData(
  () => `pothole-${id.value}`,
  async () => {
    const { data } = await supabase
      .from('potholes')
      .select('*')
      .eq('id', id.value)
      .maybeSingle()
    return data
  },
)

const photoUrl = computed(() => {
  const path = pothole.value?.photo_path
  if (!path || !config.public.supabaseUrl) {
    return null
  }
  return publicSpotPhotoUrl(path)
})
</script>

<template>
  <div>
    <p><NuxtLink to="/map">{{ strings.common.back }}</NuxtLink></p>
    <p v-if="pending">{{ strings.common.loading }}</p>
    <template v-else-if="pothole">
      <h1>{{ pothole.name }}</h1>
      <figure v-if="photoUrl" class="photo">
        <img :src="photoUrl" :alt="pothole.name">
      </figure>
      <p v-else class="photo-placeholder">{{ strings.moderation.photoPendingPlaceholder }}</p>
      <p>{{ strings.pothole.statusOpen }}: {{ pothole.status }}</p>
      <p v-if="pothole.road_ref">{{ strings.pothole.roadRef }}: {{ pothole.road_ref }}</p>
      <p v-if="pothole.authority">{{ strings.pothole.authority }}: {{ pothole.authority }}</p>
      <button type="button" disabled>{{ strings.pothole.confirm }}</button>
      <p class="hint">{{ strings.pothole.confirmHint }}</p>
    </template>
    <p v-else>{{ strings.errors.notFound }}</p>
  </div>
</template>

<style scoped>
.hint { font-size: 0.85rem; color: #666; }
.photo-placeholder {
  font-size: 0.9rem;
  color: #666;
  font-style: italic;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 6px;
}
.photo img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
}
button { margin-top: 0.5rem; }
</style>
