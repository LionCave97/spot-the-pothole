export function useGameFetch() {
  const { accessToken } = useAuth()

  return async function gameFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = accessToken.value
    if (!token) {
      throw new Error('Sign in required')
    }
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    const response = await fetch(path, { ...init, headers })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || response.statusText)
    }
    return response.json() as Promise<T>
  }
}
