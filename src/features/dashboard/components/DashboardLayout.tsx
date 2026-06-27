import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { 
  ShoppingBag, 
  Calendar, 
  CheckSquare, 
  Settings as SettingsIcon, 
  RefreshCw, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  Pencil,
  Share2,
  Plus,
  X,
  Copy,
  Check
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useGrocerySync } from '@/features/sync/hooks/useGrocerySync'
import type { GroceryItem, GroceryList, GroceryListMember, Store, Category, GroceryItemStoreInfo } from '@/types/grocery'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import { getSyncedTimeString } from '@/utils/date'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { generateUuid } from '@/utils/uuid'
import api from '@/lib/axios'

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

  // List Edit Mode State
  const [isEditMode, setIsEditMode] = useState(false)

  // State for Share List
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [isGeneratingCode, setIsGeneratingCode] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // State for Join List
  const [isJoinOpen, setIsJoinOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [isSyncingPostJoin, setIsSyncingPostJoin] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  // Handle Share List API Call
  const handleShareList = async () => {
    setIsShareOpen(true)
    setIsGeneratingCode(true)
    setShareError(null)
    setInviteCode(null)

    try {
      const response = await api.post<{ code: string }>('/api/lists/invite', {
        list_id: activeListId
      })
      setInviteCode(response.data.code)
    } catch (err: any) {
      console.error('Failed to generate invite code:', err)
      setShareError(err.response?.data?.message || 'Failed to generate invite code. Please try again.')
    } finally {
      setIsGeneratingCode(false)
    }
  }

  const handleCopyCode = () => {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Handle Join List API Call
  const handleJoinList = async (e: FormEvent) => {
    e.preventDefault()
    if (!joinCode || joinCode.trim().length !== 8) {
      setJoinError('Please enter a valid 8-character invite code.')
      return
    }

    setIsJoining(true)
    setJoinError(null)

    try {
      const response = await api.post<{ success: boolean; list_id: string }>('/api/lists/join', {
        code: joinCode.trim().toUpperCase()
      })

      if (response.data.success && response.data.list_id) {
        const newListId = response.data.list_id
        
        // Success: Clear last_synced_at to trigger full resync
        setIsSyncingPostJoin(true)
        storage.removeItem(STORAGE_KEYS.LAST_SYNCED)
        
        // Trigger manual sync to fetch the new list and items
        await handleManualSync()
        
        // Set the newly joined list as active
        setActiveListId(newListId)
        
        // Reset states and close
        setIsJoinOpen(false)
        setJoinCode('')
      } else {
        setJoinError('Failed to join list. The code may be invalid or expired.')
      }
    } catch (err: any) {
      console.error('Failed to join list:', err)
      setJoinError(err.response?.data?.message || 'Failed to join list. Please check the code and try again.')
    } finally {
      setIsJoining(false)
      setIsSyncingPostJoin(false)
    }
  }

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
            <span className="text-sm font-bold tracking-wider text-white">
              Grocery: {activeList.name}
            </span>
          </div>

          {/* Actions & Sync Feedback */}
          <div className="flex items-center gap-2">
            {/* Edit List Selector Button */}
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={cn(
                "p-2 rounded-lg border transition-all duration-200 cursor-pointer active:scale-95",
                isEditMode
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-surface-tile border-neutral-800 hover:border-neutral-700 text-text-muted hover:text-white"
              )}
              aria-label="Manage lists"
              title="Manage lists"
            >
              <Pencil className="w-4 h-4" />
            </button>

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

        {/* List Selector / Management Panel (Edit Mode) */}
        {isEditMode && (
          <div className="bg-surface-tile border-b border-[#1a1a1a] px-4 py-3.5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <ShoppingBag className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-bold text-text-muted uppercase tracking-wider truncate">Active List</span>
              </div>
              <div className="relative shrink-0">
                <select
                  value={activeListId}
                  onChange={(e) => setActiveListId(e.target.value)}
                  className="bg-black border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary text-white cursor-pointer active:scale-95 transition-all w-[180px]"
                >
                  {lists.filter(l => !l.is_deleted).map(list => (
                    <option key={list.id} value={list.id} className="bg-surface-tile text-white">
                      {list.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleShareList}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-black/40 border border-neutral-800 hover:border-neutral-700 hover:text-white rounded-lg text-xs text-text-muted active:scale-95 transition-all cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-primary" />
                <span>Invite Code</span>
              </button>
              <button
                onClick={() => {
                  setIsJoinOpen(true)
                  setJoinCode('')
                  setJoinError(null)
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-black/40 border border-neutral-800 hover:border-neutral-700 hover:text-white rounded-lg text-xs text-text-muted active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span>Join List</span>
              </button>
            </div>
          </div>
        )}

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

      {/* Share / Invite Code Bottom Sheet */}
      {isShareOpen && (
        <>
          <div 
            onClick={() => setIsShareOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
          />
          <div className="fixed bottom-0 left-0 right-0 md:left-auto md:right-auto md:w-full md:max-w-md bg-surface-tile border-t border-neutral-800 rounded-t-2xl z-50 px-4 pt-4 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-250 ease-out">
            <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-white">Share List</h3>
              </div>
              <button 
                onClick={() => setIsShareOpen(false)}
                className="p-1 text-text-muted hover:text-white rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 py-2">
              {isGeneratingCode ? (
                <div className="flex flex-col items-center justify-center py-6 gap-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-sm text-text-muted">Generating invite code...</p>
                </div>
              ) : shareError ? (
                <div className="space-y-3 text-center">
                  <p className="text-sm text-red-400">{shareError}</p>
                  <button
                    onClick={handleShareList}
                    className="py-2 px-4 bg-primary text-black font-semibold rounded-lg text-xs active:scale-95 transition-all cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : inviteCode ? (
                <div className="space-y-4">
                  <p className="text-xs text-text-muted text-center">
                    Share this 8-digit invite code with household members to collaborate on this list.
                  </p>
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-full bg-black/40 border border-neutral-800 rounded-xl py-4 flex items-center justify-center">
                      <span className="text-2xl font-mono font-bold tracking-widest text-primary selection:bg-transparent">
                        {inviteCode}
                      </span>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:text-white text-xs font-semibold rounded-lg text-text-muted active:scale-95 transition-all cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-500" />
                          <span className="text-emerald-500">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}

      {/* Join List Bottom Sheet */}
      {isJoinOpen && (
        <>
          <div 
            onClick={() => {
              if (!isJoining && !isSyncingPostJoin) setIsJoinOpen(false)
            }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
          />
          <div className="fixed bottom-0 left-0 right-0 md:left-auto md:right-auto md:w-full md:max-w-md bg-surface-tile border-t border-neutral-800 rounded-t-2xl z-50 px-4 pt-4 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-250 ease-out">
            <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-white">Join Shared List</h3>
              </div>
              <button 
                onClick={() => {
                  if (!isJoining && !isSyncingPostJoin) setIsJoinOpen(false)
                }}
                disabled={isJoining || isSyncingPostJoin}
                className="p-1 text-text-muted hover:text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isSyncingPostJoin ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm font-medium text-white">Downloading list items...</p>
                <p className="text-xs text-text-muted">Performing initial synchronization...</p>
              </div>
            ) : (
              <form onSubmit={handleJoinList} className="space-y-4">
                <div>
                  <label htmlFor="join-code" className="text-[10px] uppercase tracking-wider font-bold text-text-muted block mb-1.5">
                    Invite Code (8 Alphanumerics)
                  </label>
                  <input
                    id="join-code"
                    type="text"
                    placeholder="e.g. ABC123XY"
                    maxLength={8}
                    disabled={isJoining}
                    value={joinCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                      setJoinCode(val)
                    }}
                    autoFocus
                    className="w-full bg-black/40 border border-neutral-800 rounded-lg py-2.5 px-3.5 text-center text-lg font-mono tracking-widest focus:outline-none focus:border-primary transition-colors text-white placeholder-neutral-600 disabled:opacity-50"
                  />
                </div>

                {joinError && (
                  <p className="text-xs text-red-400 text-center animate-in fade-in duration-100">
                    {joinError}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsJoinOpen(false)}
                    disabled={isJoining}
                    className="flex-1 py-2.5 px-4 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:text-white text-xs font-semibold rounded-lg text-text-muted active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isJoining || joinCode.length !== 8}
                    className="flex-1 py-2.5 px-4 bg-primary hover:bg-[#c0a9f5] text-black font-semibold rounded-lg text-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isJoining ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Joining...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Join</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  )
}
