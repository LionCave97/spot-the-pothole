<script setup lang="ts">
const strings = useStrings()
const route = useRoute()
const { signIn, enableBrowseWithoutAccount } = useAuth()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const pending = ref(false)

async function onSubmit() {
  errorMessage.value = ''
  pending.value = true
  try {
    await signIn(email.value, password.value)
    await navigateTo((route.query.redirect as string) || '/profile')
  }
  catch (e) {
    errorMessage.value = strings.errors.generic
    console.error(e)
  }
  finally {
    pending.value = false
  }
}

function browseAnonymously() {
  enableBrowseWithoutAccount()
  navigateTo('/map')
}
</script>

<template>
  <div class="auth-card">
    <h1>{{ strings.auth.signInTitle }}</h1>
    <form @submit.prevent="onSubmit">
      <label>
        {{ strings.auth.email }}
        <input v-model="email" type="email" autocomplete="email" required>
      </label>
      <label>
        {{ strings.auth.password }}
        <input v-model="password" type="password" autocomplete="current-password" required>
      </label>
      <p v-if="errorMessage" class="error">
        {{ errorMessage }}
      </p>
      <button type="submit" :disabled="pending">
        {{ strings.auth.signInAction }}
      </button>
    </form>
    <p>
      {{ strings.auth.noAccount }}
      <NuxtLink to="/auth/sign-up">{{ strings.auth.signUpTitle }}</NuxtLink>
    </p>
    <button type="button" class="linkish" @click="browseAnonymously">
      {{ strings.auth.browseWithoutAccount }}
    </button>
  </div>
</template>

<style scoped>
.auth-card { max-width: 420px; }
label { display: block; margin-bottom: 0.75rem; }
input { width: 100%; margin-top: 0.25rem; padding: 0.5rem; }
button[type="submit"] { margin-top: 0.5rem; padding: 0.5rem 1rem; }
.error { color: #b00020; }
.linkish { background: none; border: none; color: #0b6e4f; cursor: pointer; margin-top: 1rem; padding: 0; }
</style>
