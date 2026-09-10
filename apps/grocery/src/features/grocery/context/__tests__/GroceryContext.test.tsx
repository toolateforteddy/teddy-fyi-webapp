import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEffect } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GroceryProvider, useGrocery } from '../GroceryContext'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'

// Mock useAuth
const mockUser = { id: 'user-123', email: 'test@example.com' }
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false
  })
}))

// Mock useGrocerySync
const mockSyncNow = vi.fn().mockResolvedValue(null)
const mockResolveConflicts = vi.fn((local) => local)
const mockResolveListConflicts = vi.fn((local) => local)
const mockResolveListMemberConflicts = vi.fn((local) => local)
const mockResolveStoreConflicts = vi.fn((local) => local)
const mockResolveCategoryConflicts = vi.fn((local) => local)
const mockResolveStoreInfoConflicts = vi.fn((local) => local)

vi.mock('@/features/sync/hooks/useGrocerySync', () => ({
  useGrocerySync: () => ({
    syncNow: mockSyncNow,
    resolveConflicts: mockResolveConflicts,
    resolveListConflicts: mockResolveListConflicts,
    resolveListMemberConflicts: mockResolveListMemberConflicts,
    resolveStoreConflicts: mockResolveStoreConflicts,
    resolveCategoryConflicts: mockResolveCategoryConflicts,
    resolveStoreInfoConflicts: mockResolveStoreInfoConflicts,
    isSyncing: false,
  }),
  default: () => ({
    syncNow: mockSyncNow,
    resolveConflicts: mockResolveConflicts,
    resolveListConflicts: mockResolveListConflicts,
    resolveListMemberConflicts: mockResolveListMemberConflicts,
    resolveStoreConflicts: mockResolveStoreConflicts,
    resolveCategoryConflicts: mockResolveCategoryConflicts,
    resolveStoreInfoConflicts: mockResolveStoreInfoConflicts,
    isSyncing: false,
  })
}))

// Test helper component
function ConsumerComponent() {
  const {
    activeListId,
    setActiveListId,
    items,
    setItems,
    lists,
    handleManualSync,
    syncStatus
  } = useGrocery()

  return (
    <div>
      <div data-testid="active-list">{activeListId}</div>
      <div data-testid="items-count">{items.length}</div>
      <div data-testid="lists-count">{lists.length}</div>
      <div data-testid="sync-status">{syncStatus}</div>
      <button data-testid="change-list" onClick={() => setActiveListId('custom-list-id')}>Change List</button>
      <button data-testid="add-item" onClick={() => setItems(prev => [...prev, {
        id: 'new-item-uuid',
        name: 'Banana',
        quantity: '1',
        isBought: false,
        createdAt: Date.now(),
        position: 0,
        isActive: true,
        listId: activeListId,
        sync_state: 'PENDING_INSERT',
        version: 1,
        is_deleted: false,
        timesBought: 0
      }])}>
        Add Item
      </button>
      <button data-testid="sync-btn" onClick={handleManualSync}>Sync</button>
    </div>
  )
}

describe('GroceryContext Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockSyncNow.mockReset()
    mockSyncNow.mockResolvedValue(null)
  })

  it('should render children and provide context values hydrated from storage', () => {
    storage.setItem(STORAGE_KEYS.ITEMS, [{ id: 'item-1', name: 'Apple', isActive: true, isBought: false }])
    storage.setItem(STORAGE_KEYS.LISTS, [{ id: 'list-1', name: 'My List', is_deleted: false }])
    storage.setItem(STORAGE_KEYS.ACTIVE_LIST_ID, 'list-1')

    render(
      <GroceryProvider>
        <ConsumerComponent />
      </GroceryProvider>
    )

    expect(screen.getByTestId('active-list').textContent).toBe('list-1')
    expect(screen.getByTestId('items-count').textContent).toBe('1')
    expect(screen.getByTestId('lists-count').textContent).toBe('1')
  })

  it('should initialize a default list after a successful sync returns no lists', async () => {
    const mockSyncResponse = {
      server_timestamp: '2026-06-27T18:00:00Z',
      remote_grocery_changes: [],
      remote_grocery_list_changes: [],
      remote_grocery_list_member_changes: [],
      remote_store_changes: [],
      remote_category_changes: [],
      remote_grocery_item_store_info_changes: [],
    }

    mockSyncNow.mockResolvedValueOnce(mockSyncResponse)

    render(
      <GroceryProvider>
        <ConsumerComponent />
      </GroceryProvider>
    )

    // Initially, lists count should be 0 since default list is not generated on mount/failure
    expect(screen.getByTestId('lists-count').textContent).toBe('0')

    const syncBtn = screen.getByTestId('sync-btn')
    await act(async () => {
      fireEvent.click(syncBtn)
    })

    expect(screen.getByTestId('lists-count').textContent).toBe('1')
    expect(screen.getByTestId('active-list').textContent).not.toBe('')
  })

  it('should update activeListId state and storage on change', async () => {
    storage.setItem(STORAGE_KEYS.LISTS, [
      { id: 'list-1', name: 'My List', is_deleted: false },
      { id: 'custom-list-id', name: 'Other List', is_deleted: false }
    ])
    storage.setItem(STORAGE_KEYS.ACTIVE_LIST_ID, 'list-1')

    render(
      <GroceryProvider>
        <ConsumerComponent />
      </GroceryProvider>
    )

    const btn = screen.getByTestId('change-list')
    await act(async () => {
      fireEvent.click(btn)
    })

    expect(screen.getByTestId('active-list').textContent).toBe('custom-list-id')
    expect(storage.getItem(STORAGE_KEYS.ACTIVE_LIST_ID, '')).toBe('custom-list-id')
  })

  it('should sync changes and merge response on manual sync', async () => {
    const mockSyncResponse = {
      server_timestamp: '2026-06-27T18:00:00Z',
      remote_grocery_changes: [
        {
          id: 'remote-1',
          type: 'INSERT',
          version: 1,
          data: { id: 'remote-1', name: 'Milk', is_active: true, is_bought: false, version: 1 }
        }
      ],
      remote_grocery_list_changes: [],
      remote_grocery_list_member_changes: [],
      remote_store_changes: [],
      remote_category_changes: [],
      remote_grocery_item_store_info_changes: [],
    }

    mockSyncNow.mockResolvedValueOnce(mockSyncResponse)
    
    // Setup resolving mocks
    mockResolveConflicts.mockReturnValueOnce([
      { id: 'remote-1', name: 'Milk', isActive: true, isBought: false, sync_state: 'SYNCED', version: 1 }
    ])

    render(
      <GroceryProvider>
        <ConsumerComponent />
      </GroceryProvider>
    )

    const syncBtn = screen.getByTestId('sync-btn')
    await act(async () => {
      fireEvent.click(syncBtn)
    })

    expect(mockSyncNow).toHaveBeenCalled()
    expect(screen.getByTestId('items-count').textContent).toBe('1')
    expect(storage.getItem(STORAGE_KEYS.LAST_SYNCED, '')).toBe('2026-06-27T18:00:00Z')
  })

  it('should sort items and lists correctly (is_deleted at back, isActive = false at back, then createdAt ascending)', () => {
    const itemsData = [
      { id: 'item-1', name: 'Item 1', isActive: false, createdAt: 1000, is_deleted: false, sync_state: 'SYNCED', version: 1 },
      { id: 'item-2', name: 'Item 2', isActive: true, createdAt: 3000, is_deleted: false, sync_state: 'SYNCED', version: 1 },
      { id: 'item-3', name: 'Item 3', isActive: true, createdAt: 2000, is_deleted: false, sync_state: 'SYNCED', version: 1 },
      { id: 'item-4', name: 'Item 4', isActive: true, createdAt: 500, is_deleted: true, sync_state: 'SYNCED', version: 1 },
      { id: 'item-5', name: 'Item 5', isActive: false, createdAt: 4000, is_deleted: true, sync_state: 'SYNCED', version: 1 }
    ] as any[]

    storage.setItem(STORAGE_KEYS.ITEMS, itemsData)
    storage.setItem(STORAGE_KEYS.LISTS, [
      { id: 'list-2', name: 'List 2', createdAt: 5000, is_deleted: true },
      { id: 'list-1', name: 'List 1', createdAt: 1000, is_deleted: false },
      { id: 'list-3', name: 'List 3', createdAt: 3000, is_deleted: false }
    ])

    let capturedItems: any[] = []
    let capturedLists: any[] = []
    
    function TestConsumer() {
      const { items, lists } = useGrocery()
      useEffect(() => {
        capturedItems = items
        capturedLists = lists
      }, [items, lists])
      return null
    }

    render(
      <GroceryProvider>
        <TestConsumer />
      </GroceryProvider>
    )

    // Expected items ordering:
    // 1. Not deleted, Active: sorted by createdAt ascending
    //    - 'item-3' (createdAt: 2000)
    //    - 'item-2' (createdAt: 3000)
    // 2. Not deleted, Inactive:
    //    - 'item-1' (createdAt: 1000)
    // 3. Deleted:
    //    - 'item-4' (is_deleted: true, isActive: true, createdAt: 500)
    //    - 'item-5' (is_deleted: true, isActive: false, createdAt: 4000)
    expect(capturedItems[0].id).toBe('item-3')
    expect(capturedItems[1].id).toBe('item-2')
    expect(capturedItems[2].id).toBe('item-1')
    expect(capturedItems[3].id).toBe('item-4')
    expect(capturedItems[4].id).toBe('item-5')

    // Expected lists ordering:
    // 1. Not deleted: sorted by createdAt ascending
    //    - 'list-1' (createdAt: 1000)
    //    - 'list-3' (createdAt: 3000)
    // 2. Deleted:
    //    - 'list-2' (createdAt: 5000)
    expect(capturedLists[0].id).toBe('list-1')
    expect(capturedLists[1].id).toBe('list-3')
    expect(capturedLists[2].id).toBe('list-2')
  })

  it('should queue a subsequent sync if handleManualSync is called while a sync is in progress', async () => {
    vi.useFakeTimers()
    
    // Setup mockSyncNow to return a promise that we can control
    let resolveFirstSync: any
    const firstSyncPromise = new Promise(resolve => {
      resolveFirstSync = resolve
    })
    mockSyncNow.mockImplementationOnce(() => firstSyncPromise)
    mockSyncNow.mockImplementationOnce(() => Promise.resolve({
      server_timestamp: '2026-06-27T19:00:00Z',
      remote_grocery_changes: [],
      remote_grocery_list_changes: [],
      remote_grocery_list_member_changes: [],
      remote_store_changes: [],
      remote_category_changes: [],
      remote_grocery_item_store_info_changes: [],
    }))
    mockSyncNow.mockImplementationOnce(() => Promise.resolve({
      server_timestamp: '2026-06-27T20:00:00Z',
      remote_grocery_changes: [],
      remote_grocery_list_changes: [],
      remote_grocery_list_member_changes: [],
      remote_store_changes: [],
      remote_category_changes: [],
      remote_grocery_item_store_info_changes: [],
    }))

    render(
      <GroceryProvider>
        <ConsumerComponent />
      </GroceryProvider>
    )

    const syncBtn = screen.getByTestId('sync-btn')
    
    // Trigger first sync
    await act(async () => {
      fireEvent.click(syncBtn)
    })
    
    // Trigger second sync while first is in progress
    await act(async () => {
      fireEvent.click(syncBtn)
    })
    
    // Resolve the first sync
    await act(async () => {
      resolveFirstSync({
        server_timestamp: '2026-06-27T18:00:00Z',
        remote_grocery_changes: [],
        remote_grocery_list_changes: [],
        remote_grocery_list_member_changes: [],
        remote_store_changes: [],
        remote_category_changes: [],
        remote_grocery_item_store_info_changes: [],
      })
    })
    
    // Verify syncNow is still not called yet
    expect(mockSyncNow).toHaveBeenCalledTimes(1)
    
    // Run the setTimeout timer (300ms)
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    
    // Now verify the second sync was triggered!
    expect(mockSyncNow).toHaveBeenCalledTimes(2)
    
    vi.useRealTimers()
  })
})

