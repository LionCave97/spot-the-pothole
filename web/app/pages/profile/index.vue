<script setup lang="ts">
const strings = useStrings()
</script>

<template>
  <div>
    <h1>{{ strings.profile.title }}</h1>
    <p>{{ strings.profile.signIn }}</p>
    <p class="stub">Mobile apps authenticate via Supabase; web profile stub.</p>
  </div>
</template>

<style scoped>
.stub { font-size: 0.85rem; color: #666; }
</style>
