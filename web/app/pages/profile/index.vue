<script setup lang="ts">
import { normalizeUsername, validateUsername } from '@shared/validation/username'

const strings = useStrings()
const {
  user,
  profile,
  loading,
  browseWithoutAccount,
  isOnboarded,
  signOut,
  updateProfile,
  checkUsernameAvailable,
  deleteAccount,
} = useAuth()

const username = ref('')
const isAnonymous = ref(false)
const usernameError = ref('')
const statusMessage = ref('')
const pending = ref(false)

watch(profile, (p) => {
  if (p) {
    username.value = p.username ?? ''
    isAnonymous.value = p.is_anonymous
  }
}, { immediate: true })

function usernameMessage(key: string | null) {
  if (!key) {
    return ''
  }
  const map = strings.onboarding.usernameError as Record<string, string>
  return map[key] ?? strings.errors.generic
}

async function saveProfile() {
  usernameError.value = ''
  statusMessage.value = ''
  const normalized = normalizeUsername(username.value)
  const localErr = validateUsername(normalized)
  if (localErr) {
    usernameError.value = usernameMessage(localErr)
    return
  }
  pending.value = true
  try {
    if (normalized !== profile.value?.username) {
      const available = await checkUsernameAvailable(normalized)
      if (!available) {
        usernameError.value = strings.onboarding.usernameError.taken
        return
      }
    }
    await updateProfile(normalized, isAnonymous.value)
    statusMessage.value = strings.common.save
  }
  catch (e) {
    usernameError.value = strings.errors.generic
    console.error(e)
  }
  finally {
    pending.value = false
  }
}

async function onDeleteAccount() {
  if (!confirm(strings.account.deleteWarning)) {
    return
  }
  pending.value = true
  try {
    await deleteAccount()
    statusMessage.value = strings.account.deleted
    await navigateTo('/map')
  }
  catch (e) {
    usernameError.value = strings.errors.generic
    console.error(e)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div>
    <h1>{{ strings.profile.title }}</h1>

    <p v-if="loading">
      {{ strings.common.loading }}
    </p>

    <template v-else-if="!user">
      <p>{{ strings.profile.spotRequiresAuth }}</p>
      <p v-if="browseWithoutAccount" class="hint">
        {{ strings.auth.browseWithoutAccount }}
      </p>
      <NuxtLink to="/auth/sign-in">{{ strings.profile.signIn }}</NuxtLink>
      ·
      <NuxtLink to="/auth/sign-up">{{ strings.auth.signUpTitle }}</NuxtLink>
    </template>

    <template v-else>
      <p>{{ strings.profile.signedInAs }} · {{ profile?.is_anonymous ? strings.profile.anonymous : profile?.username }}</p>
      <p>{{ strings.profile.points }}: {{ profile?.points ?? 0 }}</p>

      <p v-if="!isOnboarded">
        <NuxtLink to="/onboarding">{{ strings.profile.completeOnboarding }}</NuxtLink>
      </p>

      <section v-if="isOnboarded" class="settings">
        <h2>{{ strings.account.updateUsername }}</h2>
        <label>
          {{ strings.onboarding.usernameLabel }}
          <input v-model="username" type="text" autocomplete="nickname">
        </label>
        <label class="checkbox">
          <input v-model="isAnonymous" type="checkbox">
          {{ strings.onboarding.anonymousLabel }}
        </label>
        <p v-if="usernameError" class="error">
          {{ usernameError }}
        </p>
        <p v-if="statusMessage" class="ok">
          {{ statusMessage }}
        </p>
        <button type="button" :disabled="pending" @click="saveProfile">
          {{ strings.account.updateAnonymous }}
        </button>

        <hr>

        <h2>{{ strings.account.deleteTitle }}</h2>
        <p>{{ strings.account.deleteWarning }}</p>
        <button type="button" class="danger" :disabled="pending" @click="onDeleteAccount">
          {{ strings.account.deleteConfirm }}
        </button>
      </section>

      <button type="button" class="linkish" @click="signOut">
        {{ strings.profile.signOut }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.hint { color: #555; font-size: 0.9rem; }
.settings { margin-top: 1rem; }
.checkbox { display: flex; gap: 0.5rem; align-items: center; }
.error { color: #b00020; }
.ok { color: #0b6e4f; }
.danger { background: #b00020; color: #fff; border: none; padding: 0.5rem 1rem; margin-top: 0.5rem; }
.linkish { margin-top: 1rem; background: none; border: none; color: #0b6e4f; cursor: pointer; }
input { display: block; width: 100%; max-width: 420px; padding: 0.5rem; margin: 0.25rem 0 0.75rem; }
</style>
