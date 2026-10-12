import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useContext } from 'react'
import { AuthProvider, AuthContext } from '../AuthContext'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import type { User } from '../../types'

const mockPost = vi.fn()
vi.mock('@/lib/axios', () => ({
  default: { post: (...args: unknown[]) => mockPost(...args) },
  registerUnauthorizedListener: vi.fn(),
}))

const SUBJECT = '1078234509876543210'
const SURROGATE = '3f2b1c04-9f3a-4a7e-8f21-6a0d5d5c9b11'
const STORED_USER: User = { id: SUBJECT, surrogateId: SURROGATE, email: 'test@example.com' }

/** An Axios rejection with no response: the shape a request makes when there is no signal. */
const networkError = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
/** An Axios rejection carrying a real HTTP answer. */
const httpError = (status: number) => Object.assign(new Error(`Request failed with status ${status}`), {
  response: { status },
})

function Consumer() {
  const ctx = useContext(AuthContext)!
  return (
    <div>
      <div data-testid="loading">{String(ctx.isLoading)}</div>
      <div data-testid="authed">{String(ctx.isAuthenticated)}</div>
      <div data-testid="user">{ctx.user?.id ?? 'none'}</div>
    </div>
  )
}

async function renderProvider() {
  render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>
  )
  await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
}

function signedInDevice() {
  storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'stored-refresh-token')
  storage.setItem(STORAGE_KEYS.USER_INFO, STORED_USER)
}

beforeEach(() => {
  mockPost.mockReset()
})

describe('AuthProvider session bootstrapping', () => {
  it('signs in and rotates the refresh token when the server answers', async () => {
    signedInDevice()
    mockPost.mockResolvedValue({ data: { refresh_token: 'rotated-token', user_uuid: SURROGATE } })

    await renderProvider()

    expect(screen.getByTestId('authed')).toHaveTextContent('true')
    expect(storage.getItem(STORAGE_KEYS.REFRESH_TOKEN, '')).toBe('rotated-token')
  })

  // The bug this file exists for: opening the app in a shop with no signal used to
  // delete the stored session, and the only way back in needs the network that is
  // missing. See isSessionRejected.
  it('stays signed in on the stored session when the server is unreachable', async () => {
    signedInDevice()
    mockPost.mockRejectedValue(networkError())

    await renderProvider()

    expect(screen.getByTestId('authed')).toHaveTextContent('true')
    expect(screen.getByTestId('user')).toHaveTextContent(SUBJECT)
  })

  it('keeps the stored credentials when the server is unreachable', async () => {
    signedInDevice()
    mockPost.mockRejectedValue(networkError())

    await renderProvider()

    expect(storage.getItem(STORAGE_KEYS.REFRESH_TOKEN, '')).toBe('stored-refresh-token')
    expect(storage.getItem<User | null>(STORAGE_KEYS.USER_INFO, null)).toEqual(STORED_USER)
  })

  it('stays signed in when the server answers but is broken', async () => {
    signedInDevice()
    mockPost.mockRejectedValue(httpError(502))

    await renderProvider()

    expect(screen.getByTestId('authed')).toHaveTextContent('true')
    expect(storage.getItem(STORAGE_KEYS.REFRESH_TOKEN, '')).toBe('stored-refresh-token')
  })

  it('signs out and clears the session when the server refuses the token', async () => {
    signedInDevice()
    mockPost.mockRejectedValue(httpError(401))

    await renderProvider()

    expect(screen.getByTestId('authed')).toHaveTextContent('false')
    expect(storage.getItem(STORAGE_KEYS.REFRESH_TOKEN, '')).toBe('')
    expect(storage.getItem<User | null>(STORAGE_KEYS.USER_INFO, null)).toBeNull()
  })

  it('signs out when the account is refused service', async () => {
    signedInDevice()
    mockPost.mockRejectedValue(httpError(403))

    await renderProvider()

    expect(screen.getByTestId('authed')).toHaveTextContent('false')
    expect(storage.getItem(STORAGE_KEYS.REFRESH_TOKEN, '')).toBe('')
  })

  it('keeps an unusable token rather than discarding it, when offline with no stored user', async () => {
    // No USER_INFO means nothing to run on, so the app still falls to /login -- but
    // the token survives, so a later launch with signal can still recover the session.
    storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'stored-refresh-token')
    mockPost.mockRejectedValue(networkError())

    await renderProvider()

    expect(screen.getByTestId('authed')).toHaveTextContent('false')
    expect(storage.getItem(STORAGE_KEYS.REFRESH_TOKEN, '')).toBe('stored-refresh-token')
  })

  it('does not call the server at all with no stored token', async () => {
    await renderProvider()

    expect(mockPost).not.toHaveBeenCalled()
    expect(screen.getByTestId('authed')).toHaveTextContent('false')
  })
})
