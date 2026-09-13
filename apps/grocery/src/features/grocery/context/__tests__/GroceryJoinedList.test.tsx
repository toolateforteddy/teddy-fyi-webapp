import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { GroceryProvider, useGrocery, AWAITED_LIST_TIMEOUT_MS } from '../GroceryContext'
import { STORAGE_KEYS } from '@/config/storageKeys'

/**
 * The list you just joined is the list you are on.
 *
 * Joining answers with a list id and nothing else, so for one sync the active id names a
 * list this device does not have. The fallback that picks a list when the active one
 * cannot be resolved could not tell that apart from a stale id, and re-homed the selection
 * onto whatever list was already here -- so the recipient of an invite link joined, landed
 * back on their own list, and had to go find the new one behind the edit flag.
 *
 * These tests are the two halves of that: the id survives long enough for the sync to
 * deliver the list, and it does not survive an id no sync is ever going to resolve.
 */

const mockUser = { id: 'google-sub-1', email: 'test@example.com', surrogateId: 'surrogate-1' }

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser, isLoading: false }),
}))

const mockSyncNow = vi.fn()
const passthrough = vi.fn((local: unknown) => local)

/** Enough of the real resolver to let a list the server sent become a local row. */
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
  const { activeListId, activeList, isAwaitingJoinedList, setActiveListId } = useGrocery()
  return (
    <div>
      <div data-testid="active-id">{activeListId}</div>
      <div data-testid="active-name">{activeList?.name ?? ''}</div>
      <div data-testid="awaiting">{String(isAwaitingJoinedList)}</div>
      <button data-testid="select-unknown" onClick={() => setActiveListId('joined-list')}>select</button>
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

const ownList = {
  id: 'own-list',
  name: 'My List',
  ownerId: 'surrogate-1',
  createdAt: 0,
  sync_state: 'SYNCED',
  version: 1,
  is_deleted: false,
}

const syncResponseWith = (lists: unknown[]) => ({
  server_timestamp: new Date().toISOString(),
  remote_grocery_changes: [],
  remote_grocery_list_changes: lists,
  remote_grocery_list_member_changes: [],
  remote_store_changes: [],
  remote_category_changes: [],
  remote_grocery_item_store_info_changes: [],
})

const joinedListChange = {
  id: 'joined-list',
  type: 'INSERT',
  version: 1,
  data: { id: 'joined-list', name: 'Shared Shop', owner_id: 'surrogate-2', created_at: 0 },
}

describe('the list you just joined', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockSyncNow.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * The bug, at its smallest. `/join/<code>` writes the id it was given and hands over to
   * the dashboard; the list itself is still one sync away.
   */
  it('stays the active list while it is still on its way down', () => {
    localStorage.setItem(STORAGE_KEYS.LISTS, JSON.stringify([ownList]))
    localStorage.setItem(STORAGE_KEYS.ACTIVE_LIST_ID, JSON.stringify('joined-list'))

    renderApp()

    expect(screen.getByTestId('active-id')).toHaveTextContent('joined-list')
    expect(screen.getByTestId('awaiting')).toHaveTextContent('true')
    // And nothing is offered in its place, so no screen renders the wrong list's contents.
    expect(screen.getByTestId('active-name')).toHaveTextContent('')
  })

  it('becomes the list on screen once the sync delivers it', async () => {
    localStorage.setItem(STORAGE_KEYS.LISTS, JSON.stringify([ownList]))
    localStorage.setItem(STORAGE_KEYS.ACTIVE_LIST_ID, JSON.stringify('joined-list'))
    mockSyncNow.mockResolvedValue(syncResponseWith([joinedListChange]))

    renderApp()
    await settle()

    expect(screen.getByTestId('active-id')).toHaveTextContent('joined-list')
    expect(screen.getByTestId('active-name')).toHaveTextContent('Shared Shop')
    expect(screen.getByTestId('awaiting')).toHaveTextContent('false')
  })

  it('holds a list selected before its row arrives, rather than bouncing back', async () => {
    localStorage.setItem(STORAGE_KEYS.LISTS, JSON.stringify([ownList]))
    localStorage.setItem(STORAGE_KEYS.ACTIVE_LIST_ID, JSON.stringify('own-list'))

    renderApp()
    await settle()
    expect(screen.getByTestId('active-id')).toHaveTextContent('own-list')

    await act(async () => { fireEvent.click(screen.getByTestId('select-unknown')) })

    expect(screen.getByTestId('active-id')).toHaveTextContent('joined-list')
    expect(screen.getByTestId('awaiting')).toHaveTextContent('true')
  })

  /**
   * The other half. An id can be unresolvable for reasons no sync will fix -- a list left
   * or deleted on another device -- and waiting on one of those forever would leave the app
   * with no list it could render at all.
   */
  it('gives the selection back to a real list once the wait runs out', async () => {
    vi.useFakeTimers()
    localStorage.setItem(STORAGE_KEYS.LISTS, JSON.stringify([ownList]))
    localStorage.setItem(STORAGE_KEYS.ACTIVE_LIST_ID, JSON.stringify('list-that-is-gone'))

    renderApp()
    expect(screen.getByTestId('awaiting')).toHaveTextContent('true')

    await act(async () => { vi.advanceTimersByTime(AWAITED_LIST_TIMEOUT_MS + 1) })

    expect(screen.getByTestId('awaiting')).toHaveTextContent('false')
    expect(screen.getByTestId('active-id')).toHaveTextContent('own-list')
    expect(screen.getByTestId('active-name')).toHaveTextContent('My List')
  })

  it('leaves an ordinary launch alone', async () => {
    localStorage.setItem(STORAGE_KEYS.LISTS, JSON.stringify([ownList]))
    localStorage.setItem(STORAGE_KEYS.ACTIVE_LIST_ID, JSON.stringify('own-list'))

    renderApp()
    await settle()

    expect(screen.getByTestId('awaiting')).toHaveTextContent('false')
    expect(screen.getByTestId('active-name')).toHaveTextContent('My List')
  })
})
