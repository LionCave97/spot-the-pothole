<script setup lang="ts">
import { normalizeUsername, validateUsername } from '@shared/validation/username'

const strings = useStrings()
const { user, completeOnboarding, checkUsernameAvailable } = useAuth()

definePageMeta({ middleware: [] })

const step = ref(1)
const consentChecked = ref(false)
const username = ref('')
const isAnonymous = ref(false)
const usernameError = ref('')
const formError = ref('')
const pending = ref(false)

watch(username, () => {
  usernameError.value = ''
})

function usernameMessage(key: string | null) {
  if (!key) {
    return ''
  }
  const map = strings.onboarding.usernameError as Record<string, string>
  return map[key] ?? strings.errors.generic
}

async function submitProfile() {
  formError.value = ''
  const normalized = normalizeUsername(username.value)
  const localErr = validateUsername(normalized)
  if (localErr) {
    usernameError.value = usernameMessage(localErr)
    return
  }
  pending.value = true
  try {
    const available = await checkUsernameAvailable(normalized)
    if (!available) {
      usernameError.value = strings.onboarding.usernameError.taken
      return
    }
    await completeOnboarding(normalized, isAnonymous.value)
    step.value = 3
  }
  catch (e) {
    formError.value = strings.errors.generic
    console.error(e)
  }
  finally {
    pending.value = false
  }
}

onMounted(() => {
  if (!user.value) {
    navigateTo('/auth/sign-in')
  }
})
</script>

<template>
  <div class="onboarding">
    <h1>{{ strings.onboarding.title }}</h1>

    <section v-if="step === 1">
      <h2>{{ strings.onboarding.stepConsent }}</h2>
      <p>{{ strings.onboarding.consentLead }}</p>
      <article class="notice">
        <h3>{{ strings.onboarding.privacyNoticeTitle }}</h3>
        <p>{{ strings.onboarding.privacyNoticeBody }}</p>
      </article>
      <label class="checkbox">
        <input v-model="consentChecked" type="checkbox">
        {{ strings.onboarding.consentCheckbox }}
      </label>
      <button type="button" :disabled="!consentChecked" @click="step = 2">
        {{ strings.onboarding.continue }}
      </button>
    </section>

    <section v-else-if="step === 2">
      <h2>{{ strings.onboarding.stepProfile }}</h2>
      <p>{{ strings.onboarding.usernameHint }}</p>
      <label>
        {{ strings.onboarding.usernameLabel }}
        <input v-model="username" type="text" autocomplete="nickname" :placeholder="strings.onboarding.usernamePlaceholder">
      </label>
      <p v-if="usernameError" class="error">
        {{ usernameError }}
      </p>
      <label class="checkbox">
        <input v-model="isAnonymous" type="checkbox">
        {{ strings.onboarding.anonymousLabel }}
      </label>
      <p class="hint">
        {{ strings.onboarding.anonymousHint }}
      </p>
      <p v-if="formError" class="error">
        {{ formError }}
      </p>
      <button type="button" :disabled="pending" @click="submitProfile">
        {{ strings.onboarding.continue }}
      </button>
    </section>

    <section v-else>
      <h2>{{ strings.onboarding.stepPermissions }}</h2>
      <p>{{ strings.onboarding.permissionsLead }}</p>
      <ul>
        <li>{{ strings.onboarding.cameraReason }}</li>
        <li>{{ strings.onboarding.locationReason }}</li>
      </ul>
      <NuxtLink to="/map" class="buttonish">
        {{ strings.onboarding.finish }}
      </NuxtLink>
    </section>
  </div>
</template>

<style scoped>
.notice { background: #fff; border: 1px solid #e5e2dc; padding: 1rem; border-radius: 8px; }
.checkbox { display: flex; gap: 0.5rem; align-items: flex-start; margin: 1rem 0; }
.error { color: #b00020; }
.hint { font-size: 0.9rem; color: #555; }
input[type="text"] { width: 100%; max-width: 420px; padding: 0.5rem; }
.buttonish { display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background: #0b6e4f; color: #fff; text-decoration: none; border-radius: 6px; }
</style>
