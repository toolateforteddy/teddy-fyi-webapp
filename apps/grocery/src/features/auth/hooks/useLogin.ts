import { useState } from 'react'
import api from '@/lib/axios'
import { useAuth } from './useAuth'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import type { LoginResponse, User } from '../types'
import { getUserIdFromToken, getClientUuid } from '../utils/authHelper'

export function useLogin() {
  const { setAuthState } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loginWithGoogle = async (credential: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const userId = getUserIdFromToken(credential)
      const clientUuid = getClientUuid()

      const response = await api.post<LoginResponse>('/auth/login', {
        user_id: userId,
        client_uuid: clientUuid,
        google_auth_token: credential,
        use_cookie: true,
      })
      const { user_id, email, refresh_token, user_uuid } = response.data

      const user: User = {
        id: user_id,
        // The id every synced row is keyed by. Kept beside the subject rather than
        // replacing it: `/auth/refresh` looks a session up by the subject.
        surrogateId: user_uuid || undefined,
        email: email || '',
      }

      // Save credentials in local storage
      storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh_token)
      storage.setItem(STORAGE_KEYS.USER_INFO, user)

      // Update global context state
      setAuthState({
        isAuthenticated: true,
        user,
      })

      return user
    } catch (err: unknown) {
      const apiError =
        err instanceof Error
          ? err
          : new Error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Authentication exchange failed.')
      setError(apiError)
      throw apiError
    } finally {
      setIsLoading(false)
    }
  }

  return {
    loginWithGoogle,
    isLoading,
    error,
  }
}
export default useLogin
