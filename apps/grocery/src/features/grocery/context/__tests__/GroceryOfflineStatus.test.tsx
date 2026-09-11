import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { GroceryProvider, useGrocery } from '../GroceryContext'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-123', email: 'test@example.com' }, isLoading: false })
}))

const syncHook = {
  syncNow: vi.fn().mockResolvedValue(null),
  resolveConflicts: vi.fn((local: unknown) => local),
  resolveListConflicts: vi.fn((local: unknown) => local),
  resolveListMemberConflicts: vi.fn((local: unknown) => local),
  resolveStoreConflicts: vi.fn((local: unknown) => local),
  resolveCategoryConflicts: vi.fn((local: unknown) => local),
  resolveStoreInfoConflicts: vi.fn((local: unknown) => local),
  isSyncing: false,
}

vi.mock('@/features/sync/hooks/useGrocerySync', () => ({
  useGrocerySync: () => syncHook,
  default: () => syncHook,
}))

function Probe() {
  const { syncStatus, pendingCount, isOnline } = useGrocery()
  return (
    <div>
      <span data-testid="status">{syncStatus}</span>
      <span data-testid="pending">{pendingCount}</span>
      <span data-testid="online">{String(isOnline)}</span>
    </div>
  )
}

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true })
}

function item(id: string, sync_state: string) {
  return {
    id,
    name: id,
    quantity: '1',
    isBought: false,
    isActive: true,
    createdAt: 0,
    position: 0,
    listId: 'list-1',
    version: 1,
    is_deleted: false,
    timesBought: 0,
    sync_state,
  }
}

function renderProbe() {
  return render(
    <GroceryProvider>
      <Probe />
    </GroceryProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  setOnLine(true)
  syncHook.isSyncing = false
  // sync_state matters: the sync layer treats anything that is not exactly 'SYNCED'
  // as owed to the server, a missing value included, so a seed without one is a
  // pending row.
  storage.setItem(STORAGE_KEYS.LISTS, [
    { id: 'list-1', name: 'My List', is_deleted: false, version: 1, sync_state: 'SYNCED' },
  ])
  storage.setItem(STORAGE_KEYS.ACTIVE_LIST_ID, 'list-1')
  storage.setItem(STORAGE_KEYS.LAST_SYNCED, new Date().toISOString())
})

afterEach(() => {
  setOnLine(true)
})

describe('sync status', () => {
  it('is synced when everything is up and nothing is owed', () => {
    storage.setItem(STORAGE_KEYS.ITEMS, [item('a', 'SYNCED')])

    renderProbe()

    expect(screen.getByTestId('status').textContent).toBe('synced')
    expect(screen.getByTestId('pending').textContent).toBe('0')
  })

  // The case the indicator could not previously express: no signal, changes held.
  it('is offline with a count when the network is gone and changes are held', () => {
    setOnLine(false)
    storage.setItem(STORAGE_KEYS.ITEMS, [item('a', 'PENDING_INSERT'), item('b', 'PENDING_UPDATE')])

    renderProbe()

    expect(screen.getByTestId('status').textContent).toBe('offline')
    expect(screen.getByTestId('pending').textContent).toBe('2')
  })

  it('is offline even with nothing owed, so a dead network is never shown as synced', () => {
    setOnLine(false)
    storage.setItem(STORAGE_KEYS.ITEMS, [item('a', 'SYNCED')])

    renderProbe()

    expect(screen.getByTestId('status').textContent).toBe('offline')
  })

  // Online and still holding changes is the one state worth investigating: the
  // network is there and the sync is not landing.
  it('is pending when there is a network but changes are still held', () => {
    storage.setItem(STORAGE_KEYS.ITEMS, [item('a', 'PENDING_DELETE')])

    renderProbe()

    expect(screen.getByTestId('status').textContent).toBe('pending')
    expect(screen.getByTestId('pending').textContent).toBe('1')
  })

  it('counts unsent rows from every table, not just items', () => {
    storage.setItem(STORAGE_KEYS.ITEMS, [item('a', 'PENDING_INSERT')])
    storage.setItem(STORAGE_KEYS.STORES, [
      { id: 's1', name: 'Store', version: 1, is_deleted: false, sync_state: 'PENDING_INSERT' },
    ])
    storage.setItem(STORAGE_KEYS.CATEGORIES, [
      { id: 'c1', name: 'Cat', version: 1, is_deleted: false, sync_state: 'PENDING_UPDATE' },
    ])

    renderProbe()

    expect(screen.getByTestId('pending').textContent).toBe('3')
  })

  it('is stale, not synced, when nothing has come down in over a day', () => {
    storage.setItem(STORAGE_KEYS.LAST_SYNCED, new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString())
    storage.setItem(STORAGE_KEYS.ITEMS, [item('a', 'SYNCED')])

    renderProbe()

    expect(screen.getByTestId('status').textContent).toBe('stale')
  })

  // Unsent changes outrank an old read: "your edit is still here" is the more
  // useful of the two things to say.
  it('prefers pending over stale when both are true', () => {
    storage.setItem(STORAGE_KEYS.LAST_SYNCED, new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString())
    storage.setItem(STORAGE_KEYS.ITEMS, [item('a', 'PENDING_INSERT')])

    renderProbe()

    expect(screen.getByTestId('status').textContent).toBe('pending')
  })

  it('follows the network dropping and coming back without a remount', () => {
    storage.setItem(STORAGE_KEYS.ITEMS, [item('a', 'PENDING_INSERT')])

    renderProbe()
    expect(screen.getByTestId('status').textContent).toBe('pending')

    act(() => {
      setOnLine(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByTestId('status').textContent).toBe('offline')

    act(() => {
      setOnLine(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.getByTestId('status').textContent).toBe('pending')
  })

  it('shows syncing while a sync is in flight, whatever else is true', () => {
    syncHook.isSyncing = true
    setOnLine(false)
    storage.setItem(STORAGE_KEYS.ITEMS, [item('a', 'PENDING_INSERT')])

    renderProbe()

    expect(screen.getByTestId('status').textContent).toBe('syncing')
  })
})
