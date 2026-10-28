<script setup lang="ts">
const strings = useStrings()
</script>

<template>
  <div>
    <h1>{{ strings.feed.title }}</h1>
    <p>{{ strings.feed.empty }}</p>
    <p class="stub">Feed will list recent reports from Supabase (stub).</p>
  </div>
</template>

<style scoped>
.stub { font-size: 0.85rem; color: #666; }
</style>
