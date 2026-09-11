import { useState } from 'react'
import { apiErrorMessage } from '@/lib/apiError'
import api from '@/lib/axios'
import { useAuth } from './useAuth'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import type { LoginResponse, User } from '../types'
import { getUserIdFromToken, getClientUuid } from '../utils/authHelper'
import { isAccountRefused } from '../utils/accountRefusal'

export function useLogin() {
  const { setAuthState } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  /**
   * The server has no account for this person and will not open one for this client. Kept
   * apart from [error] because it is the only sign-in failure with a remedy: the login screen
   * answers it with a field rather than a red box.
   */
  const [needsInvite, setNeedsInvite] = useState(false)

  const loginWithGoogle = async (credential: string, inviteCode?: string) => {
    setIsLoading(true)
    setError(null)
    setNeedsInvite(false)
    try {
      const userId = getUserIdFromToken(credential)
      const clientUuid = getClientUuid()

      const response = await api.post<LoginResponse>('/auth/login', {
        user_id: userId,
        client_uuid: clientUuid,
        google_auth_token: credential,
        use_cookie: true,
        // Omitted rather than sent empty: the server ignores a blank either way, but an
        // empty credential field and an absent one read differently in a request log.
        ...(inviteCode?.trim() ? { invite_code: inviteCode.trim() } : {}),
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
      if (isAccountRefused(err)) {
        // Not a failure to word as one: the token was good and the person is who they say.
        // The screen says so and offers an invite; `error` stays null so it is not also
        // showing "Authentication exchange failed" underneath.
        setNeedsInvite(true)
        throw err
      }
      const apiError =
        err instanceof Error
          ? err
          : new Error(apiErrorMessage(err, 'Authentication exchange failed.'))
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
    needsInvite,
  }
}
export default useLogin
