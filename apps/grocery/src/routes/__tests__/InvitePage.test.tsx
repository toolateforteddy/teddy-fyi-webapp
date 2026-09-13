import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { InvitePage } from '../InvitePage'

/**
 * `/invite/:code` is how somebody with no account gets one, so the cases worth pinning are
 * the ones a recipient cannot recover from on their own: a truncated link that sends them
 * through a Google sign-in to reach a refusal, and a `403` worded as though their sign-in
 * failed when what actually happened is that the invite did not admit them.
 */

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

let authenticated = false
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: authenticated, isLoading: false }),
}))

const loginWithGoogle = vi.fn()
vi.mock('@/features/auth/hooks/useLogin', () => ({
  useLogin: () => ({ loginWithGoogle }),
}))

/**
 * Google's button is drawn by a script that is never reachable from a test, so the signed-out
 * branch is exercised by capturing the callback handed to `initialize` and calling it — which
 * is exactly what Google does when somebody picks an account.
 */
let googleCallback: ((response: { credential?: string }) => void) | null = null
vi.mock('@/features/auth/utils/googleIdentity', () => ({
  loadGoogleIdentity: () =>
    Promise.resolve({
      accounts: {
        id: {
          initialize: (config: { callback: (r: { credential?: string }) => void }) => {
            googleCallback = config.callback
          },
          renderButton: () => {},
        },
      },
    }),
}))

// Three base64url segments, which is the shape the server mints and all this page checks.
const CODE = 'eyJ0eXAiOiJKV1QifQ.eyJlbWFpbCI6Im11bUBleGFtcGxlLmNvbSJ9.c2lnbmF0dXJl'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/invite" element={<InvitePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  authenticated = false
  googleCallback = null
  vi.clearAllMocks()
})

describe('InvitePage', () => {
  it('invites a signed-out visitor to sign in', async () => {
    renderAt(`/invite/${CODE}`)

    expect(
      await screen.findByRole('heading', { name: /You've been invited to teddy.fyi/ }),
    ).toBeInTheDocument()
    // The code is a credential rather than something to read out, so unlike a list invite it
    // is never put on screen.
    expect(screen.queryByText(CODE)).not.toBeInTheDocument()
  })

  it('signs in with the code and lands on the list', async () => {
    loginWithGoogle.mockResolvedValue({ id: 'u1' })
    renderAt(`/invite/${CODE}`)

    await waitFor(() => expect(googleCallback).not.toBeNull())
    googleCallback?.({ credential: 'google-id-token' })

    // The whole point: sign-in and redemption are one request, so the account exists by the
    // end of the single tap the recipient made.
    await waitFor(() => expect(loginWithGoogle).toHaveBeenCalledWith('google-id-token', CODE))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }))
  })

  it('explains a refusal instead of calling it a failed sign-in', async () => {
    loginWithGoogle.mockRejectedValue({ response: { status: 403 } })
    renderAt(`/invite/${CODE}`)

    await waitFor(() => expect(googleCallback).not.toBeNull())
    googleCallback?.({ credential: 'google-id-token' })

    // A `403` here means the invite did not admit this person -- wrong Google account, or
    // expired. The server will not say which, so the page names both.
    expect(await screen.findByText(/only admits the one email address/)).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('says a truncated link is truncated rather than sending anybody through sign-in', async () => {
    renderAt('/invite/eyJ0eXAiOiJKV1QifQ.eyJlbWFpbA')

    expect(
      await screen.findByRole('heading', { name: /This invite link is incomplete/ }),
    ).toBeInTheDocument()
    expect(googleCallback).toBeNull()
  })

  it('says the same when the code fell off the link entirely', async () => {
    renderAt('/invite')

    expect(
      await screen.findByRole('heading', { name: /This invite link is incomplete/ }),
    ).toBeInTheDocument()
  })

  it('tells somebody already signed in that there is nothing to do', async () => {
    authenticated = true
    renderAt(`/invite/${CODE}`)

    expect(
      await screen.findByRole('heading', { name: /You're already signed in/ }),
    ).toBeInTheDocument()
    expect(googleCallback).toBeNull()
  })
})
