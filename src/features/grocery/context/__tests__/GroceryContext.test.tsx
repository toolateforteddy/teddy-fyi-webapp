import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GroceryProvider, useGrocery } from '../GroceryContext'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'

// Mock useAuth
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'test@example.com' }
  })
}))

// Mock useGrocerySync
const mockSyncNow = vi.fn()
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

  it('should initialize a default list if storage is empty and last synced check triggers it', async () => {
    // To trigger default list creation in initializer, lastSynced key needs to exist
    storage.setItem(STORAGE_KEYS.LAST_SYNCED, '2026-06-27T12:00:00Z')

    render(
      <GroceryProvider>
        <ConsumerComponent />
      </GroceryProvider>
    )

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
})
