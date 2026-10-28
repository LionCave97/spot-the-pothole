<script setup lang="ts">
const strings = useStrings()
</script>

<template>
  <section class="spot-page">
    <h1>{{ strings.spot.title }}</h1>
    <p class="lead">{{ strings.spot.cameraHint }}</p>
    <div class="callout" role="status">
      <p>{{ strings.spot.useMobileApp }}</p>
    </div>
  </section>
</template>

<style scoped>
.spot-page h1 {
  margin: 0 0 0.5rem;
}
.lead {
  color: #444;
  margin-bottom: 1.25rem;
}
.callout {
  padding: 1rem 1.25rem;
  border-radius: 8px;
  background: #e8f5f0;
  border: 1px solid #b8dccf;
  color: #0b3d2c;
}
</style>
