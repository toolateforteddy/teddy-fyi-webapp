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
import {
  normalizeItem,
  normalizeList,
  normalizeListMember,
  normalizeStore,
  normalizeCategory,
  normalizeStoreInfo
} from '@/features/grocery/utils/normalize'

interface UseGrocerySyncOptions {
  clientId?: string
  onSyncSuccess?: (response: SyncResponse) => void
  onSyncError?: (error: Error) => void
}

interface HasSyncAndVersion {
  version: number
  sync_state: string
  is_deleted: boolean
}

/**
 * Generic conflict resolution function to merge server changes into local state.
 */
function resolveModelConflictsGeneric<T extends HasSyncAndVersion>(
  localItems: T[],
  remoteChanges: ChangeDelta<any>[] = [],
  getId: (item: T) => string,
  normalize: (data: any) => T,
  sentIds?: Set<string>
): T[] {
  let merged = [...localItems]

  remoteChanges.forEach(change => {
    const changeIdStr = String(change.id)
    const localIndex = merged.findIndex(item => getId(item) === changeIdStr)

    if (change.type === 'DELETE') {
      if (localIndex !== -1) {
        merged.splice(localIndex, 1)
      }
      return
    }

    const remoteRaw = change.data as any
    if (!remoteRaw) return

    const remoteItem = normalize(remoteRaw)

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
        console.warn(`[Sync] Conflict detected for model ${changeIdStr}. Client version (${localItem.version}) exceeds server (${change.version}). Keeping local changes.`)
      }
    }
  })

  merged = merged.filter(item => {
    if (item.sync_state === 'PENDING_DELETE' && item.is_deleted) {
      if (!sentIds || sentIds.has(getId(item))) {
        return false // Synced successfully; remove from local state
      }
    }
    return true // Keep in local state to be synced in the next batch
  })

  return merged.map(item => {
    if (item.sync_state === 'PENDING_INSERT' || item.sync_state === 'PENDING_UPDATE') {
      const key = getId(item)
      if (!sentIds || sentIds.has(key)) {
        return {
          ...item,
          sync_state: 'SYNCED'
        }
      }
    }
    return item
  })
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
      let hasRemoteChanges = true
      try {
        const checkRes = await api.get<{ needs_sync: boolean }>('/api/sync/status', {
          params: {
            client_id: clientId.current,
            last_synced_at: lastSyncedAt,
            scope: 'GROCERY'
          }
        })
        hasRemoteChanges = checkRes.data.needs_sync
      } catch (err: unknown) {
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

  // Conflict Resolution helper for Items
  const resolveConflicts = useCallback((
    localItems: GroceryItem[],
    remoteChanges: ChangeDelta<GroceryItem>[] = [],
    sentIds?: Set<string>
  ): GroceryItem[] => {
    return resolveModelConflictsGeneric(
      localItems,
      remoteChanges,
      item => item.id,
      normalizeItem,
      sentIds
    )
  }, [])

  // Conflict Resolution helper for Lists
  const resolveListConflicts = useCallback((
    localLists: GroceryList[],
    remoteChanges: ChangeDelta<GroceryList>[] = [],
    sentIds?: Set<string>
  ): GroceryList[] => {
    return resolveModelConflictsGeneric(
      localLists,
      remoteChanges,
      list => list.id,
      normalizeList,
      sentIds
    )
  }, [])

  // Conflict Resolution helper for Stores
  const resolveStoreConflicts = useCallback((
    localStores: Store[],
    remoteChanges: ChangeDelta<Store>[] = [],
    sentIds?: Set<string>
  ): Store[] => {
    return resolveModelConflictsGeneric(
      localStores,
      remoteChanges,
      store => store.id,
      normalizeStore,
      sentIds
    )
  }, [])

  // Conflict Resolution helper for Categories
  const resolveCategoryConflicts = useCallback((
    localCategories: Category[],
    remoteChanges: ChangeDelta<Category>[] = [],
    sentIds?: Set<string>
  ): Category[] => {
    return resolveModelConflictsGeneric(
      localCategories,
      remoteChanges,
      category => category.id,
      normalizeCategory,
      sentIds
    )
  }, [])

  // Conflict Resolution helper for Store Info mapping
  const resolveStoreInfoConflicts = useCallback((
    localInfos: GroceryItemStoreInfo[],
    remoteChanges: ChangeDelta<GroceryItemStoreInfo>[] = [],
    sentIds?: Set<string>
  ): GroceryItemStoreInfo[] => {
    return resolveModelConflictsGeneric(
      localInfos,
      remoteChanges,
      info => `${info.groceryItemId}-${info.storeId}`,
      normalizeStoreInfo,
      sentIds
    )
  }, [])

  // Conflict Resolution helper for Grocery List Members
  const resolveListMemberConflicts = useCallback((
    localMembers: GroceryListMember[],
    remoteChanges: ChangeDelta<GroceryListMember>[] = [],
    sentIds?: Set<string>
  ): GroceryListMember[] => {
    return resolveModelConflictsGeneric(
      localMembers,
      remoteChanges,
      member => member.id,
      normalizeListMember,
      sentIds
    )
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
