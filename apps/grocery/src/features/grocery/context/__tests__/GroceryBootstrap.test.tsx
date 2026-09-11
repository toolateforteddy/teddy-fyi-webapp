import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { GroceryProvider, useGrocery, BOOTSTRAP_TIMEOUT_MS } from '../GroceryContext'
import { STORAGE_KEYS } from '@/config/storageKeys'

/**
 * The splash screen must end.
 *
 * `grocery.teddy.fyi` sat on "Initializing your lists..." indefinitely because the shell
 * showed that spinner whenever `lists` was empty, and the only code that could fill
 * `lists` from empty lived inside the success branch of the first sync. Each test here is
 * one of the ways that branch is skipped. They assert on `bootstrapState` leaving
 * `loading`, which is what the shell actually gates the spinner on -- so a future change
 * that reintroduces a way for the bootstrap to end with no list still fails here.
 */

const mockUser = { id: 'google-sub-1', email: 'test@example.com', surrogateId: 'surrogate-1' }
let mockAuth: { user: typeof mockUser | null; isLoading: boolean } = { user: mockUser, isLoading: false }

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => mockAuth,
}))

const mockSyncNow = vi.fn()
const passthrough = vi.fn((local: unknown) => local)

/**
 * Enough of the real list resolver to be worth asserting against: an INSERT the device
 * has not seen becomes a local row. A plain passthrough would drop the server's lists,
 * which makes every response look like "no lists came back" and hides exactly the
 * distinction these tests exist to draw.
 */
const resolveLists = vi.fn((local: any[], remote: any[] = []) => {
  const merged = [...local]
  remote.forEach(change => {
    if (change.type === 'DELETE') return
    if (merged.some(l => l.id === String(change.id))) return
    merged.push({
      id: change.data.id,
      name: change.data.name,
      ownerId: change.data.owner_id,
      createdAt: change.data.created_at,
      version: change.version,
      sync_state: 'SYNCED',
      is_deleted: false,
    })
  })
  return merged
})

const syncHook = () => ({
  syncNow: mockSyncNow,
  resolveConflicts: passthrough,
  resolveListConflicts: resolveLists,
  resolveListMemberConflicts: passthrough,
  resolveStoreConflicts: passthrough,
  resolveCategoryConflicts: passthrough,
  resolveStoreInfoConflicts: passthrough,
  isSyncing: false,
})

vi.mock('@/features/sync/hooks/useGrocerySync', () => ({
  useGrocerySync: () => syncHook(),
  default: () => syncHook(),
}))

function Consumer() {
  const { bootstrapState, lists, retryBootstrap } = useGrocery()
  return (
    <div>
      <div data-testid="bootstrap">{bootstrapState}</div>
      <div data-testid="lists">{lists.length}</div>
      <div data-testid="list-names">{lists.map(l => l.name).join(',')}</div>
      <button data-testid="retry" onClick={retryBootstrap}>retry</button>
    </div>
  )
}

const renderApp = () => render(
  <GroceryProvider>
    <Consumer />
  </GroceryProvider>
)

/** Let the mounted sync settle, then drain the effects its state updates queued. */
const settle = async () => {
  await act(async () => { await Promise.resolve() })
  await act(async () => { await Promise.resolve() })
}

const emptySyncResponse = {
  server_timestamp: new Date().toISOString(),
  remote_grocery_changes: [],
  remote_grocery_list_changes: [],
  remote_grocery_list_member_changes: [],
  remote_store_changes: [],
  remote_category_changes: [],
  remote_grocery_item_store_info_changes: [],
}

describe('the bootstrap splash', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockAuth = { user: mockUser, isLoading: false }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * The one that actually happened, and the cruel one: it survives a reload. `syncNow`
   * returns `null` for its "client and remote match" short-circuit, which is a successful
   * answer rather than a failure -- and the next launch asks the same question of the same
   * unchanged `last_synced_at` and gets the same answer, forever.
   */
  it('adopts a default list when the sync short-circuits with nothing to exchange', async () => {
    mockSyncNow.mockResolvedValue(null)

    renderApp()
    expect(screen.getByTestId('bootstrap')).toHaveTextContent('loading')

    await settle()

    expect(screen.getByTestId('bootstrap')).toHaveTextContent('ready')
    expect(screen.getByTestId('lists')).toHaveTextContent('1')
    expect(screen.getByTestId('list-names')).toHaveTextContent('My List')
  })

  it('does not invent a second list when the short-circuit finds one already here', async () => {
    localStorage.setItem(STORAGE_KEYS.LISTS, JSON.stringify([
      { id: 'list-1', name: 'Weekly Shop', ownerId: 'surrogate-1', createdAt: 0, sync_state: 'SYNCED', version: 1, is_deleted: false },
    ]))
    mockSyncNow.mockResolvedValue(null)

    renderApp()
    await settle()

    expect(screen.getByTestId('lists')).toHaveTextContent('1')
    expect(screen.getByTestId('list-names')).toHaveTextContent('Weekly Shop')
  })

  /**
   * A sync that never reached the server has not established that the account owns no
   * lists, so this case must *not* adopt a default one -- that is how a device ends up
   * with a second "My List" beside the real one. It gets the recovery screen instead.
   */
  it('fails rather than spinning when the first sync throws', async () => {
    mockSyncNow.mockRejectedValue(new Error('Network Error'))

    renderApp()
    await settle()

    expect(screen.getByTestId('bootstrap')).toHaveTextContent('failed')
    expect(screen.getByTestId('lists')).toHaveTextContent('0')
  })

  it('recovers from failed into the real list when the retry succeeds', async () => {
    mockSyncNow.mockRejectedValueOnce(new Error('Network Error'))

    renderApp()
    await settle()
    expect(screen.getByTestId('bootstrap')).toHaveTextContent('failed')

    mockSyncNow.mockResolvedValue({
      ...emptySyncResponse,
      remote_grocery_list_changes: [{
        id: 'srv-list-1',
        type: 'INSERT',
        version: 1,
        data: { id: 'srv-list-1', name: 'Weekly Shop', owner_id: 'surrogate-1', created_at: 0, version: 1, is_deleted: false },
      }],
    })

    await act(async () => { screen.getByTestId('retry').click() })
    await settle()

    expect(screen.getByTestId('bootstrap')).toHaveTextContent('ready')
    expect(screen.getByTestId('list-names')).toHaveTextContent('Weekly Shop')
  })

  /**
   * The backstop, for the ways of hanging nobody has thought of yet. A `syncNow` that
   * never settles is the shape of all of them: no throw to catch, no value to branch on.
   */
  it('gives up on a sync that never settles, rather than spinning forever', async () => {
    vi.useFakeTimers()
    mockSyncNow.mockReturnValue(new Promise(() => {}))

    renderApp()
    expect(screen.getByTestId('bootstrap')).toHaveTextContent('loading')

    await act(async () => { await vi.advanceTimersByTimeAsync(BOOTSTRAP_TIMEOUT_MS + 100) })

    expect(screen.getByTestId('bootstrap')).toHaveTextContent('failed')
  })

  /**
   * An offline launch with a cached list must not show the splash at all. The sync still
   * runs; it runs behind the list rather than in front of it.
   */
  it('renders a cached list immediately without waiting on any sync', async () => {
    localStorage.setItem(STORAGE_KEYS.LISTS, JSON.stringify([
      { id: 'list-1', name: 'Cached List', ownerId: 'surrogate-1', createdAt: 0, sync_state: 'SYNCED', version: 1, is_deleted: false },
    ]))
    mockSyncNow.mockReturnValue(new Promise(() => {}))

    renderApp()

    expect(screen.getByTestId('bootstrap')).toHaveTextContent('ready')
    expect(screen.getByTestId('list-names')).toHaveTextContent('Cached List')
  })
})
