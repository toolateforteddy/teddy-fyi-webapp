import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { useLogin } from '../useLogin'

const mockPost = vi.fn()
vi.mock('@/lib/axios', () => ({
  default: { post: (...args: unknown[]) => mockPost(...args) },
  registerUnauthorizedListener: vi.fn(),
}))

// `useLogin` reaches for the auth context only to write the result into it. Nothing here
// asserts on that, so a stub keeps these tests about the one thing they are for.
vi.mock('../useAuth', () => ({ useAuth: () => ({ setAuthState: vi.fn() }) }))

/** An Axios rejection carrying a real HTTP answer, as the interceptor shapes it. */
const httpError = (status: number) =>
  Object.assign(new Error(`Request failed with status ${status}`), { response: { status } })

/** A token whose base64url payload decodes to `{"sub":"1078234509876543210"}`. */
const CREDENTIAL = 'x.eyJzdWIiOiIxMDc4MjM0NTA5ODc2NTQzMjEwIn0.y'

function Harness({ invite }: { invite?: string }) {
  const { loginWithGoogle, needsInvite, error } = useLogin()
  return (
    <div>
      <button onClick={() => loginWithGoogle(CREDENTIAL, invite).catch(() => {})}>go</button>
      <div data-testid="needsInvite">{String(needsInvite)}</div>
      <div data-testid="error">{error?.message ?? 'none'}</div>
    </div>
  )
}

async function signIn(invite?: string) {
  render(<Harness invite={invite} />)
  // The click starts an async login whose resolution sets state; without `act` React warns
  // that the update escaped the test's control, and the warning is fair.
  await act(async () => {
    screen.getByText('go').click()
  })
}

describe('useLogin', () => {
  beforeEach(() => {
    mockPost.mockReset()
    localStorage.clear()
  })

  /**
   * The whole point of the change. A `403` is the server saying there is no account here and
   * it will not open one -- a sentence a person can act on -- so it must not be flattened into
   * the same red box as a dead network.
   */
  it('reports a refused account as needing an invite, not as an error', async () => {
    mockPost.mockRejectedValue(httpError(403))

    await signIn()

    await waitFor(() => expect(screen.getByTestId('needsInvite')).toHaveTextContent('true'))
    // And deliberately not *also* showing "Authentication exchange failed" underneath.
    expect(screen.getByTestId('error')).toHaveTextContent('none')
  })

  it('does not offer an invite for a rejected token', async () => {
    // There is nothing to paste that would make a 401 succeed.
    mockPost.mockRejectedValue(httpError(401))

    await signIn()

    await waitFor(() => expect(screen.getByTestId('error')).not.toHaveTextContent('none'))
    expect(screen.getByTestId('needsInvite')).toHaveTextContent('false')
  })

  it('does not offer an invite when the server could not be reached', async () => {
    mockPost.mockRejectedValue(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }))

    await signIn()

    await waitFor(() => expect(screen.getByTestId('error')).not.toHaveTextContent('none'))
    expect(screen.getByTestId('needsInvite')).toHaveTextContent('false')
  })

  it('sends no invite_code field when there is no invite', async () => {
    mockPost.mockResolvedValue({ data: { user_id: 'u', email: 'e@x.com', refresh_token: 'r' } })

    await signIn()

    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost.mock.calls[0][1]).not.toHaveProperty('invite_code')
  })

  it('sends no invite_code field for a blank one', async () => {
    mockPost.mockResolvedValue({ data: { user_id: 'u', email: 'e@x.com', refresh_token: 'r' } })

    await signIn('   ')

    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost.mock.calls[0][1]).not.toHaveProperty('invite_code')
  })

  it('sends a real invite trimmed, under the name the server reads', async () => {
    mockPost.mockResolvedValue({ data: { user_id: 'u', email: 'e@x.com', refresh_token: 'r' } })

    await signIn('  an.invite.jwt  ')

    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost.mock.calls[0][1]).toMatchObject({ invite_code: 'an.invite.jwt' })
  })
})
