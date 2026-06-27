import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { 
  ShoppingBag, 
  Calendar, 
  CheckSquare, 
  Settings as SettingsIcon, 
  RefreshCw, 
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useGrocerySync } from '@/features/sync/hooks/useGrocerySync'
import type { GroceryItem, GroceryList, GroceryListMember, Store, Category, GroceryItemStoreInfo } from '@/types/grocery'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import { getSyncedTimeString } from '@/utils/date'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { generateUuid } from '@/utils/uuid'

export function DashboardLayout() {
  const location = useLocation()
  const currentPath = location.pathname

  const { user } = useAuth()

  // Unified items state loaded from storage (defaults to empty)
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

  // Unified lists state loaded from storage (defaults to empty)
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
    const active = mapped.filter(l => !l.is_deleted)
    if (active.length > 0) {
      return mapped
    }

    // Only create default list if we have had at least one successful sync
    const lastSynced = storage.getItem<string>(STORAGE_KEYS.LAST_SYNCED, '')
    if (!lastSynced) {
      return []
    }

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

    storage.setItem(STORAGE_KEYS.LIST_MEMBERS, [defaultMember])
    return [defaultList]
  })

  // Unified list members state loaded from storage (defaults to empty)
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

  // Unified stores state loaded from storage (defaults to empty)
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

  // Unified categories state loaded from storage (defaults to empty)
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

  // Unified item store mappings state loaded from storage (defaults to empty)
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

  // Persist items locally
  useEffect(() => {
    storage.setItem(STORAGE_KEYS.ITEMS, items)
  }, [items])

  // Persist lists locally
  useEffect(() => {
    storage.setItem(STORAGE_KEYS.LISTS, lists)
  }, [lists])

  // Persist list members locally
  useEffect(() => {
    storage.setItem(STORAGE_KEYS.LIST_MEMBERS, listMembers)
  }, [listMembers])

  // Persist stores locally
  useEffect(() => {
    storage.setItem(STORAGE_KEYS.STORES, stores)
  }, [stores])

  // Persist categories locally
  useEffect(() => {
    storage.setItem(STORAGE_KEYS.CATEGORIES, categories)
  }, [categories])

  // Persist item store mappings locally
  useEffect(() => {
    storage.setItem(STORAGE_KEYS.ITEM_STORE_INFOS, itemStoreInfos)
  }, [itemStoreInfos])

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

  const [activeListId, setActiveListId] = useState<string>(() => {
    return storage.getItem<string>(STORAGE_KEYS.ACTIVE_LIST_ID, '') || ''
  })

  // Persist activeListId
  useEffect(() => {
    storage.setItem(STORAGE_KEYS.ACTIVE_LIST_ID, activeListId)
  }, [activeListId])
  
  // Sync state tracking (stored as ISO 8601 string)
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => {
    const saved = storage.getItem<string>(STORAGE_KEYS.LAST_SYNCED, '')
    return saved || new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // default to 25h ago (stale)
  })
  const [showSyncTooltip, setShowSyncTooltip] = useState(false)

  const activeList = lists.find(l => l.id === activeListId && !l.is_deleted) || lists.find(l => !l.is_deleted) || lists[0]

  useEffect(() => {
    if (activeList && activeList.id !== activeListId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveListId(activeList.id)
    }
  }, [activeList, activeListId])

  // Derive syncStatus dynamically to avoid state synchronization side effects
  const isStale = (() => {
    const lastSyncedMs = Date.parse(lastSyncedAt)
    if (isNaN(lastSyncedMs)) return true
    // eslint-disable-next-line react-hooks/purity
    const diffHours = (Date.now() - lastSyncedMs) / (1000 * 60 * 60)
    return diffHours > 24
  })()

  const syncStatus: 'syncing' | 'stale' | 'synced' = isSyncing
    ? 'syncing'
    : isStale
      ? 'stale'
      : 'synced'

  // Helper to initialize a default list offline/on sync failure
  const initializeDefaultList = () => {
    setLists(curr => {
      if (curr.filter(l => !l.is_deleted).length === 0) {
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
        setListMembers(prev => {
          const updated = [...prev, defaultMember]
          storage.setItem(STORAGE_KEYS.LIST_MEMBERS, updated)
          return updated
        })
        return [...curr, defaultList]
      }
      return curr
    })
  }

  // Triggers manual sync using the real syncNow hook
  const handleManualSync = async () => {
    if (isSyncing) return null
    
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
      } else {
        initializeDefaultList()
      }
    } catch (err) {
      console.error('[Sync] Manual sync failed:', err)
      initializeDefaultList()
    }
    return null
  }

  // Trigger initial sync on mount to pull server data
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleManualSync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!activeList) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center font-sans antialiased">
        <div className="w-full max-w-md min-h-screen bg-black flex flex-col items-center justify-center border-x border-[#1a1a1a] shadow-[0_0_50px_0_rgba(208,188,255,0.05)] space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs text-text-muted font-medium tracking-wide animate-pulse">
            Initializing your lists...
          </span>
        </div>
      </div>
    )
  }



  const navItems = [
    {
      path: '/grocery',
      label: 'Need',
      icon: ShoppingBag,
    },
    {
      path: '/grocery/planning',
      label: 'Planning',
      icon: Calendar,
    },
    {
      path: '/grocery/shopping',
      label: 'Shopping',
      icon: CheckSquare,
    },
    {
      path: '/grocery/settings',
      label: 'Settings',
      icon: SettingsIcon,
    },
  ]

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between items-center font-sans antialiased selection:bg-primary selection:text-black">
      {/* Mobile container wrapper (App Frame) */}
      <div className="w-full max-w-md min-h-screen bg-black flex flex-col relative border-x border-[#1a1a1a] shadow-[0_0_50px_0_rgba(208,188,255,0.05)] pb-[72px]">
        
        {/* Top App Bar */}
        <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-[#1a1a1a] h-14 flex items-center justify-between px-4">
          {/* Logo / Branding */}
          <div className="flex items-center gap-2 select-none">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
              G
            </div>
            <span className="text-sm font-bold tracking-wider text-white">grocery.fyi</span>
          </div>

          {/* Title & Sync Feedback */}
          <div className="flex items-center gap-3">
            {/* Sync Status Button */}
            <div className="relative">
              <button
                onClick={handleManualSync}
                onMouseEnter={() => setShowSyncTooltip(true)}
                onMouseLeave={() => setShowSyncTooltip(false)}
                onClickCapture={() => setShowSyncTooltip(!showSyncTooltip)}
                className="p-2 rounded-lg bg-surface-tile border border-neutral-800 active:scale-95 hover:border-neutral-700 transition-all cursor-pointer relative"
                aria-label="Sync status"
              >
                <RefreshCw className={cn(
                  "w-4 h-4 transition-all duration-700",
                  syncStatus === 'syncing' && "animate-spin text-primary",
                  syncStatus === 'synced' && "text-emerald-500",
                  syncStatus === 'stale' && "text-yellow-500 animate-pulse"
                )} />
                {syncStatus === 'stale' && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-yellow-500" />
                )}
              </button>

              {showSyncTooltip && (
                <div className="absolute right-0 mt-2 w-48 bg-surface-tile border border-neutral-800 p-2.5 rounded-lg shadow-lg z-50 text-xs text-text-muted animate-in fade-in duration-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    {syncStatus === 'synced' && (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="font-semibold text-emerald-500">Synced</span>
                      </>
                    )}
                    {syncStatus === 'stale' && (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
                        <span className="font-semibold text-yellow-500">Stale state</span>
                      </>
                    )}
                    {syncStatus === 'syncing' && (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin" />
                        <span className="font-semibold text-primary">Syncing...</span>
                      </>
                    )}
                  </div>
                  <p>Last synced: {getSyncedTimeString(lastSyncedAt)}</p>
                  <p className="mt-1 text-[10px] text-neutral-500">Tap icon to force upload/download changes.</p>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Primary Page Outlet */}
        <main className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth">
          <Outlet context={{ activeListId: activeList.id, setActiveListId, handleManualSync, syncStatus, items, setItems, lists, setLists, stores, setStores, categories, setCategories, itemStoreInfos, setItemStoreInfos }} />
        </main>

        {/* Bottom Navigation Bar */}
        <nav className="fixed bottom-0 w-full max-w-md bg-black/90 backdrop-blur-lg border-t border-[#1a1a1a] h-[68px] flex items-center justify-around px-2 z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
          {navItems.map((item) => {
            const Icon = item.icon
            // Check if active (match exact path or subpaths for nested routes)
            const isActive = currentPath === item.path

            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all cursor-pointer group active:scale-95"
              >
                <div className={cn(
                  "p-1.5 rounded-full transition-all group-hover:bg-neutral-900",
                  isActive ? "bg-primary/10 text-primary scale-110" : "text-text-muted"
                )}>
                  <Icon className="w-5 h-5 transition-transform" />
                </div>
                <span className={cn(
                  "text-[10px] font-medium tracking-wide mt-1 transition-colors",
                  isActive ? "text-primary font-semibold" : "text-text-muted group-hover:text-neutral-300"
                )}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

      </div>
    </div>
  )
}
