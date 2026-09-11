import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardLayout } from '../DashboardLayout'
import { useGrocery } from '@/features/grocery/context/GroceryContext'

/**
 * The other half of the splash fix, at the place it is rendered.
 *
 * `GroceryBootstrap.test.tsx` proves `bootstrapState` always leaves `loading`. This
 * proves the shell reads it -- that the spinner is gated on the state rather than on
 * `!activeList` alone, which is what made it permanent. Without this, reverting one
 * `if` in DashboardLayout brings the hang back with every context test still green.
 */

vi.mock('@/features/grocery/context/GroceryContext', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/grocery/context/GroceryContext')>()
  return { ...actual, useGrocery: vi.fn() }
})

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, isLoading: false, logout: vi.fn() }),
}))

const mockRetry = vi.fn()

const contextWith = (over: Record<string, unknown>) => ({
  activeListId: '',
  setActiveListId: vi.fn(),
  items: [],
  setItems: vi.fn(),
  lists: [],
  setLists: vi.fn(),
  listMembers: [],
  setListMembers: vi.fn(),
  stores: [],
  setStores: vi.fn(),
  categories: [],
  setCategories: vi.fn(),
  itemStoreInfos: [],
  setItemStoreInfos: vi.fn(),
  syncStatus: 'synced' as const,
  isSyncing: false,
  isOnline: true,
  pendingCount: 0,
  lastSyncedAt: '',
  handleManualSync: vi.fn(),
  bootstrapState: 'loading' as const,
  retryBootstrap: mockRetry,
  ...over,
})

const renderShell = () => render(
  <MemoryRouter>
    <DashboardLayout />
  </MemoryRouter>
)

describe('the shell with no list to show', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the splash only while the bootstrap is still loading', () => {
    vi.mocked(useGrocery).mockReturnValue(contextWith({ bootstrapState: 'loading' }) as any)

    renderShell()

    expect(screen.getByText(/Initializing your lists/)).toBeInTheDocument()
  })

  it('shows a screen with a button on it once the bootstrap has failed', () => {
    vi.mocked(useGrocery).mockReturnValue(contextWith({ bootstrapState: 'failed' }) as any)

    renderShell()

    expect(screen.queryByText(/Initializing your lists/)).not.toBeInTheDocument()
    expect(screen.getByText('Your lists did not load')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Reset the cached app/ })).toHaveAttribute('href', '/?sw=off')
  })

  /**
   * `ready` with no list is not a state anything is expected to reach, which is the
   * reason to assert on it: an unreachable state that renders a spinner is a hang
   * waiting for the bug that makes it reachable.
   */
  it('does not fall back to the spinner when the bootstrap is ready but empty', () => {
    vi.mocked(useGrocery).mockReturnValue(contextWith({ bootstrapState: 'ready' }) as any)

    renderShell()

    expect(screen.queryByText(/Initializing your lists/)).not.toBeInTheDocument()
    expect(screen.getByText('Your lists did not load')).toBeInTheDocument()
  })

  it('retries the bootstrap when the button is pressed', () => {
    vi.mocked(useGrocery).mockReturnValue(contextWith({ bootstrapState: 'failed' }) as any)

    renderShell()
    screen.getByRole('button', { name: /Try again/ }).click()

    expect(mockRetry).toHaveBeenCalledOnce()
  })
})
