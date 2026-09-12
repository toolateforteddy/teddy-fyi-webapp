import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { JoinPage } from '../JoinPage'
import api from '@/lib/axios'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'

/**
 * `/join/:code` is the whole point of the shared link: the recipient taps it and is on the
 * list. The two things worth pinning down are that it never spends the code on its own — a
 * code is single use, so an automatic redemption would burn the invite on a reload — and
 * that a mangled link says so rather than spending one of the account's five attempts.
 */

vi.mock('@/lib/axios', () => ({
  default: { post: vi.fn() },
}))

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

let authenticated = true
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: authenticated, isLoading: false }),
}))

const loginWithGoogle = vi.fn()
vi.mock('@/features/auth/hooks/useLogin', () => ({
  useLogin: () => ({ loginWithGoogle }),
}))

// The signed-out branch draws Google's button; the script is never reachable from a test.
vi.mock('@/features/auth/utils/googleIdentity', () => ({
  loadGoogleIdentity: () => Promise.reject(new Error('no network in tests')),
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/join" element={<JoinPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  authenticated = true
  vi.clearAllMocks()
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('JoinPage', () => {
  it('shows the invite and waits to be told to join', async () => {
    renderAt('/join/CDFH2345')

    expect(await screen.findByText('CDFH2345')).toBeInTheDocument()
    // Not spent on load: a reload, a back button or a restored tab would otherwise destroy
    // an invite the recipient still needs.
    expect(api.post).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Join this list/ })).toBeInTheDocument()
  })

  it('redeems on the tap and hands the list to the dashboard', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { success: true, listId: 'list-7' },
    } as never)

    renderAt('/join/CDFH2345')
    fireEvent.click(await screen.findByRole('button', { name: /Join this list/ }))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }))
    expect(api.post).toHaveBeenCalledWith('/api/lists/join', { code: 'CDFH2345' })
    expect(storage.getItem(STORAGE_KEYS.ACTIVE_LIST_ID, '')).toBe('list-7')
    // Cleared so the next launch does a full sync: `syncNow` short-circuits when
    // /api/sync/status says nothing changed, and a list somebody else shared is exactly the
    // change that check can miss.
    expect(localStorage.getItem(STORAGE_KEYS.LAST_SYNCED)).toBeNull()
  })

  it('shows what the server said when the code will not redeem', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: { data: { error: 'Invalid or expired invite code' } },
    } as never)

    renderAt('/join/CDFH2345')
    fireEvent.click(await screen.findByRole('button', { name: /Join this list/ }))

    expect(await screen.findByText('Invalid or expired invite code')).toBeInTheDocument()
    // Still offering the tap, because a 429 clears and the link is still the right one.
    expect(screen.getByRole('button', { name: /Join this list/ })).toBeInTheDocument()
  })

  it('explains a link whose code got cut short instead of trying it', async () => {
    renderAt('/join/CDFH')

    expect(await screen.findByText(/This invite link is incomplete/)).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('explains a link with no code at all', async () => {
    renderAt('/join')

    expect(await screen.findByText(/This invite link is incomplete/)).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  /**
   * Signed out is the case this page exists for: the recipient has never opened the app.
   * Signing in is itself the deliberate act, so the join follows it without a second tap.
   */
  it('offers sign-in rather than a join button when signed out', async () => {
    authenticated = false
    renderAt('/join/CDFH2345')

    expect(await screen.findByText(/Sign in and you/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Join this list/ })).not.toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })
})
