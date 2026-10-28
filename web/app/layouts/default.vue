<script setup lang="ts">
const strings = useStrings()
</script>

<template>
  <div class="layout">
    <header class="header">
      <NuxtLink to="/" class="brand">{{ strings.app.name }}</NuxtLink>
      <nav class="nav">
        <NuxtLink to="/map">{{ strings.nav.map }}</NuxtLink>
        <NuxtLink to="/feed">{{ strings.nav.feed }}</NuxtLink>
        <NuxtLink to="/leaderboard">{{ strings.nav.leaderboard }}</NuxtLink>
        <NuxtLink to="/wards">{{ strings.nav.wards }}</NuxtLink>
        <NuxtLink to="/profile">{{ strings.nav.profile }}</NuxtLink>
      </nav>
    </header>
    <main class="main">
      <slot />
    </main>
    <footer class="footer">
      <p>{{ strings.app.tagline }}</p>
    </footer>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: system-ui, sans-serif;
  color: #1a1a1a;
  background: #faf8f5;
}
.header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e2dc;
  background: #fff;
}
.brand {
  font-weight: 700;
  text-decoration: none;
  color: #0b6e4f;
}
.nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
}
.nav a {
  color: #333;
  text-decoration: none;
}
.nav a.router-link-active {
  font-weight: 600;
  color: #0b6e4f;
}
.main {
  flex: 1;
  padding: 1.25rem;
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
}
.footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid #e5e2dc;
  font-size: 0.875rem;
  color: #666;
}
</style>
