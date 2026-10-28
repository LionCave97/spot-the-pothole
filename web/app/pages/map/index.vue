<script setup lang="ts">
const strings = useStrings()
const supabase = useSupabaseClient()

const { data: potholes, pending, error } = await useAsyncData('map-potholes', async () => {
  if (!useRuntimeConfig().public.supabaseUrl) {
    return []
  }
  const { data, error: qErr } = await supabase
    .from('potholes')
    .select('id,name,status,location,ward_id,photo_path')
    .limit(50)
  if (qErr) {
    console.warn(qErr.message)
    return []
  }
  return data ?? []
})
</script>

<template>
  <div>
    <h1>{{ strings.map.title }}</h1>
    <p v-if="pending">{{ strings.common.loading }}</p>
    <p v-else-if="error">{{ strings.errors.generic }}</p>
    <p v-else-if="!potholes?.length">{{ strings.map.empty }}</p>
    <ul v-else class="list">
      <li v-for="p in potholes" :key="p.id">
        <NuxtLink :to="`/potholes/${p.id}`">{{ p.name }}</NuxtLink>
        <span class="meta"> — {{ p.status }}</span>
        <span v-if="!p.photo_path" class="pending-photo"> · {{ strings.moderation.photoPendingPlaceholder }}</span>
      </li>
    </ul>
    <p class="stub">Map tiles + PostGIS map view stubbed for Phase 1.</p>
  </div>
</template>

<style scoped>
.list { padding-left: 1.25rem; }
.meta { color: #666; font-size: 0.9rem; }
.pending-photo { color: #888; font-size: 0.85rem; }
.stub { margin-top: 1rem; font-size: 0.85rem; color: #666; }
</style>
