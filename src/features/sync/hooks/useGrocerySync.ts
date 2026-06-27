import { useState, useCallback, useRef } from 'react'
import api from '@/lib/axios'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import { getClientUuid } from '@/utils/uuid'
import type { 
  GroceryItem, 
  GroceryList,
  GroceryListMember,
  Store, 
  Category, 
  GroceryItemStoreInfo,
  ChangeDelta, 
  SyncRequest, 
  SyncResponse
} from '@/types/grocery'

interface UseGrocerySyncOptions {
  clientId?: string
  onSyncSuccess?: (response: SyncResponse) => void
  onSyncError?: (error: Error) => void
}

export function useGrocerySync(options: UseGrocerySyncOptions = {}) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  // Client Identifier (saved or generated)
  const clientId = useRef<string | null>(null)
  if (clientId.current === null) {
    clientId.current = getClientUuid()
  }

  // Core Sync Trigger
  const syncNow = useCallback(async (
    localItems: GroceryItem[],
    localLists: GroceryList[] = [],
    localStores: Store[] = [],
    localCategories: Category[] = [],
    localItemStoreInfos: GroceryItemStoreInfo[] = [],
    localListMembers: GroceryListMember[] = []
  ): Promise<SyncResponse | null> => {
    setIsSyncing(true)
    setError(null)

    try {
      const lastSyncedAt = storage.getItem<string>(STORAGE_KEYS.LAST_SYNCED, '') || new Date(0).toISOString()
      
      // 1. Check KV status change flag to minimize payload size and query costs.
      // Default to true (pull data) if the endpoint returns 404 or fails.
      let hasRemoteChanges = true
      try {
        const checkRes = await api.get<{ hasChanges: boolean }>('/api/sync/check-status', {
          params: {
            client_id: clientId.current,
            last_synced_at: lastSyncedAt
          }
        })
        hasRemoteChanges = checkRes.data.hasChanges
      } catch (err: unknown) {
        // Fallback: If 404 (or other status) is returned, assume remote has changes to fetch silently
        const errorResponse = (err as { response?: { status?: number } }).response
        if (errorResponse?.status === 404) {
          console.warn('[Sync] Status endpoint returned 404. Proceeding with full payload sync fallback.')
        } else {
          console.error('[Sync] Status check failed. Falling back to full sync.', err)
        }
        hasRemoteChanges = true
      }

      // 2. Identify and bundle local dirty mutations
      const groceryChanges: ChangeDelta<GroceryItem>[] = localItems
        .filter(item => item.sync_state !== 'SYNCED')
        .map(item => {
          let deltaType: 'INSERT' | 'UPDATE' | 'DELETE' = 'UPDATE'
          if (item.sync_state === 'PENDING_INSERT') deltaType = 'INSERT'
          if (item.sync_state === 'PENDING_DELETE' || item.is_deleted) deltaType = 'DELETE'

          return {
            id: item.id,
            type: deltaType,
            version: item.version,
            // Don't send data details on deletes
            data: deltaType === 'DELETE' ? null : {
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              is_bought: item.isBought,
              created_at: item.createdAt,
              position: item.position,
              category_id: item.categoryId || null,
              times_bought: item.timesBought,
              user_id: item.userId || null,
              is_active: item.isActive,
              list_id: item.listId,
              unit: item.unit || null,
              notes: item.notes || null,
              sync_state: item.sync_state,
              version: item.version,
              is_deleted: item.is_deleted
            } as any
          }
        })

      const listChanges: ChangeDelta<GroceryList>[] = localLists
        .filter(list => list.sync_state !== 'SYNCED')
        .map(list => {
          let deltaType: 'INSERT' | 'UPDATE' | 'DELETE' = 'UPDATE'
          if (list.sync_state === 'PENDING_INSERT') deltaType = 'INSERT'
          if (list.sync_state === 'PENDING_DELETE' || list.is_deleted) deltaType = 'DELETE'

          return {
            id: list.id,
            type: deltaType,
            version: list.version,
            data: deltaType === 'DELETE' ? null : {
              id: list.id,
              name: list.name,
              owner_id: list.ownerId || null,
              created_at: list.createdAt,
              sync_state: list.sync_state,
              version: list.version,
              is_deleted: list.is_deleted
            } as any
          }
        })

      const listMemberChanges: ChangeDelta<GroceryListMember>[] = localListMembers
        .filter(member => member.sync_state !== 'SYNCED')
        .map(member => {
          let deltaType: 'INSERT' | 'UPDATE' | 'DELETE' = 'UPDATE'
          if (member.sync_state === 'PENDING_INSERT') deltaType = 'INSERT'
          if (member.sync_state === 'PENDING_DELETE' || member.is_deleted) deltaType = 'DELETE'

          return {
            id: member.id,
            type: deltaType,
            version: member.version,
            data: deltaType === 'DELETE' ? null : {
              id: member.id,
              list_id: member.listId,
              user_id: member.userId,
              role: member.role,
              joined_at: member.joinedAt,
              sync_state: member.sync_state,
              version: member.version,
              is_deleted: member.is_deleted
            } as any
          }
        })

      const storeChanges: ChangeDelta<Store>[] = localStores
        .filter(store => store.sync_state !== 'SYNCED')
        .map(store => {
          let deltaType: 'INSERT' | 'UPDATE' | 'DELETE' = 'UPDATE'
          if (store.sync_state === 'PENDING_INSERT') deltaType = 'INSERT'
          if (store.sync_state === 'PENDING_DELETE' || store.is_deleted) deltaType = 'DELETE'

          return {
            id: store.id,
            type: deltaType,
            version: store.version,
            data: deltaType === 'DELETE' ? null : {
              id: store.id,
              name: store.name,
              position: store.position,
              is_default_supported: store.isDefaultSupported,
              user_id: store.userId || null,
              list_id: store.listId,
              sync_state: store.sync_state,
              version: store.version,
              is_deleted: store.is_deleted
            } as any
          }
        })

      const categoryChanges: ChangeDelta<Category>[] = localCategories
        .filter(category => category.sync_state !== 'SYNCED')
        .map(category => {
          let deltaType: 'INSERT' | 'UPDATE' | 'DELETE' = 'UPDATE'
          if (category.sync_state === 'PENDING_INSERT') deltaType = 'INSERT'
          if (category.sync_state === 'PENDING_DELETE' || category.is_deleted) deltaType = 'DELETE'

          return {
            id: category.id,
            type: deltaType,
            version: category.version,
            data: deltaType === 'DELETE' ? null : {
              id: category.id,
              name: category.name,
              position: category.position,
              user_id: category.userId || null,
              icon: category.icon || null,
              list_id: category.listId,
              sync_state: category.sync_state,
              version: category.version,
              is_deleted: category.is_deleted
            } as any
          }
        })

      const groceryItemStoreInfoChanges: ChangeDelta<GroceryItemStoreInfo>[] = localItemStoreInfos
        .filter(info => info.sync_state !== 'SYNCED')
        .map(info => {
          let deltaType: 'INSERT' | 'UPDATE' | 'DELETE' = 'UPDATE'
          if (info.sync_state === 'PENDING_INSERT') deltaType = 'INSERT'
          if (info.sync_state === 'PENDING_DELETE' || info.is_deleted) deltaType = 'DELETE'

          return {
            id: `${info.groceryItemId}-${info.storeId}`,
            type: deltaType,
            version: info.version,
            data: deltaType === 'DELETE' ? null : {
              grocery_item_id: info.groceryItemId,
              store_id: info.storeId,
              price: info.price || null,
              is_available: info.isAvailable,
              user_id: info.userId || null,
              list_id: info.listId,
              sync_state: info.sync_state,
              version: info.version,
              is_deleted: info.is_deleted
            } as any
          }
        })

      // Skip heavy network request if neither the remote server nor local client has changes
      const hasLocalChanges = 
        groceryChanges.length > 0 || 
        listChanges.length > 0 || 
        listMemberChanges.length > 0 ||
        storeChanges.length > 0 || 
        categoryChanges.length > 0 ||
        groceryItemStoreInfoChanges.length > 0

      if (!hasRemoteChanges && !hasLocalChanges) {
        console.log('[Sync] Caching optimization hit. Client and remote match. Skipping sync payload.')
        setIsSyncing(false)
        return null
      }

      // 3. Construct synchronization protocol payload
      const syncRequest: SyncRequest = {
        last_synced_at: lastSyncedAt,
        client_id: clientId.current || '',
        scope: 'GROCERY',
        grocery_changes: groceryChanges,
        grocery_list_changes: listChanges,
        grocery_list_member_changes: listMemberChanges,
        store_changes: storeChanges,
        category_changes: categoryChanges,
        grocery_item_store_info_changes: groceryItemStoreInfoChanges,
      }

      // 4. Transport payload to atomic sync endpoint
      const response = await api.post<SyncResponse>('/api/sync', syncRequest)
      const syncResponse = response.data

      // 5. Update local tracking states
      storage.setItem(STORAGE_KEYS.LAST_SYNCED, syncResponse.server_timestamp)
      
      if (options.onSyncSuccess) {
        options.onSyncSuccess(syncResponse)
      }

      setIsSyncing(false)
      return syncResponse

    } catch (err: unknown) {
      console.error('[Sync] Fatal sync execution error:', err)
      const errorObj = err instanceof Error ? err : new Error((err as { message?: string }).message || 'Sync failed')
      setError(errorObj)
      setIsSyncing(false)
      
      if (options.onSyncError) {
        options.onSyncError(errorObj)
      }
      throw errorObj
    }
  }, [clientId, options])

  // Conflict Resolution helper to merge server changes into local state
  const resolveConflicts = useCallback((
    localItems: GroceryItem[],
    remoteChanges: ChangeDelta<GroceryItem>[] = []
  ): GroceryItem[] => {
    let merged = [...localItems]

    remoteChanges.forEach(change => {
      const localIndex = merged.findIndex(item => item.id === change.id)

      if (change.type === 'DELETE') {
        if (localIndex !== -1) {
          merged.splice(localIndex, 1)
        }
        return
      }

      const remoteRaw = change.data as any
      if (!remoteRaw) return

      const remoteItem: GroceryItem = {
        ...remoteRaw,
        listId: remoteRaw.listId || remoteRaw.list_id || '',
        categoryId: remoteRaw.categoryId || remoteRaw.category_id,
        createdAt: remoteRaw.createdAt || remoteRaw.created_at,
        isActive: remoteRaw.isActive !== undefined ? remoteRaw.isActive : remoteRaw.is_active,
        isBought: remoteRaw.isBought !== undefined ? remoteRaw.isBought : remoteRaw.is_bought,
        timesBought: remoteRaw.timesBought !== undefined ? remoteRaw.timesBought : remoteRaw.times_bought,
        userId: remoteRaw.userId || remoteRaw.user_id,
      }

      if (localIndex === -1) {
        merged.push({
          ...remoteItem,
          sync_state: 'SYNCED'
        })
      } else {
        const localItem = merged[localIndex]
        
        if (change.version >= localItem.version) {
          merged[localIndex] = {
            ...remoteItem,
            sync_state: 'SYNCED'
          }
        } else {
          console.warn(`[Sync] Conflict detected for item ${localItem.name}. Client version (${localItem.version}) exceeds server (${change.version}). Keeping local changes.`)
        }
      }
    })

    merged = merged.filter(item => !(item.sync_state === 'PENDING_DELETE' && item.is_deleted))

    return merged.map(item => {
      if (item.sync_state === 'PENDING_INSERT' || item.sync_state === 'PENDING_UPDATE') {
        return {
          ...item,
          sync_state: 'SYNCED'
        }
      }
      return item
    })
  }, [])

  // Conflict Resolution helper for Lists
  const resolveListConflicts = useCallback((
    localLists: GroceryList[],
    remoteChanges: ChangeDelta<GroceryList>[] = []
  ): GroceryList[] => {
    let merged = [...localLists]

    remoteChanges.forEach(change => {
      const localIndex = merged.findIndex(list => list.id === change.id)

      if (change.type === 'DELETE') {
        if (localIndex !== -1) {
          merged.splice(localIndex, 1)
        }
        return
      }

      const remoteRaw = change.data as any
      if (!remoteRaw) return

      const remoteList: GroceryList = {
        ...remoteRaw,
        ownerId: remoteRaw.ownerId || remoteRaw.owner_id,
        createdAt: remoteRaw.createdAt || remoteRaw.created_at,
      }

      if (localIndex === -1) {
        merged.push({
          ...remoteList,
          sync_state: 'SYNCED'
        })
      } else {
        const localList = merged[localIndex]
        if (change.version >= localList.version) {
          merged[localIndex] = {
            ...remoteList,
            sync_state: 'SYNCED'
          }
        }
      }
    })

    merged = merged.filter(list => !(list.sync_state === 'PENDING_DELETE' && list.is_deleted))

    return merged.map(list => {
      if (list.sync_state === 'PENDING_INSERT' || list.sync_state === 'PENDING_UPDATE') {
        return {
          ...list,
          sync_state: 'SYNCED'
        }
      }
      return list
    })
  }, [])

  // Conflict Resolution helper for Stores
  const resolveStoreConflicts = useCallback((
    localStores: Store[],
    remoteChanges: ChangeDelta<Store>[] = []
  ): Store[] => {
    let merged = [...localStores]

    remoteChanges.forEach(change => {
      const localIndex = merged.findIndex(store => store.id === change.id)

      if (change.type === 'DELETE') {
        if (localIndex !== -1) {
          merged.splice(localIndex, 1)
        }
        return
      }

      const remoteRaw = change.data as any
      if (!remoteRaw) return

      const remoteStore: Store = {
        ...remoteRaw,
        listId: remoteRaw.listId || remoteRaw.list_id || '',
        isDefaultSupported: remoteRaw.isDefaultSupported !== undefined ? remoteRaw.isDefaultSupported : remoteRaw.is_default_supported,
        userId: remoteRaw.userId || remoteRaw.user_id,
      }

      if (localIndex === -1) {
        merged.push({
          ...remoteStore,
          sync_state: 'SYNCED'
        })
      } else {
        const localStore = merged[localIndex]
        if (change.version >= localStore.version) {
          merged[localIndex] = {
            ...remoteStore,
            sync_state: 'SYNCED'
          }
        }
      }
    })

    merged = merged.filter(store => !(store.sync_state === 'PENDING_DELETE' && store.is_deleted))

    return merged.map(store => {
      if (store.sync_state === 'PENDING_INSERT' || store.sync_state === 'PENDING_UPDATE') {
        return {
          ...store,
          sync_state: 'SYNCED'
        }
      }
      return store
    })
  }, [])

  // Conflict Resolution helper for Categories
  const resolveCategoryConflicts = useCallback((
    localCategories: Category[],
    remoteChanges: ChangeDelta<Category>[] = []
  ): Category[] => {
    let merged = [...localCategories]

    remoteChanges.forEach(change => {
      const localIndex = merged.findIndex(category => category.id === change.id)

      if (change.type === 'DELETE') {
        if (localIndex !== -1) {
          merged.splice(localIndex, 1)
        }
        return
      }

      const remoteRaw = change.data as any
      if (!remoteRaw) return

      const remoteCategory: Category = {
        ...remoteRaw,
        listId: remoteRaw.listId || remoteRaw.list_id || '',
        userId: remoteRaw.userId || remoteRaw.user_id,
      }

      if (localIndex === -1) {
        merged.push({
          ...remoteCategory,
          sync_state: 'SYNCED'
        })
      } else {
        const localCategory = merged[localIndex]
        if (change.version >= localCategory.version) {
          merged[localIndex] = {
            ...remoteCategory,
            sync_state: 'SYNCED'
          }
        }
      }
    })

    merged = merged.filter(category => !(category.sync_state === 'PENDING_DELETE' && category.is_deleted))

    return merged.map(category => {
      if (category.sync_state === 'PENDING_INSERT' || category.sync_state === 'PENDING_UPDATE') {
        return {
          ...category,
          sync_state: 'SYNCED'
        }
      }
      return category
    })
  }, [])

  // Conflict Resolution helper for Store Info mapping
  const resolveStoreInfoConflicts = useCallback((
    localInfos: GroceryItemStoreInfo[],
    remoteChanges: ChangeDelta<GroceryItemStoreInfo>[] = []
  ): GroceryItemStoreInfo[] => {
    let merged = [...localInfos]

    remoteChanges.forEach(change => {
      const remoteRaw = change.data as any
      const lastHyphenIndex = String(change.id).lastIndexOf('-')
      const itemId = remoteRaw ? String(remoteRaw.groceryItemId || remoteRaw.grocery_item_id) : String(change.id).substring(0, lastHyphenIndex)
      const storeId = remoteRaw ? (remoteRaw.storeId || remoteRaw.store_id) : parseInt(String(change.id).substring(lastHyphenIndex + 1), 10)

      const localIndex = merged.findIndex(info => info.groceryItemId === itemId && info.storeId === storeId)

      if (change.type === 'DELETE') {
        if (localIndex !== -1) {
          merged.splice(localIndex, 1)
        }
        return
      }

      if (!remoteRaw) return

      const remoteInfo: GroceryItemStoreInfo = {
        ...remoteRaw,
        groceryItemId: itemId,
        storeId: storeId,
        listId: remoteRaw.listId || remoteRaw.list_id || '',
        isAvailable: remoteRaw.isAvailable !== undefined ? remoteRaw.isAvailable : remoteRaw.is_available,
        userId: remoteRaw.userId || remoteRaw.user_id,
      }

      if (localIndex === -1) {
        merged.push({
          ...remoteInfo,
          sync_state: 'SYNCED'
        })
      } else {
        const localInfo = merged[localIndex]
        if (change.version >= localInfo.version) {
          merged[localIndex] = {
            ...remoteInfo,
            sync_state: 'SYNCED'
          }
        }
      }
    })

    merged = merged.filter(info => !(info.sync_state === 'PENDING_DELETE' && info.is_deleted))

    return merged.map(info => {
      if (info.sync_state === 'PENDING_INSERT' || info.sync_state === 'PENDING_UPDATE') {
        return {
          ...info,
          sync_state: 'SYNCED'
        }
      }
      return info
    })
  }, [])

  // Conflict Resolution helper for Grocery List Members
  const resolveListMemberConflicts = useCallback((
    localMembers: GroceryListMember[],
    remoteChanges: ChangeDelta<GroceryListMember>[] = []
  ): GroceryListMember[] => {
    let merged = [...localMembers]

    remoteChanges.forEach(change => {
      const localIndex = merged.findIndex(member => member.id === change.id)

      if (change.type === 'DELETE') {
        if (localIndex !== -1) {
          merged.splice(localIndex, 1)
        }
        return
      }

      const remoteRaw = change.data as any
      if (!remoteRaw) return

      const remoteMember: GroceryListMember = {
        ...remoteRaw,
        listId: remoteRaw.listId || remoteRaw.list_id || '',
        userId: remoteRaw.userId || remoteRaw.user_id || '',
        joinedAt: remoteRaw.joinedAt || remoteRaw.joined_at,
      }

      if (localIndex === -1) {
        merged.push({
          ...remoteMember,
          sync_state: 'SYNCED'
        })
      } else {
        const localMember = merged[localIndex]
        if (change.version >= localMember.version) {
          merged[localIndex] = {
            ...remoteMember,
            sync_state: 'SYNCED'
          }
        }
      }
    })

    merged = merged.filter(member => !(member.sync_state === 'PENDING_DELETE' && member.is_deleted))

    return merged.map(member => {
      if (member.sync_state === 'PENDING_INSERT' || member.sync_state === 'PENDING_UPDATE') {
        return {
          ...member,
          sync_state: 'SYNCED'
        }
      }
      return member
    })
  }, [])

  return {
    syncNow,
    resolveConflicts,
    resolveListConflicts,
    resolveListMemberConflicts,
    resolveStoreConflicts,
    resolveCategoryConflicts,
    resolveStoreInfoConflicts,
    isSyncing,
    error
  }
}

export default useGrocerySync
