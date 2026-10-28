<script setup lang="ts">
const strings = useStrings()
const route = useRoute()
const supabase = useSupabaseClient()

const id = computed(() => route.params.id as string)

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
</script>

<template>
  <div>
    <p><NuxtLink to="/map">{{ strings.common.back }}</NuxtLink></p>
    <p v-if="pending">{{ strings.common.loading }}</p>
    <template v-else-if="pothole">
      <h1>{{ pothole.name }}</h1>
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
button { margin-top: 0.5rem; }
</style>
