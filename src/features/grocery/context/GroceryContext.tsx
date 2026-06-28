import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useGrocerySync } from '@/features/sync/hooks/useGrocerySync'
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
  syncStatus: 'syncing' | 'stale' | 'synced'
  isSyncing: boolean
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

  useEffect(() => {
    storage.setItem(key, sorter(state))
  }, [key, state, sorter])

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

  // Active list ID management
  const [activeListId, setActiveListId] = useState<string>(() => {
    return storage.getItem<string>(STORAGE_KEYS.ACTIVE_LIST_ID, '') || ''
  })

  useEffect(() => {
    storage.setItem(STORAGE_KEYS.ACTIVE_LIST_ID, activeListId)
  }, [activeListId])

  // Sync state tracking
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => {
    const saved = storage.getItem<string>(STORAGE_KEYS.LAST_SYNCED, '')
    return saved || new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
  })

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

  // Triggers manual sync using the real syncNow hook
  const handleManualSync = async (): Promise<any> => {
    if (isSyncingRef.current) {
      syncNeededRef.current = true
      return null
    }
    if (!user) return null

    isSyncingRef.current = true

    // Capture snapshots of the current state at the exact time sync starts
    const currentItems = items
    const currentLists = lists
    const currentStores = stores
    const currentCategories = categories
    const currentItemStoreInfos = itemStoreInfos
    const currentListMembers = listMembers

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
            ownerId: user?.id,
            createdAt: Date.now(),
            sync_state: 'PENDING_INSERT',
            version: 1,
            is_deleted: false,
          }
          defaultMember = {
            id: generateUuid(),
            listId: defaultListId,
            userId: user?.id || '',
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
          handleManualSync().catch(err => console.error('[Sync] Auto-manual sync error:', err))
        }, 300)
      }
    }
    return null
  }

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

  // Update local list owner and member user IDs once auth boots/changes
  useEffect(() => {
    if (user?.id) {
      setLists(curr => {
        let changed = false
        const updated = curr.map(list => {
          if (!list.ownerId && !list.is_deleted) {
            changed = true
            return { ...list, ownerId: user.id }
          }
          return list
        })
        return changed ? updated : curr
      })

      setListMembers(curr => {
        let changed = false
        const listIds = new Set(lists.map(l => l.id))
        const updated = curr.filter(member => {
          if (!listIds.has(member.listId)) {
            changed = true
            return false
          }
          return true
        }).map(member => {
          if ((!member.userId || member.userId === '') && !member.is_deleted) {
            changed = true
            return { ...member, userId: user.id }
          }
          return member
        })
        return changed ? updated : curr
      })
    }
  }, [user, lists, setLists, setListMembers])

  // Derive sync status
  const syncStatus: 'syncing' | 'stale' | 'synced' = isSyncing
    ? 'syncing'
    : isStale
      ? 'stale'
      : 'synced'

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
