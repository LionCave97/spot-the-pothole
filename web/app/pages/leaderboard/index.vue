<script setup lang="ts">
const strings = useStrings()
</script>

<template>
  <div>
    <h1>{{ strings.leaderboard.title }}</h1>
    <p>{{ strings.leaderboard.empty }}</p>
    <p class="stub">Server route <code>/api/game/leaderboard</code> stub returns demo ranks.</p>
  </div>
</template>

<style scoped>
.stub { font-size: 0.85rem; color: #666; }
</style>
