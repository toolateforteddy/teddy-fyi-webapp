import React, { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useGrocerySync } from '@/features/sync/hooks/useGrocerySync'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import { generateUuid } from '@/utils/uuid'
import type { GroceryItem, GroceryList, GroceryListMember, Store, Category, GroceryItemStoreInfo } from '@/types/grocery'

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
    return raw.map(item => {
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
  })

  // Hydrate lists state
  const [lists, setLists] = useState<GroceryList[]>(() => {
    const raw = storage.getItem<GroceryList[]>(STORAGE_KEYS.LISTS, [])
    return raw.map(list => {
      const remoteRaw = list as any
      return {
        ...list,
        ownerId: remoteRaw.ownerId || remoteRaw.owner_id,
        createdAt: remoteRaw.createdAt || remoteRaw.created_at,
      }
    })
  })

  // Hydrate members state
  const [listMembers, setListMembers] = useState<GroceryListMember[]>(() => {
    const raw = storage.getItem<GroceryListMember[]>(STORAGE_KEYS.LIST_MEMBERS, [])
    return raw.map(member => {
      const remoteRaw = member as any
      return {
        ...member,
        listId: remoteRaw.listId || remoteRaw.list_id || '',
        userId: remoteRaw.userId || remoteRaw.user_id || '',
        joinedAt: remoteRaw.joinedAt || remoteRaw.joined_at,
      }
    })
  })

  // Hydrate stores state
  const [stores, setStores] = useState<Store[]>(() => {
    const raw = storage.getItem<Store[]>(STORAGE_KEYS.STORES, [])
    return raw.map(store => {
      const remoteRaw = store as any
      return {
        ...store,
        listId: remoteRaw.listId || remoteRaw.list_id || '',
        isDefaultSupported: remoteRaw.isDefaultSupported !== undefined ? remoteRaw.isDefaultSupported : remoteRaw.is_default_supported,
        userId: remoteRaw.userId || remoteRaw.user_id,
      }
    })
  })

  // Hydrate categories state
  const [categories, setCategories] = useState<Category[]>(() => {
    const raw = storage.getItem<Category[]>(STORAGE_KEYS.CATEGORIES, [])
    return raw.map(cat => {
      const remoteRaw = cat as any
      return {
        ...cat,
        listId: remoteRaw.listId || remoteRaw.list_id || '',
        userId: remoteRaw.userId || remoteRaw.user_id,
      }
    })
  })

  // Hydrate item store mappings state
  const [itemStoreInfos, setItemStoreInfos] = useState<GroceryItemStoreInfo[]>(() => {
    const raw = storage.getItem<GroceryItemStoreInfo[]>(STORAGE_KEYS.ITEM_STORE_INFOS, [])
    return raw.map(info => {
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
  })

  // Sync state variables to storage on change
  useEffect(() => {
    storage.setItem(STORAGE_KEYS.ITEMS, items)
  }, [items])

  useEffect(() => {
    storage.setItem(STORAGE_KEYS.LISTS, lists)
  }, [lists])

  useEffect(() => {
    storage.setItem(STORAGE_KEYS.LIST_MEMBERS, listMembers)
  }, [listMembers])

  useEffect(() => {
    storage.setItem(STORAGE_KEYS.STORES, stores)
  }, [stores])

  useEffect(() => {
    storage.setItem(STORAGE_KEYS.CATEGORIES, categories)
  }, [categories])

  useEffect(() => {
    storage.setItem(STORAGE_KEYS.ITEM_STORE_INFOS, itemStoreInfos)
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

  // Triggers manual sync using the real syncNow hook
  const handleManualSync = async () => {
    if (isSyncing) return null
    if (!user) return null
    
    try {
      const response = await syncNow(items, lists, stores, categories, itemStoreInfos, listMembers)
      if (response) {
        const mergedItems = resolveConflicts(items, response.remote_grocery_changes)
        setItems(mergedItems.map(item => {
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

        const mergedLists = resolveListConflicts(lists, response.remote_grocery_list_changes)
        const mappedLists: GroceryList[] = mergedLists.map(list => {
          const remoteRaw = list as any
          return {
            ...list,
            ownerId: remoteRaw.ownerId || remoteRaw.owner_id,
            createdAt: remoteRaw.createdAt || remoteRaw.created_at,
          }
        })

        const mergedMembers = resolveListMemberConflicts(listMembers, response.remote_grocery_list_member_changes)
        const mappedMembers: GroceryListMember[] = mergedMembers.map(member => {
          const remoteRaw = member as any
          return {
            ...member,
            listId: remoteRaw.listId || remoteRaw.list_id || '',
            userId: remoteRaw.userId || remoteRaw.user_id || '',
            joinedAt: remoteRaw.joinedAt || remoteRaw.joined_at,
          }
        })

        const activeLists = mappedLists.filter(l => !l.is_deleted)
        let finalLists: GroceryList[] = mappedLists
        let finalMembers: GroceryListMember[] = mappedMembers

        if (activeLists.length === 0) {
          const defaultListId = generateUuid()
          const defaultList: GroceryList = {
            id: defaultListId,
            name: 'My List',
            ownerId: user?.id,
            createdAt: Date.now(),
            sync_state: 'PENDING_INSERT',
            version: 1,
            is_deleted: false,
          }
          const defaultMember: GroceryListMember = {
            id: generateUuid(),
            listId: defaultListId,
            userId: user?.id || '',
            role: 'OWNER',
            joinedAt: Date.now(),
            sync_state: 'PENDING_INSERT',
            version: 1,
            is_deleted: false,
          }
          finalLists = [...mappedLists, defaultList]
          finalMembers = [...mappedMembers, defaultMember]
        }

        setLists(finalLists)
        setListMembers(finalMembers)

        const mergedStores = resolveStoreConflicts(stores, response.remote_store_changes)
        setStores(mergedStores.map(store => {
          const remoteRaw = store as any
          return {
            ...store,
            listId: remoteRaw.listId || remoteRaw.list_id || '',
            isDefaultSupported: remoteRaw.isDefaultSupported !== undefined ? remoteRaw.isDefaultSupported : remoteRaw.is_default_supported,
            userId: remoteRaw.userId || remoteRaw.user_id,
          }
        }))

        const mergedCategories = resolveCategoryConflicts(categories, response.remote_category_changes)
        setCategories(mergedCategories.map(cat => {
          const remoteRaw = cat as any
          return {
            ...cat,
            listId: remoteRaw.listId || remoteRaw.list_id || '',
            userId: remoteRaw.userId || remoteRaw.user_id,
          }
        }))

        const mergedStoreInfos = resolveStoreInfoConflicts(itemStoreInfos, response.remote_grocery_item_store_info_changes)
        setItemStoreInfos(mergedStoreInfos.map(info => {
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

        setLastSyncedAt(response.server_timestamp)
        storage.setItem(STORAGE_KEYS.LAST_SYNCED, response.server_timestamp)
        return response
      }
    } catch (err) {
      console.error('[Sync] Manual sync failed:', err)
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
