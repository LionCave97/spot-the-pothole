import type { Profile } from '@shared/types'
import { POPIA_NOTICE_VERSION } from '@shared/types'
import type { Session, User } from '@supabase/supabase-js'

const BROWSE_WITHOUT_ACCOUNT_KEY = 'stp_browse_without_account'

export function useAuth() {
  const supabase = useSupabaseClient()
  const user = useState<User | null>('auth-user', () => null)
  const session = useState<Session | null>('auth-session', () => null)
  const profile = useState<Profile | null>('auth-profile', () => null)
  const loading = useState('auth-loading', () => true)
  const browseWithoutAccount = useState('browse-without-account', () => false)

  async function refreshProfile() {
    if (!user.value) {
      profile.value = null
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, is_anonymous, points, created_at, onboarding_completed_at')
      .eq('id', user.value.id)
      .maybeSingle()
    if (!error) {
      profile.value = data as Profile | null
    }
  }

  async function initAuth() {
    if (import.meta.server) {
      return
    }
    browseWithoutAccount.value
      = localStorage.getItem(BROWSE_WITHOUT_ACCOUNT_KEY) === '1'

    const { data } = await supabase.auth.getSession()
    session.value = data.session
    user.value = data.session?.user ?? null
    await refreshProfile()
    loading.value = false

    supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      session.value = nextSession
      user.value = nextSession?.user ?? null
      await refreshProfile()
    })
  }

  function enableBrowseWithoutAccount() {
    browseWithoutAccount.value = true
    localStorage.setItem(BROWSE_WITHOUT_ACCOUNT_KEY, '1')
  }

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      throw error
    }
    return data
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      throw error
    }
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    profile.value = null
  }

  async function completeOnboarding(username: string, isAnonymous: boolean) {
    const { error } = await supabase.rpc('complete_onboarding', {
      p_username: username,
      p_is_anonymous: isAnonymous,
      p_notice_version: POPIA_NOTICE_VERSION,
    })
    if (error) {
      throw error
    }
    await refreshProfile()
  }

  async function updateProfile(username: string, isAnonymous: boolean) {
    const { error } = await supabase
      .from('profiles')
      .update({
        username: username.toLowerCase(),
        is_anonymous: isAnonymous,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.value!.id)
    if (error) {
      throw error
    }
    await refreshProfile()
  }

  async function checkUsernameAvailable(username: string) {
    const { data, error } = await supabase.rpc('is_username_available', {
      p_username: username,
    })
    if (error) {
      throw error
    }
    return Boolean(data)
  }

  async function deleteAccount() {
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      throw error
    }
    await signOut()
    browseWithoutAccount.value = false
    localStorage.removeItem(BROWSE_WITHOUT_ACCOUNT_KEY)
  }

  const isOnboarded = computed(
    () => Boolean(profile.value?.onboarding_completed_at),
  )

  const accessToken = computed(() => session.value?.access_token ?? null)

  return {
    user,
    session,
    profile,
    loading,
    browseWithoutAccount,
    isOnboarded,
    accessToken,
    initAuth,
    refreshProfile,
    enableBrowseWithoutAccount,
    signUp,
    signIn,
    signOut,
    completeOnboarding,
    updateProfile,
    checkUsernameAvailable,
    deleteAccount,
  }
}
