import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { rowUserId, legacyRowUserId } from '@/features/auth/utils/identity'
import { useGrocerySync } from '@/features/sync/hooks/useGrocerySync'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import { generateUuid } from '@/utils/uuid'
import type { GroceryItem, GroceryList, GroceryListMember, Store, Category, GroceryItemStoreInfo } from '@/types/grocery'
import {
  sortItems,
  sortLists,
  sortMembers,
  sortStores,
  sortCategories,
  sortStoreInfos
} from '@/features/grocery/utils/sort'
import {
  normalizeItem,
  normalizeList,
  normalizeListMember,
  normalizeStore,
  normalizeCategory,
  normalizeStoreInfo
} from '@/features/grocery/utils/normalize'

/**
 * What the sync dot in the header is saying.
 *
 * `offline` and `pending` both mean "your changes are still here", and they are
 * separate because the answer to "should I worry?" differs: offline is expected and
 * self-correcting, pending while online means a sync is failing for some other
 * reason. `stale` is about *reading* -- nothing has come down in over a day -- which
 * is why it is last: an unsent change is more worth saying than an old read.
 */
export type SyncStatus = 'syncing' | 'offline' | 'pending' | 'stale' | 'synced'

interface GroceryContextType {
  activeListId: string
  setActiveListId: (id: string) => void
  items: GroceryItem[]
  setItems: React.Dispatch<React.SetStateAction<GroceryItem[]>>
  lists: GroceryList[]
  setLists: React.Dispatch<React.SetStateAction<GroceryList[]>>
  listMembers: GroceryListMember[]
  setListMembers: React.Dispatch<React.SetStateAction<GroceryListMember[]>>
  stores: Store[]
  setStores: React.Dispatch<React.SetStateAction<Store[]>>
  categories: Category[]
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>
  itemStoreInfos: GroceryItemStoreInfo[]
  setItemStoreInfos: React.Dispatch<React.SetStateAction<GroceryItemStoreInfo[]>>
  syncStatus: SyncStatus
  isSyncing: boolean
  /** Whether the browser currently reports a network. See useOnlineStatus. */
  isOnline: boolean
  /** Rows edited here that the server has not acknowledged yet, across every table. */
  pendingCount: number
  lastSyncedAt: string
  handleManualSync: () => Promise<any>
}

const GroceryContext = createContext<GroceryContextType | undefined>(undefined)

/**
 * Custom hook to manage state synchronized with LocalStorage.
 */
function usePersistentState<T>(
  key: string,
  normalizer: (item: any) => T,
  sorter: (arr: T[]) => T[]
): [T[], React.Dispatch<React.SetStateAction<T[]>>] {
  const [state, setState] = useState<T[]>(() => {
    const raw = storage.getItem<any[]>(key, [])
    const mapped = raw.map(normalizer)
    return sorter(mapped)
  })

  const isExternalUpdateRef = useRef(false)

  useEffect(() => {
    if (isExternalUpdateRef.current) {
      isExternalUpdateRef.current = false
      return
    }
    storage.setItem(key, sorter(state))
  }, [key, state, sorter])

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          const parsed = JSON.parse(event.newValue)
          if (Array.isArray(parsed)) {
            const mapped = parsed.map(normalizer)
            isExternalUpdateRef.current = true
            setState(sorter(mapped))
          }
        } catch (e) {
          console.error('[Storage] Failed to parse cross-tab storage update:', e)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [key, normalizer, sorter])

  return [state, setState]
}

export function GroceryProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  // Hydrate states with persistence
  const [items, setItems] = usePersistentState(STORAGE_KEYS.ITEMS, normalizeItem, sortItems)
  const [lists, setLists] = usePersistentState(STORAGE_KEYS.LISTS, normalizeList, sortLists)
  const [listMembers, setListMembers] = usePersistentState(STORAGE_KEYS.LIST_MEMBERS, normalizeListMember, sortMembers)
  const [stores, setStores] = usePersistentState(STORAGE_KEYS.STORES, normalizeStore, sortStores)
  const [categories, setCategories] = usePersistentState(STORAGE_KEYS.CATEGORIES, normalizeCategory, sortCategories)
  const [itemStoreInfos, setItemStoreInfos] = usePersistentState(STORAGE_KEYS.ITEM_STORE_INFOS, normalizeStoreInfo, sortStoreInfos)

  // Declare refs to keep track of the latest states without closing over stale render values
  const itemsRef = useRef(items)
  const listsRef = useRef(lists)
  const listMembersRef = useRef(listMembers)
  const storesRef = useRef(stores)
  const categoriesRef = useRef(categories)
  const itemStoreInfosRef = useRef(itemStoreInfos)

  // Keep refs up-to-date after each commit. Nothing reads them during render --
  // they exist so the async sync path can see the latest state without closing
  // over stale render values -- so an effect is the safe place to write them.
  useEffect(() => {
    itemsRef.current = items
    listsRef.current = lists
    listMembersRef.current = listMembers
    storesRef.current = stores
    categoriesRef.current = categories
    itemStoreInfosRef.current = itemStoreInfos
  }, [items, lists, listMembers, stores, categories, itemStoreInfos])

  // Active list ID management
  const [activeListId, setActiveListId] = useState<string>(() => {
    return storage.getItem<string>(STORAGE_KEYS.ACTIVE_LIST_ID, '') || ''
  })

  const isExternalActiveListRef = useRef(false)

  useEffect(() => {
    if (isExternalActiveListRef.current) {
      isExternalActiveListRef.current = false
      return
    }
    storage.setItem(STORAGE_KEYS.ACTIVE_LIST_ID, activeListId)
  }, [activeListId])

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.ACTIVE_LIST_ID && event.newValue !== null) {
        isExternalActiveListRef.current = true
        setActiveListId(event.newValue)
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // Sync state tracking
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => {
    const saved = storage.getItem<string>(STORAGE_KEYS.LAST_SYNCED, '')
    return saved || new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
  })

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.LAST_SYNCED && event.newValue !== null) {
        setLastSyncedAt(event.newValue)
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const isOnline = useOnlineStatus()

  /**
   * Rows this device has changed that the server has not acknowledged yet.
   *
   * Every table carries the same `sync_state`, and anything other than `SYNCED` is
   * something still owed to the server -- which is exactly what a shopper wants
   * counted when they are standing in an aisle with no signal. The auto-sync effect
   * below triggers off this same number, so the indicator and the thing it describes
   * cannot drift apart.
   */
  const pendingCount =
    (items || []).filter(i => i.sync_state !== 'SYNCED').length +
    (lists || []).filter(l => l.sync_state !== 'SYNCED').length +
    (listMembers || []).filter(m => m.sync_state !== 'SYNCED').length +
    (stores || []).filter(s => s.sync_state !== 'SYNCED').length +
    (categories || []).filter(c => c.sync_state !== 'SYNCED').length +
    (itemStoreInfos || []).filter(info => info.sync_state !== 'SYNCED').length

  // Derive sync status
  const isStale = (() => {
    const lastSyncedMs = Date.parse(lastSyncedAt)
    if (isNaN(lastSyncedMs)) return true
    // eslint-disable-next-line react-hooks/purity
    const diffHours = (Date.now() - lastSyncedMs) / (1000 * 60 * 60)
    return diffHours > 24
  })()

  const { 
    syncNow, 
    resolveConflicts, 
    resolveListConflicts, 
    resolveListMemberConflicts,
    resolveStoreConflicts, 
    resolveCategoryConflicts, 
    resolveStoreInfoConflicts,
    isSyncing 
  } = useGrocerySync()

  const isSyncingRef = useRef(false)
  const syncNeededRef = useRef(false)
  const handleManualSyncRef = useRef<() => Promise<any>>(null as any)

  // Triggers manual sync using the real syncNow hook
  const handleManualSync = async (): Promise<any> => {
    if (isSyncingRef.current) {
      syncNeededRef.current = true
      return null
    }
    if (!user) return null

    isSyncingRef.current = true

    // Capture snapshots of the current state at the exact time sync starts using the latest refs
    const currentItems = itemsRef.current
    const currentLists = listsRef.current
    const currentStores = storesRef.current
    const currentCategories = categoriesRef.current
    const currentItemStoreInfos = itemStoreInfosRef.current
    const currentListMembers = listMembersRef.current

    const sentItemIds = new Set(currentItems.filter(item => item.sync_state !== 'SYNCED').map(item => item.id))
    const sentListIds = new Set(currentLists.filter(list => list.sync_state !== 'SYNCED').map(list => list.id))
    const sentStoreIds = new Set(currentStores.filter(store => store.sync_state !== 'SYNCED').map(store => store.id))
    const sentCategoryIds = new Set(currentCategories.filter(category => category.sync_state !== 'SYNCED').map(category => category.id))
    const sentMemberIds = new Set(currentListMembers.filter(member => member.sync_state !== 'SYNCED').map(member => member.id))
    const sentStoreInfoIds = new Set(
      currentItemStoreInfos
        .filter(info => info.sync_state !== 'SYNCED')
        .map(info => `${info.groceryItemId}-${info.storeId}`)
    )

    try {
      const response = await syncNow(
        currentItems,
        currentLists,
        currentStores,
        currentCategories,
        currentItemStoreInfos,
        currentListMembers
      )

      if (response) {
        // Resolve default list/member before state updates to keep them aligned
        const mergedListsForCheck = resolveListConflicts(currentLists, response.remote_grocery_list_changes, sentListIds)
        const activeListsForCheck = mergedListsForCheck.filter(l => !l.is_deleted)
        
        let defaultList: GroceryList | null = null
        let defaultMember: GroceryListMember | null = null
        
        if (activeListsForCheck.length === 0) {
          const defaultListId = generateUuid()
          defaultList = {
            id: defaultListId,
            name: 'My List',
            ownerId: rowUserId(user),
            createdAt: Date.now(),
            sync_state: 'PENDING_INSERT',
            version: 1,
            is_deleted: false,
          }
          defaultMember = {
            id: generateUuid(),
            listId: defaultListId,
            userId: rowUserId(user) || '',
            role: 'OWNER',
            joinedAt: Date.now(),
            sync_state: 'PENDING_INSERT',
            version: 1,
            is_deleted: false,
          }
        }

        // Apply functional updates to all states using the resolved conflicts and sent IDs
        setItems(prev => {
          const merged = resolveConflicts(prev, response.remote_grocery_changes, sentItemIds)
          return sortItems(merged.map(normalizeItem))
        })

        setLists(prev => {
          const merged = resolveListConflicts(prev, response.remote_grocery_list_changes, sentListIds)
          const mapped = merged.map(normalizeList)
          if (defaultList) {
            return sortLists([...mapped, defaultList])
          }
          return sortLists(mapped)
        })

        setListMembers(prev => {
          const merged = resolveListMemberConflicts(prev, response.remote_grocery_list_member_changes, sentMemberIds)
          const mapped = merged.map(normalizeListMember)
          if (defaultMember) {
            return sortMembers([...mapped, defaultMember])
          }
          return sortMembers(mapped)
        })

        setStores(prev => {
          const merged = resolveStoreConflicts(prev, response.remote_store_changes, sentStoreIds)
          return sortStores(merged.map(normalizeStore))
        })

        setCategories(prev => {
          const merged = resolveCategoryConflicts(prev, response.remote_category_changes, sentCategoryIds)
          return sortCategories(merged.map(normalizeCategory))
        })

        setItemStoreInfos(prev => {
          const merged = resolveStoreInfoConflicts(prev, response.remote_grocery_item_store_info_changes, sentStoreInfoIds)
          return sortStoreInfos(merged.map(normalizeStoreInfo))
        })

        setLastSyncedAt(response.server_timestamp)
        storage.setItem(STORAGE_KEYS.LAST_SYNCED, response.server_timestamp)
        return response
      }
    } catch (err) {
      console.error('[Sync] Manual sync failed:', err)
    } finally {
      isSyncingRef.current = false
      if (syncNeededRef.current) {
        syncNeededRef.current = false
        setTimeout(() => {
          if (handleManualSyncRef.current) {
            handleManualSyncRef.current().catch(err => console.error('[Sync] Auto-manual sync error:', err))
          }
        }, 300)
      }
    }
    return null
  }

  // Update handleManualSyncRef. Only ever read from timers and event handlers,
  // so writing it after commit is enough.
  useEffect(() => {
    handleManualSyncRef.current = handleManualSync
  })

  // Auto-sync on mount and on online reconnect
  useEffect(() => {
    if (isLoading) return
    if (!user) return

    handleManualSync()

    const handleOnline = () => {
      console.log('[Sync] Network connection restored. Auto-syncing...')
      handleManualSync()
    }

    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('online', handleOnline)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user])

  // Debounced auto-sync trigger whenever anything is owed to the server. Keyed on the
  // count rather than on the six collections: an edit that leaves the count unchanged
  // (one row cleaned as another is dirtied) already has a sync coming, and restarting
  // the debounce for it only delays that sync.
  useEffect(() => {
    if (isLoading || !user) return

    if (pendingCount > 0) {
      const timer = setTimeout(() => {
        if (handleManualSyncRef.current) {
          handleManualSyncRef.current().catch(err => console.error('[Sync] Auto-sync error:', err))
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [pendingCount, isLoading, user])

  // Stamp the account's row identity onto local list and membership rows: onto the ones
  // that have none yet, and onto the ones still carrying the pre-re-key Google subject.
  //
  // The subject is no longer what these rows are keyed by -- the server keys them by the
  // surrogate -- and it does not translate one into the other, on purpose. A membership
  // insert whose `user_id` is the subject is answered 403, and that refusal fails the
  // whole sync batch, not just the one row; a list update carrying `owner_id` as the
  // subject is worse, because the server takes that field verbatim and the account then
  // owns none of its own lists. So a local row still on the subject is a row to rewrite,
  // and the surrogate arriving from the server is the signal to do it.
  //
  // Rewriting in place deliberately leaves `sync_state` alone: the server re-keyed its
  // own rows in the migration, so this is correcting a stale mirror, not making a change
  // to push. A row that was already dirty stays dirty and now carries the right id.
  useEffect(() => {
    const rowId = rowUserId(user)
    if (!rowId) return
    const legacyId = legacyRowUserId(user)

    const needsRestamp = (id: string | undefined) =>
      !id || id === '' || (legacyId !== undefined && id === legacyId)

    setLists(curr => {
      let changed = false
      const updated = curr.map(list => {
        if (needsRestamp(list.ownerId) && !list.is_deleted) {
          changed = true
          return { ...list, ownerId: rowId }
        }
        return list
      })
      return changed ? updated : curr
    })

    setListMembers(curr => {
      let changed = false
      const listIds = new Set(lists.map(l => l.id))
      const updated = curr.filter(member => {
        if (!member.listId || !listIds.has(member.listId)) {
          changed = true
          return false
        }
        return true
      }).map(member => {
        // Only this account's own rows: a co-member's `userId` is their surrogate and
        // never matches either of ours.
        if (needsRestamp(member.userId) && !member.is_deleted) {
          changed = true
          return { ...member, userId: rowId }
        }
        return member
      })
      return changed ? updated : curr
    })
  }, [user, lists, setLists, setListMembers])

  // Derive sync status
  // Order matters, and it is the order of what the user most needs to know: what is
  // happening right now, then why their edits have not left the device, then whether
  // what they are reading is old.
  const syncStatus: SyncStatus = isSyncing
    ? 'syncing'
    : pendingCount > 0
      ? (isOnline ? 'pending' : 'offline')
      : isOnline
        ? (isStale ? 'stale' : 'synced')
        : 'offline'

  // Resolve list defaults on mount / state adjustments
  const activeList = lists.find(l => l.id === activeListId && !l.is_deleted) || lists.find(l => !l.is_deleted) || lists[0]
  useEffect(() => {
    if (activeList && activeList.id !== activeListId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveListId(activeList.id)
    }
  }, [activeList, activeListId])

  return (
    <GroceryContext.Provider value={{
      activeListId,
      setActiveListId,
      items,
      setItems,
      lists,
      setLists,
      listMembers,
      setListMembers,
      stores,
      setStores,
      categories,
      setCategories,
      itemStoreInfos,
      setItemStoreInfos,
      syncStatus,
      isSyncing,
      isOnline,
      pendingCount,
      lastSyncedAt,
      handleManualSync
    }}>
      {children}
    </GroceryContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGrocery() {
  const context = useContext(GroceryContext)
  if (context === undefined) {
    throw new Error('useGrocery must be used within a GroceryProvider')
  }
  return context
}
