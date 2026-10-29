export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) {
    return
  }

  const { user, loading, isOnboarded, browseWithoutAccount } = useAuth()
  if (loading.value) {
    return
  }

  const authPaths = ['/auth/sign-in', '/auth/sign-up']
  const onboardingPath = '/onboarding'

  if (!user.value) {
    return
  }

  if (!isOnboarded.value && !authPaths.includes(to.path) && to.path !== onboardingPath) {
    return navigateTo(onboardingPath)
  }

  if (isOnboarded.value && to.path === onboardingPath) {
    return navigateTo('/profile')
  }

  if (browseWithoutAccount.value && authPaths.includes(to.path)) {
    return navigateTo('/map')
  }
})
