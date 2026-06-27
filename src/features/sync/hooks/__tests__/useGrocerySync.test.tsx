import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGrocerySync } from '../useGrocerySync'
import api from '@/lib/axios'
import type { GroceryItem, GroceryList } from '@/types/grocery'

// Mock axios API instance
vi.mock('@/lib/axios', () => {
  return {
    default: {
      get: vi.fn(),
      post: vi.fn(),
    },
    api: {
      get: vi.fn(),
      post: vi.fn(),
    }
  }
})

describe('useGrocerySync Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should skip sync if check-status returns false and there are no local changes', async () => {
    // Mock /api/sync/check-status response
    vi.mocked(api.get).mockResolvedValueOnce({ data: { hasChanges: false } })

    const { result } = renderHook(() => useGrocerySync())

    // Call syncNow with empty lists
    let response: any
    await act(async () => {
      response = await result.current.syncNow([], [], [], [], [], [])
    })

    expect(response).toBeNull()
    expect(api.get).toHaveBeenCalledWith('/api/sync/status', expect.any(Object))
    expect(api.post).not.toHaveBeenCalled()
  })

  it('should trigger full sync if check-status returns hasChanges = true, even with no local changes', async () => {
    const mockSyncResponse = {
      server_timestamp: '2026-06-27T12:00:00Z',
      remote_grocery_changes: [],
      remote_grocery_list_changes: [],
      remote_grocery_list_member_changes: [],
      remote_store_changes: [],
      remote_category_changes: [],
      remote_grocery_item_store_info_changes: [],
    }

    vi.mocked(api.get).mockResolvedValueOnce({ data: { hasChanges: true } })
    vi.mocked(api.post).mockResolvedValueOnce({ data: mockSyncResponse })

    const { result } = renderHook(() => useGrocerySync())

    let response: any
    await act(async () => {
      response = await result.current.syncNow([], [], [], [], [], [])
    })

    expect(response).toEqual(mockSyncResponse)
    expect(api.post).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      grocery_changes: [],
      grocery_list_changes: [],
    }))
  })

  it('should format and upload local dirty mutations when they exist', async () => {
    const localItems: GroceryItem[] = [
      {
        id: 'item-1',
        name: 'Apples',
        quantity: '3',
        isBought: false,
        createdAt: 12345,
        position: 0,
        isActive: true,
        sync_state: 'PENDING_INSERT',
        version: 1,
        is_deleted: false,
        timesBought: 0,
        listId: 'list-1'
      },
      {
        id: 'item-2',
        name: 'Milk',
        quantity: '1',
        isBought: true,
        createdAt: 12346,
        position: 1,
        isActive: true,
        sync_state: 'PENDING_UPDATE',
        version: 2,
        is_deleted: false,
        timesBought: 1,
        listId: 'list-1'
      },
    ]

    const mockSyncResponse = {
      server_timestamp: '2026-06-27T12:00:00Z',
      remote_grocery_changes: [],
      remote_grocery_list_changes: [],
      remote_grocery_list_member_changes: [],
      remote_store_changes: [],
      remote_category_changes: [],
      remote_grocery_item_store_info_changes: [],
    }

    vi.mocked(api.get).mockResolvedValueOnce({ data: { hasChanges: false } })
    vi.mocked(api.post).mockResolvedValueOnce({ data: mockSyncResponse })

    const { result } = renderHook(() => useGrocerySync())

    await act(async () => {
      await result.current.syncNow(localItems, [], [], [], [], [])
    })

    expect(api.post).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      grocery_changes: [
        {
          id: 'item-1',
          type: 'INSERT',
          version: 1,
          data: expect.objectContaining({ name: 'Apples', is_bought: false }),
        },
        {
          id: 'item-2',
          type: 'UPDATE',
          version: 2,
          data: expect.objectContaining({ name: 'Milk', is_bought: true }),
        },
      ]
    }))
  })

  it('should fall back to standard sync if status check fails', async () => {
    const mockSyncResponse = {
      server_timestamp: '2026-06-27T12:00:00Z',
      remote_grocery_changes: [],
      remote_grocery_list_changes: [],
      remote_grocery_list_member_changes: [],
      remote_store_changes: [],
      remote_category_changes: [],
      remote_grocery_item_store_info_changes: [],
    }

    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'))
    vi.mocked(api.post).mockResolvedValueOnce({ data: mockSyncResponse })

    const { result } = renderHook(() => useGrocerySync())

    let response: any
    await act(async () => {
      response = await result.current.syncNow([], [], [], [], [], [])
    })

    expect(response).toEqual(mockSyncResponse)
    expect(api.post).toHaveBeenCalled()
  })

  it('should invoke onSyncError if sync request completely fails', async () => {
    const onSyncErrorSpy = vi.fn()
    vi.mocked(api.get).mockResolvedValueOnce({ data: { hasChanges: true } })
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Sync failed'))

    const { result } = renderHook(() => useGrocerySync({ onSyncError: onSyncErrorSpy }))

    await act(async () => {
      await expect(result.current.syncNow([], [], [], [], [], [])).rejects.toThrow('Sync failed')
    })
    expect(onSyncErrorSpy).toHaveBeenCalledWith(expect.any(Error))
  })

  describe('Conflict Resolution Helpers', () => {
    it('resolveConflicts (items): should overwrite local with remote when version is equal or higher', () => {
      const { result } = renderHook(() => useGrocerySync())
      
      const localItems: GroceryItem[] = [
        {
          id: 'item-1',
          name: 'Old Name',
          quantity: '1',
          isBought: false,
          createdAt: 100,
          position: 0,
          isActive: true,
          sync_state: 'PENDING_UPDATE',
          version: 2,
          is_deleted: false,
          timesBought: 0,
          listId: 'list-1'
        }
      ]

      const remoteChanges = [
        {
          id: 'item-1',
          type: 'UPDATE' as const,
          version: 3,
          data: {
            id: 'item-1',
            name: 'New Server Name',
            quantity: '2',
            is_bought: true,
            created_at: 100,
            position: 0,
            is_active: true,
            version: 3,
            is_deleted: false,
          } as any
        }
      ]

      const merged = result.current.resolveConflicts(localItems, remoteChanges)
      expect(merged[0].name).toBe('New Server Name')
      expect(merged[0].isBought).toBe(true)
      expect(merged[0].sync_state).toBe('SYNCED')
    })

    it('resolveConflicts (items): should keep local version when local version is strictly higher', () => {
      const { result } = renderHook(() => useGrocerySync())

      const localItems: GroceryItem[] = [
        {
          id: 'item-1',
          name: 'New Client Name',
          quantity: '2',
          isBought: true,
          createdAt: 100,
          position: 0,
          isActive: true,
          sync_state: 'PENDING_UPDATE',
          version: 4,
          is_deleted: false,
          timesBought: 0,
          listId: 'list-1'
        }
      ]

      const remoteChanges = [
        {
          id: 'item-1',
          type: 'UPDATE' as const,
          version: 3,
          data: {
            id: 'item-1',
            name: 'Old Server Name',
            quantity: '1',
            is_bought: false,
            created_at: 100,
            position: 0,
            is_active: true,
            version: 3,
            is_deleted: false,
          } as any
        }
      ]

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const merged = result.current.resolveConflicts(localItems, remoteChanges)
      expect(merged[0].name).toBe('New Client Name')
      // Local changes should be marked SYNCED after a successful resolve sequence
      expect(merged[0].sync_state).toBe('SYNCED')
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('resolveListConflicts: should resolve list conflicts correctly', () => {
      const { result } = renderHook(() => useGrocerySync())

      const localLists: GroceryList[] = [
        {
          id: 'list-1',
          name: 'My Shopping List',
          createdAt: 100,
          sync_state: 'PENDING_UPDATE',
          version: 1,
          is_deleted: false,
        }
      ]

      const remoteChanges = [
        {
          id: 'list-1',
          type: 'UPDATE' as const,
          version: 2,
          data: {
            id: 'list-1',
            name: 'Shared Family List',
            created_at: 100,
            version: 2,
            is_deleted: false,
          } as any
        }
      ]

      const merged = result.current.resolveListConflicts(localLists, remoteChanges)
      expect(merged[0].name).toBe('Shared Family List')
      expect(merged[0].sync_state).toBe('SYNCED')
    })
  })
})
