<script setup lang="ts">
const strings = useStrings()
</script>

<template>
  <div>
    <h1>{{ strings.wards.title }}</h1>
    <p class="stub">Ward polygons + response scorecards load from Supabase <code>wards</code> (stub UI).</p>
  </div>
</template>

<style scoped>
.stub { font-size: 0.85rem; color: #666; }
</style>
