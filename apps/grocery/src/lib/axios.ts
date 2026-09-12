import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { env } from '@/config/env'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import { getClientUuid } from '@/utils/uuid'
import { isSessionRejected } from '@/features/auth/utils/sessionFailure'

// There is one backend. Settings used to let a device override it, and a device that
// did so kept that value in localStorage forever -- so drop any leftover override
// rather than letting it keep pointing the app somewhere else.
storage.removeItem(STORAGE_KEYS.LEGACY_API_BASE_URL)

// In dev the Vite proxy fronts the API, so the base URL is the current origin.
const baseURL = env.isDev ? '' : env.API_BASE_URL

export const api = axios.create({
  baseURL,
  withCredentials: true, // Native session cookies for cross-origin requests
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds default timeout
})

// Separate instance to perform refresh calls without interceptor loop recursion
const refreshApi = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

type UnauthorizedCallback = () => void
let unauthorizedListener: UnauthorizedCallback | null = null

export function registerUnauthorizedListener(callback: UnauthorizedCallback) {
  unauthorizedListener = callback
}

function triggerUnauthorized() {
  storage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
  if (unauthorizedListener) {
    unauthorizedListener()
  } else {
    window.location.href = '/login'
  }
}

// Queue for handling parallel requests while token is refreshing
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}> = []

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(null)
    }
  })
  failedQueue = []
}

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const clientUuid = getClientUuid()
    config.headers['X-Client-UUID'] = clientUuid
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor with token refresh queueing
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const status = error.response?.status

    // Check if 401 and original request hasn't been retried yet
    if (status === 401 && originalRequest && !originalRequest._retry) {
      const currentPath = window.location.pathname
      // Routes that are public on THIS origin. '/' is deliberately absent: since the
      // grocery app moved to its own origin, '/' is the authenticated shell rather
      // than the personal landing page it used to be, and a 401 there must trigger a
      // refresh rather than be swallowed. '/link' signs itself in and must not redirect.
      const publicRoutes = ['/login', '/link']

      // If we are on a public route, do not attempt to refresh or redirect
      if (publicRoutes.includes(currentPath)) {
        return Promise.reject(error)
      }

      const refreshToken = storage.getItem<string>(STORAGE_KEYS.REFRESH_TOKEN, '')
      if (!refreshToken) {
        triggerUnauthorized()
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(() => {
            return api(originalRequest)
          })
          .catch((err) => {
            return Promise.reject(err)
          })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const user = storage.getItem<{ id: string; surrogateId?: string } | null>(
          STORAGE_KEYS.USER_INFO,
          null
        )
        // The subject: sessions are keyed by it, not by the surrogate.
        const userId = user?.id || ''
        const clientUuid = getClientUuid()

        const response = await refreshApi.post<{
          refresh_token: string
          user_uuid?: string | null
        }>('/auth/refresh', {
          user_id: userId,
          client_uuid: clientUuid,
          refresh_token: refreshToken,
          use_cookie: true,
        })
        
        const newRefreshToken = response.data.refresh_token
        storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken)

        // Keep the stored surrogate current on this path too. AuthContext learns it on
        // mount; this is the mid-session rotation, and storage is what it can reach.
        const surrogateId = response.data.user_uuid || undefined
        if (user && surrogateId && user.surrogateId !== surrogateId) {
          storage.setItem(STORAGE_KEYS.USER_INFO, { ...user, surrogateId })
        }

        processQueue(null)
        isRefreshing = false

        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError)
        isRefreshing = false
        // Only a refusal ends the session. A refresh that never reached the server
        // -- signal dropped between the 401 and this call, a timeout, a 502 -- leaves
        // the credentials in place so the next attempt can use them, for the same
        // reason AuthContext's bootstrap does. See isSessionRejected.
        if (isSessionRejected(refreshError)) {
          triggerUnauthorized()
        }
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api
