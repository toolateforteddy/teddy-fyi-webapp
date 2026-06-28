import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useGrocerySync } from '@/features/sync/hooks/useGrocerySync'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import { generateUuid } from '@/utils/uuid'
import type { GroceryItem, GroceryList, GroceryListMember, Store, Category, GroceryItemStoreInfo } from '@/types/grocery'

// Helper functions for sane sorting in local storage and memory
export function sortItems(arr: GroceryItem[]): GroceryItem[] {
  return [...arr].sort((a, b) => {
    const aDel = a.is_deleted ? 1 : 0
    const bDel = b.is_deleted ? 1 : 0
    if (aDel !== bDel) return aDel - bDel

    const aActive = a.isActive ? 1 : 0
    const bActive = b.isActive ? 1 : 0
    if (aActive !== bActive) return bActive - aActive // Active (true / 1) comes before Inactive (false / 0)

    return (a.createdAt || 0) - (b.createdAt || 0)
  })
}

export function sortLists(arr: GroceryList[]): GroceryList[] {
  return [...arr].sort((a, b) => {
    const aDel = a.is_deleted ? 1 : 0
    const bDel = b.is_deleted ? 1 : 0
    if (aDel !== bDel) return aDel - bDel

    return (a.createdAt || 0) - (b.createdAt || 0)
  })
}

export function sortMembers(arr: GroceryListMember[]): GroceryListMember[] {
  return [...arr].sort((a, b) => {
    const aDel = a.is_deleted ? 1 : 0
    const bDel = b.is_deleted ? 1 : 0
    if (aDel !== bDel) return aDel - bDel

    return (a.joinedAt || 0) - (b.joinedAt || 0)
  })
}

export function sortStores(arr: Store[]): Store[] {
  return [...arr].sort((a, b) => {
    const aDel = a.is_deleted ? 1 : 0
    const bDel = b.is_deleted ? 1 : 0
    if (aDel !== bDel) return aDel - bDel

    return (a.position || 0) - (b.position || 0)
  })
}

export function sortCategories(arr: Category[]): Category[] {
  return [...arr].sort((a, b) => {
    const aDel = a.is_deleted ? 1 : 0
    const bDel = b.is_deleted ? 1 : 0
    if (aDel !== bDel) return aDel - bDel

    return (a.position || 0) - (b.position || 0)
  })
}

export function sortStoreInfos(arr: GroceryItemStoreInfo[]): GroceryItemStoreInfo[] {
  return [...arr].sort((a, b) => {
    const aDel = a.is_deleted ? 1 : 0
    const bDel = b.is_deleted ? 1 : 0
    return aDel - bDel
  })
}

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

export function GroceryProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  // Hydrate items state
  const [items, setItems] = useState<GroceryItem[]>(() => {
    const raw = storage.getItem<GroceryItem[]>(STORAGE_KEYS.ITEMS, [])
    const mapped = raw.map(item => {
      const remoteRaw = item as any
      return {
        ...item,
        listId: remoteRaw.listId || remoteRaw.list_id || '',
        categoryId: remoteRaw.categoryId || remoteRaw.category_id,
        createdAt: remoteRaw.createdAt || remoteRaw.created_at,
        isActive: remoteRaw.isActive !== undefined ? remoteRaw.isActive : remoteRaw.is_active,
        isBought: remoteRaw.isBought !== undefined ? remoteRaw.isBought : remoteRaw.is_bought,
        timesBought: remoteRaw.timesBought !== undefined ? remoteRaw.timesBought : remoteRaw.times_bought,
        userId: remoteRaw.userId || remoteRaw.user_id,
      }
    })
    return sortItems(mapped)
  })

  // Hydrate lists state
  const [lists, setLists] = useState<GroceryList[]>(() => {
    const raw = storage.getItem<GroceryList[]>(STORAGE_KEYS.LISTS, [])
    const mapped = raw.map(list => {
      const remoteRaw = list as any
      return {
        ...list,
        ownerId: remoteRaw.ownerId || remoteRaw.owner_id,
        createdAt: remoteRaw.createdAt || remoteRaw.created_at,
      }
    })
    return sortLists(mapped)
  })

  // Hydrate members state
  const [listMembers, setListMembers] = useState<GroceryListMember[]>(() => {
    const raw = storage.getItem<GroceryListMember[]>(STORAGE_KEYS.LIST_MEMBERS, [])
    const mapped = raw.map(member => {
      const remoteRaw = member as any
      return {
        ...member,
        listId: remoteRaw.listId || remoteRaw.list_id || '',
        userId: remoteRaw.userId || remoteRaw.user_id || '',
        joinedAt: remoteRaw.joinedAt || remoteRaw.joined_at,
      }
    })
    return sortMembers(mapped)
  })

  // Hydrate stores state
  const [stores, setStores] = useState<Store[]>(() => {
    const raw = storage.getItem<Store[]>(STORAGE_KEYS.STORES, [])
    const mapped = raw.map(store => {
      const remoteRaw = store as any
      return {
        ...store,
        listId: remoteRaw.listId || remoteRaw.list_id || '',
        isDefaultSupported: remoteRaw.isDefaultSupported !== undefined ? remoteRaw.isDefaultSupported : remoteRaw.is_default_supported,
        userId: remoteRaw.userId || remoteRaw.user_id,
      }
    })
    return sortStores(mapped)
  })

  // Hydrate categories state
  const [categories, setCategories] = useState<Category[]>(() => {
    const raw = storage.getItem<Category[]>(STORAGE_KEYS.CATEGORIES, [])
    const mapped = raw.map(cat => {
      const remoteRaw = cat as any
      return {
        ...cat,
        listId: remoteRaw.listId || remoteRaw.list_id || '',
        userId: remoteRaw.userId || remoteRaw.user_id,
      }
    })
    return sortCategories(mapped)
  })

  // Hydrate item store mappings state
  const [itemStoreInfos, setItemStoreInfos] = useState<GroceryItemStoreInfo[]>(() => {
    const raw = storage.getItem<GroceryItemStoreInfo[]>(STORAGE_KEYS.ITEM_STORE_INFOS, [])
    const mapped = raw.map(info => {
      const remoteRaw = info as any
      return {
        ...info,
        listId: remoteRaw.listId || remoteRaw.list_id || '',
        groceryItemId: remoteRaw.groceryItemId || remoteRaw.grocery_item_id,
        storeId: remoteRaw.storeId || remoteRaw.store_id,
        isAvailable: remoteRaw.isAvailable !== undefined ? remoteRaw.isAvailable : remoteRaw.is_available,
        userId: remoteRaw.userId || remoteRaw.user_id,
      }
    })
    return sortStoreInfos(mapped)
  })

  // Sync state variables to storage on change
  useEffect(() => {
    storage.setItem(STORAGE_KEYS.ITEMS, sortItems(items))
  }, [items])

  useEffect(() => {
    storage.setItem(STORAGE_KEYS.LISTS, sortLists(lists))
  }, [lists])

  useEffect(() => {
    storage.setItem(STORAGE_KEYS.LIST_MEMBERS, sortMembers(listMembers))
  }, [listMembers])

  useEffect(() => {
    storage.setItem(STORAGE_KEYS.STORES, sortStores(stores))
  }, [stores])

  useEffect(() => {
    storage.setItem(STORAGE_KEYS.CATEGORIES, sortCategories(categories))
  }, [categories])

  useEffect(() => {
    storage.setItem(STORAGE_KEYS.ITEM_STORE_INFOS, sortStoreInfos(itemStoreInfos))
  }, [itemStoreInfos])

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
          return sortItems(merged.map(item => {
            const remoteRaw = item as any
            return {
              ...item,
              listId: remoteRaw.listId || remoteRaw.list_id || '',
              categoryId: remoteRaw.categoryId || remoteRaw.category_id,
              createdAt: remoteRaw.createdAt || remoteRaw.created_at,
              isActive: remoteRaw.isActive !== undefined ? remoteRaw.isActive : remoteRaw.is_active,
              isBought: remoteRaw.isBought !== undefined ? remoteRaw.isBought : remoteRaw.is_bought,
              timesBought: remoteRaw.timesBought !== undefined ? remoteRaw.timesBought : remoteRaw.times_bought,
              userId: remoteRaw.userId || remoteRaw.user_id,
            }
          }))
        })

        setLists(prev => {
          const merged = resolveListConflicts(prev, response.remote_grocery_list_changes, sentListIds)
          const mapped = merged.map(list => {
            const remoteRaw = list as any
            return {
              ...list,
              ownerId: remoteRaw.ownerId || remoteRaw.owner_id,
              createdAt: remoteRaw.createdAt || remoteRaw.created_at,
            }
          })
          if (defaultList) {
            return sortLists([...mapped, defaultList])
          }
          return sortLists(mapped)
        })

        setListMembers(prev => {
          const merged = resolveListMemberConflicts(prev, response.remote_grocery_list_member_changes, sentMemberIds)
          const mapped = merged.map(member => {
            const remoteRaw = member as any
            return {
              ...member,
              listId: remoteRaw.listId || remoteRaw.list_id || '',
              userId: remoteRaw.userId || remoteRaw.user_id || '',
              joinedAt: remoteRaw.joinedAt || remoteRaw.joined_at,
            }
          })
          if (defaultMember) {
            return sortMembers([...mapped, defaultMember])
          }
          return sortMembers(mapped)
        })

        setStores(prev => {
          const merged = resolveStoreConflicts(prev, response.remote_store_changes, sentStoreIds)
          return sortStores(merged.map(store => {
            const remoteRaw = store as any
            return {
              ...store,
              listId: remoteRaw.listId || remoteRaw.list_id || '',
              isDefaultSupported: remoteRaw.isDefaultSupported !== undefined ? remoteRaw.isDefaultSupported : remoteRaw.is_default_supported,
              userId: remoteRaw.userId || remoteRaw.user_id,
            }
          }))
        })

        setCategories(prev => {
          const merged = resolveCategoryConflicts(prev, response.remote_category_changes, sentCategoryIds)
          return sortCategories(merged.map(cat => {
            const remoteRaw = cat as any
            return {
              ...cat,
              listId: remoteRaw.listId || remoteRaw.list_id || '',
              userId: remoteRaw.userId || remoteRaw.user_id,
            }
          }))
        })

        setItemStoreInfos(prev => {
          const merged = resolveStoreInfoConflicts(prev, response.remote_grocery_item_store_info_changes, sentStoreInfoIds)
          return sortStoreInfos(merged.map(info => {
            const remoteRaw = info as any
            return {
              ...info,
              listId: remoteRaw.listId || remoteRaw.list_id || '',
              groceryItemId: remoteRaw.groceryItemId || remoteRaw.grocery_item_id,
              storeId: remoteRaw.storeId || remoteRaw.store_id,
              isAvailable: remoteRaw.isAvailable !== undefined ? remoteRaw.isAvailable : remoteRaw.is_available,
              userId: remoteRaw.userId || remoteRaw.user_id,
            }
          }))
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
  }, [user, lists])

  // Derive sync status
  const isStale = (() => {
    const lastSyncedMs = Date.parse(lastSyncedAt)
    if (isNaN(lastSyncedMs)) return true
    const diffHours = (Date.now() - lastSyncedMs) / (1000 * 60 * 60)
    return diffHours > 24
  })()

  const syncStatus: 'syncing' | 'stale' | 'synced' = isSyncing
    ? 'syncing'
    : isStale
      ? 'stale'
      : 'synced'

  // Resolve list defaults on mount / state adjustments
  const activeList = lists.find(l => l.id === activeListId && !l.is_deleted) || lists.find(l => !l.is_deleted) || lists[0]
  useEffect(() => {
    if (activeList && activeList.id !== activeListId) {
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

export function useGrocery() {
  const context = useContext(GroceryContext)
  if (context === undefined) {
    throw new Error('useGrocery must be used within a GroceryProvider')
  }
  return context
}
