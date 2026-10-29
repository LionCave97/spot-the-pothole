<script setup lang="ts">
const strings = useStrings()
const { signUp, enableBrowseWithoutAccount } = useAuth()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const infoMessage = ref('')
const pending = ref(false)

async function onSubmit() {
  errorMessage.value = ''
  infoMessage.value = ''
  if (password.value.length < 8) {
    errorMessage.value = strings.auth.passwordHint
    return
  }
  pending.value = true
  try {
    await signUp(email.value, password.value)
    infoMessage.value = strings.auth.checkEmail
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
    <h1>{{ strings.auth.signUpTitle }}</h1>
    <p class="hint">
      {{ strings.auth.noFullNameHint }}
    </p>
    <form @submit.prevent="onSubmit">
      <label>
        {{ strings.auth.email }}
        <input v-model="email" type="email" autocomplete="email" required>
      </label>
      <label>
        {{ strings.auth.password }}
        <input v-model="password" type="password" autocomplete="new-password" required minlength="8">
      </label>
      <p class="hint">
        {{ strings.auth.passwordHint }}
      </p>
      <p v-if="errorMessage" class="error">
        {{ errorMessage }}
      </p>
      <p v-if="infoMessage" class="info">
        {{ infoMessage }}
      </p>
      <button type="submit" :disabled="pending">
        {{ strings.auth.signUpAction }}
      </button>
    </form>
    <p>
      {{ strings.auth.haveAccount }}
      <NuxtLink to="/auth/sign-in">{{ strings.auth.signInAction }}</NuxtLink>
    </p>
    <button type="button" class="linkish" @click="browseAnonymously">
      {{ strings.auth.browseWithoutAccount }}
    </button>
  </div>
</template>

<style scoped>
.auth-card { max-width: 420px; }
.hint { font-size: 0.9rem; color: #555; }
label { display: block; margin-bottom: 0.75rem; }
input { width: 100%; margin-top: 0.25rem; padding: 0.5rem; }
button[type="submit"] { margin-top: 0.5rem; padding: 0.5rem 1rem; }
.error { color: #b00020; }
.info { color: #0b6e4f; }
.linkish { background: none; border: none; color: #0b6e4f; cursor: pointer; margin-top: 1rem; padding: 0; }
</style>
