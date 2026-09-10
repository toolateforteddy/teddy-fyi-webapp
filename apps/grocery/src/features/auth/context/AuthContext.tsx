import { createContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import api, { registerUnauthorizedListener } from '@/lib/axios'
import type { User, AuthState, RefreshResponse } from '../types'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import { getClientUuid } from '@/utils/uuid'

export interface AuthContextType {
  isAuthenticated: boolean
  user: User | null
  isLoading: boolean
  setAuthState: (state: { isAuthenticated: boolean; user: User | null }) => void
  logout: () => Promise<void>
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthStateInternal] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
  })

  const setAuthState = (state: { isAuthenticated: boolean; user: User | null }) => {
    setAuthStateInternal((prev) => ({
      ...prev,
      ...state,
    }))
  }

  // Session bootstrapping on app mount
  useEffect(() => {
    async function bootstrapSession() {
      const refreshToken = storage.getItem<string>(STORAGE_KEYS.REFRESH_TOKEN, '')
      if (!refreshToken) {
        setAuthStateInternal({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        })
        return
      }

      try {
        const user = storage.getItem<User | null>(STORAGE_KEYS.USER_INFO, null)
        // The subject, deliberately: sessions are keyed by it, not by the surrogate.
        const userId = user?.id || ''
        const clientUuid = getClientUuid()

        // Exchange refresh token for a fresh session cookie
        const response = await api.post<RefreshResponse>('/auth/refresh', {
          user_id: userId,
          client_uuid: clientUuid,
          refresh_token: refreshToken,
          use_cookie: true,
        })

        // Store new refresh token
        storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.data.refresh_token)

        // The surrogate rides along on every rotation, so a session that was already
        // signed in when it shipped learns it here rather than only on a fresh login.
        const surrogateId = response.data.user_uuid || undefined
        const refreshedUser =
          user && surrogateId && user.surrogateId !== surrogateId
            ? { ...user, surrogateId }
            : user
        if (refreshedUser !== user) {
          storage.setItem(STORAGE_KEYS.USER_INFO, refreshedUser)
        }

        setAuthStateInternal({
          isAuthenticated: true,
          user: refreshedUser,
          isLoading: false,
        })
      } catch (error) {
        console.error('Session bootstrapping failed:', error)
        storage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
        storage.removeItem(STORAGE_KEYS.USER_INFO)
        setAuthStateInternal({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        })
      }
    }

    bootstrapSession()
  }, [])

  // Listen for global 401 unauthorized failures from the Axios interceptor
  useEffect(() => {
    registerUnauthorizedListener(() => {
      console.warn('Axios interceptor triggered 401 unauthorized - clearing local auth state.')
      storage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
      storage.removeItem(STORAGE_KEYS.USER_INFO)
      setAuthStateInternal({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      })
    })
  }, [])

  const logout = async () => {
    setAuthStateInternal((prev) => ({ ...prev, isLoading: true }))
    try {
      // API call to clear HTTP-only cookies on backend
      await api.post('/logout')
    } catch (error) {
      console.error('Logout request failed on backend:', error)
    } finally {
      storage.clear()
      setAuthStateInternal({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      })
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: authState.isAuthenticated,
        user: authState.user,
        isLoading: authState.isLoading,
        setAuthState,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
