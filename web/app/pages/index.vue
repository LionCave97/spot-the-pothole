<script setup lang="ts">
const strings = useStrings()
</script>

<template>
  <div>
    <h1>{{ strings.app.name }}</h1>
    <p>{{ strings.app.tagline }}</p>
    <ul>
      <li><NuxtLink to="/map">{{ strings.nav.map }}</NuxtLink></li>
      <li><NuxtLink to="/feed">{{ strings.nav.feed }}</NuxtLink></li>
      <li><NuxtLink to="/leaderboard">{{ strings.nav.leaderboard }}</NuxtLink></li>
      <li><NuxtLink to="/wards">{{ strings.nav.wards }}</NuxtLink></li>
    </ul>
    <p class="stub">Phase 1 scaffold — connect Supabase and map tiles locally to load live data.</p>
  </div>
</template>

<style scoped>
.stub {
  margin-top: 1.5rem;
  padding: 0.75rem 1rem;
  background: #fff3cd;
  border-radius: 8px;
  font-size: 0.9rem;
}
</style>
