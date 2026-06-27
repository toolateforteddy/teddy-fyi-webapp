import { useState, useEffect, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { 
  Database, 
  RefreshCw, 
  Trash2, 
  ShieldAlert, 
  HardDrive, 
  Wifi, 
  CheckCircle2, 
  User, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Plus,
  Edit2,
  MapPin,
  Tag
} from 'lucide-react'
import { cn } from '@/utils/cn'
import type { GroceryItem, GroceryList, Store, Category } from '@/types/grocery'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import { setApiBaseUrl } from '@/lib/axios'
import { env } from '@/config/env'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { getCategoryColor } from '../config/constants'

const EMOJI_PRESETS = ['🍎', '🥦', '🍞', '🥩', '🥛', '🍦', '🥫', '🧼', '🍿', '🥤', '🐶', '🧴']

export function SettingsPhase() {
  const { 
    items, 
    lists, 
    stores, 
    setStores, 
    categories, 
    setCategories, 
    handleManualSync 
  } = useOutletContext<{
    items: GroceryItem[]
    lists: GroceryList[]
    stores: Store[]
    setStores: React.Dispatch<React.SetStateAction<Store[]>>
    categories: Category[]
    setCategories: React.Dispatch<React.SetStateAction<Category[]>>
    handleManualSync: () => Promise<unknown>
  }>()

  const { user, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const [syncInterval, setSyncInterval] = useState('auto')
  const [apiUrl, setApiUrl] = useState(() => {
    return storage.getItem<string>(STORAGE_KEYS.API_BASE_URL, env.API_BASE_URL)
  })
  const [clearing, setClearing] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Sub-view State
  const [activeSubView, setActiveSubView] = useState<'main' | 'stores' | 'categories'>('main')

  // Store management state
  const [newStoreName, setNewStoreName] = useState('')
  const [editingStoreId, setEditingStoreId] = useState<number | null>(null)
  const [editingStoreName, setEditingStoreName] = useState('')

  // Category management state
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryIcon, setNewCategoryIcon] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [editingCategoryIcon, setEditingCategoryIcon] = useState('')

  const timeoutId = useRef<number | null>(null)
  const reloadTimeoutId = useRef<number | null>(null)

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutId.current !== null) clearTimeout(timeoutId.current)
      if (reloadTimeoutId.current !== null) clearTimeout(reloadTimeoutId.current)
    }
  }, [])

  const pendingChanges = 
    (items || []).filter(i => i.sync_state !== 'SYNCED').length +
    (lists || []).filter(l => l.sync_state !== 'SYNCED').length +
    (stores || []).filter(s => s.sync_state !== 'SYNCED').length +
    (categories || []).filter(c => c.sync_state !== 'SYNCED').length

  const totalCached = 
    (items || []).length +
    (lists || []).length +
    (stores || []).length +
    (categories || []).length

  const showToast = (msg: string) => {
    setSuccessMessage(msg)
    if (timeoutId.current !== null) clearTimeout(timeoutId.current)
    timeoutId.current = setTimeout(() => {
      setSuccessMessage(null)
      timeoutId.current = null
    }, 3000) as unknown as number
  }

  const handleSaveApiUrl = (newUrl: string) => {
    setApiUrl(newUrl)
    storage.setItem(STORAGE_KEYS.API_BASE_URL, newUrl)
    setApiBaseUrl(newUrl)
    showToast('API Base URL configuration updated.')
  }

  const handleClearLocal = () => {
    setClearing(true)
    if (timeoutId.current !== null) clearTimeout(timeoutId.current)
    timeoutId.current = setTimeout(() => {
      storage.removeItem(STORAGE_KEYS.ITEMS)
      storage.removeItem(STORAGE_KEYS.LISTS)
      storage.removeItem(STORAGE_KEYS.STORES)
      storage.removeItem(STORAGE_KEYS.CATEGORIES)
      storage.removeItem(STORAGE_KEYS.LAST_SYNCED)
      setClearing(false)
      showToast('Local cache cleared successfully. Reloading...')
      
      // Delay reload to let user see success toast
      reloadTimeoutId.current = setTimeout(() => {
        window.location.reload()
      }, 1500) as unknown as number
    }, 1000) as unknown as number
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setLoggingOut(false)
    }
  }

  // Defer sync trigger to let state propagate to parent context
  const triggerSync = () => {
    setTimeout(() => {
      handleManualSync().catch(err => console.error('[Sync] Auto-manual sync error:', err))
    }, 200)
  }

  // --- Store Handlers ---
  const handleAddStore = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStoreName.trim()) return

    const newStore: Store = {
      id: Date.now(),
      name: newStoreName.trim(),
      position: (stores || []).filter(s => !s.is_deleted).length + 1,
      isDefaultSupported: false,
      sync_state: 'PENDING_INSERT',
      version: 1,
      is_deleted: false,
    }

    setStores(prev => [...prev, newStore])
    setNewStoreName('')
    showToast(`Store "${newStore.name}" added locally.`)
    triggerSync()
  }

  const handleUpdateStoreName = (storeId: number) => {
    if (!editingStoreName.trim()) return
    setStores(prev => prev.map(s => {
      if (s.id !== storeId) return s
      return {
        ...s,
        name: editingStoreName.trim(),
        sync_state: s.sync_state === 'PENDING_INSERT' ? 'PENDING_INSERT' : 'PENDING_UPDATE',
        version: s.version + 1
      }
    }))
    setEditingStoreId(null)
    setEditingStoreName('')
    showToast('Store name updated.')
    triggerSync()
  }

  const handleDeleteStore = (storeId: number) => {
    const store = stores.find(s => s.id === storeId)
    if (!store) return

    setStores(prev => prev.map(s => {
      if (s.id !== storeId) return s
      return {
        ...s,
        is_deleted: true,
        sync_state: 'PENDING_DELETE',
        version: s.version + 1
      }
    }))
    showToast(`Store "${store.name}" removed.`)
    triggerSync()
  }

  const handleMoveStore = (storeId: number, direction: 'up' | 'down') => {
    const active = (stores || []).filter(s => !s.is_deleted).sort((a, b) => a.position - b.position)
    const index = active.findIndex(s => s.id === storeId)
    if (index === -1) return
    
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === active.length - 1) return
    
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const current = active[index]
    const other = active[swapIndex]

    setStores(prev => prev.map(s => {
      if (s.id === current.id) {
        return {
          ...s,
          position: other.position,
          sync_state: s.sync_state === 'PENDING_INSERT' ? 'PENDING_INSERT' : 'PENDING_UPDATE',
          version: s.version + 1
        }
      }
      if (s.id === other.id) {
        return {
          ...s,
          position: current.position,
          sync_state: s.sync_state === 'PENDING_INSERT' ? 'PENDING_INSERT' : 'PENDING_UPDATE',
          version: s.version + 1
        }
      }
      return s
    }))
    triggerSync()
  }

  // --- Category Handlers ---
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return

    const newCategory: Category = {
      id: Date.now(),
      name: newCategoryName.trim(),
      icon: newCategoryIcon.trim() || undefined,
      position: (categories || []).filter(c => !c.is_deleted).length + 1,
      sync_state: 'PENDING_INSERT',
      version: 1,
      is_deleted: false,
    }

    setCategories(prev => [...prev, newCategory])
    setNewCategoryName('')
    setNewCategoryIcon('')
    showToast(`Category "${newCategory.name}" added locally.`)
    triggerSync()
  }

  const handleUpdateCategory = (categoryId: number) => {
    if (!editingCategoryName.trim()) return
    setCategories(prev => prev.map(c => {
      if (c.id !== categoryId) return c
      return {
        ...c,
        name: editingCategoryName.trim(),
        icon: editingCategoryIcon.trim() || undefined,
        sync_state: c.sync_state === 'PENDING_INSERT' ? 'PENDING_INSERT' : 'PENDING_UPDATE',
        version: c.version + 1
      }
    }))
    setEditingCategoryId(null)
    setEditingCategoryName('')
    setEditingCategoryIcon('')
    showToast('Category updated.')
    triggerSync()
  }

  const handleDeleteCategory = (categoryId: number) => {
    const category = categories.find(c => c.id === categoryId)
    if (!category) return

    setCategories(prev => prev.map(c => {
      if (c.id !== categoryId) return c
      return {
        ...c,
        is_deleted: true,
        sync_state: 'PENDING_DELETE',
        version: c.version + 1
      }
    }))
    showToast(`Category "${category.name}" removed.`)
    triggerSync()
  }

  const handleMoveCategory = (categoryId: number, direction: 'up' | 'down') => {
    const active = (categories || []).filter(c => !c.is_deleted).sort((a, b) => a.position - b.position)
    const index = active.findIndex(c => c.id === categoryId)
    if (index === -1) return
    
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === active.length - 1) return
    
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const current = active[index]
    const other = active[swapIndex]

    setCategories(prev => prev.map(c => {
      if (c.id === current.id) {
        return {
          ...c,
          position: other.position,
          sync_state: c.sync_state === 'PENDING_INSERT' ? 'PENDING_INSERT' : 'PENDING_UPDATE',
          version: c.version + 1
        }
      }
      if (c.id === other.id) {
        return {
          ...c,
          position: current.position,
          sync_state: c.sync_state === 'PENDING_INSERT' ? 'PENDING_INSERT' : 'PENDING_UPDATE',
          version: c.version + 1
        }
      }
      return c
    }))
    triggerSync()
  }

  // --- Render Sub-views ---

  if (activeSubView === 'stores') {
    const activeStores = (stores || []).filter(s => !s.is_deleted).sort((a, b) => a.position - b.position)
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {successMessage && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-neutral-900 pb-3">
          <button
            onClick={() => setActiveSubView('main')}
            className="p-1.5 hover:bg-neutral-900 rounded-lg text-text-muted hover:text-white transition-colors cursor-pointer"
            aria-label="Back to settings"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-base font-bold text-white">Manage Stores</h3>
            <p className="text-[11px] text-text-muted">Configure active stores for filtering grocery lists</p>
          </div>
        </div>

        {/* Add Store Form */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider font-bold text-text-muted px-1 block">
            Add New Store
          </label>
          <form onSubmit={handleAddStore} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Trader Joe's, Costco..."
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg py-2.5 px-3 text-xs focus:outline-none focus:border-primary text-white"
            />
            <button
              type="submit"
              className="bg-primary hover:bg-[#c0a9f5] text-black font-semibold rounded-lg px-4 py-2 text-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" /> Add
            </button>
          </form>
        </div>

        {/* Stores List */}
        <div className="space-y-2.5">
          <label className="text-[10px] uppercase tracking-wider font-bold text-text-muted px-1 block">
            Stores List ({activeStores.length})
          </label>
          
          <div className="bg-surface-tile border border-neutral-900 rounded-xl divide-y divide-neutral-900">
            {activeStores.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                No stores configured. Add a store above to start.
              </div>
            ) : (
              activeStores.map((store, idx) => {
                const isEditing = editingStoreId === store.id
                return (
                  <div key={store.id} className="p-3.5 flex items-center justify-between gap-3 text-sm transition-colors hover:bg-neutral-900/20">
                    {isEditing ? (
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={editingStoreName}
                          onChange={(e) => setEditingStoreName(e.target.value)}
                          className="flex-1 bg-black border border-neutral-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-primary text-white"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdateStoreName(store.id)}
                          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-md text-xs font-semibold"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingStoreId(null)
                            setEditingStoreName('')
                          }}
                          className="bg-neutral-900 hover:bg-neutral-800 text-text-muted px-3 py-1 rounded-md text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 truncate">
                          <MapPin className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-semibold text-white truncate">{store.name}</span>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Reordering */}
                          <button
                            type="button"
                            onClick={() => handleMoveStore(store.id, 'up')}
                            disabled={idx === 0}
                            className="p-1.5 hover:bg-neutral-900 rounded-md text-text-muted hover:text-white disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                            aria-label="Move store up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveStore(store.id, 'down')}
                            disabled={idx === activeStores.length - 1}
                            className="p-1.5 hover:bg-neutral-900 rounded-md text-text-muted hover:text-white disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                            aria-label="Move store down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingStoreId(store.id)
                              setEditingStoreName(store.name)
                            }}
                            className="p-1.5 hover:bg-neutral-900 rounded-md text-text-muted hover:text-white cursor-pointer"
                            aria-label="Edit store"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStore(store.id)}
                            className="p-1.5 hover:bg-red-500/10 rounded-md text-neutral-500 hover:text-red-400 cursor-pointer"
                            aria-label="Delete store"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    )
  }

  if (activeSubView === 'categories') {
    const activeCategories = (categories || []).filter(c => !c.is_deleted).sort((a, b) => a.position - b.position)
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {successMessage && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-neutral-900 pb-3">
          <button
            onClick={() => setActiveSubView('main')}
            className="p-1.5 hover:bg-neutral-900 rounded-lg text-text-muted hover:text-white transition-colors cursor-pointer"
            aria-label="Back to settings"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-base font-bold text-white">Manage Categories</h3>
            <p className="text-[11px] text-text-muted">Configure active product categories and styling preset icons</p>
          </div>
        </div>

        {/* Add Category Form */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider font-bold text-text-muted px-1 block">
            Add New Category
          </label>
          
          <form onSubmit={handleAddCategory} className="bg-surface-tile border border-neutral-900 rounded-xl p-4 space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Category name..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg py-2.5 px-3 text-xs focus:outline-none focus:border-primary text-white"
              />
              <input
                type="text"
                placeholder="Emoji"
                value={newCategoryIcon}
                onChange={(e) => setNewCategoryIcon(e.target.value.slice(0, 2))}
                className="w-16 bg-neutral-900 border border-neutral-800 rounded-lg py-2.5 px-2 text-xs focus:outline-none focus:border-primary text-white text-center font-sans"
              />
            </div>

            {/* Quick Emoji Presets */}
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-wider text-text-muted font-bold block px-0.5">Quick Icon Presets</label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_PRESETS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewCategoryIcon(emoji)}
                    className={cn(
                      "w-8 h-8 rounded-lg bg-neutral-900 border text-sm flex items-center justify-center transition-all cursor-pointer hover:bg-neutral-800 active:scale-90",
                      newCategoryIcon === emoji ? "border-primary text-white" : "border-neutral-850 text-neutral-400"
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-primary hover:bg-[#c0a9f5] text-black font-semibold rounded-lg py-2.5 text-xs transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" /> Add Category
            </button>
          </form>
        </div>

        {/* Categories List */}
        <div className="space-y-2.5">
          <label className="text-[10px] uppercase tracking-wider font-bold text-text-muted px-1 block">
            Categories List ({activeCategories.length})
          </label>
          
          <div className="bg-surface-tile border border-neutral-900 rounded-xl divide-y divide-neutral-900">
            {activeCategories.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                No categories configured. Add a category above to start.
              </div>
            ) : (
              activeCategories.map((category, idx) => {
                const isEditing = editingCategoryId === category.id
                const catColor = getCategoryColor(category.id)
                return (
                  <div key={category.id} className="p-3.5 flex flex-col gap-2.5 text-sm transition-colors hover:bg-neutral-900/20 justify-center">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            className="flex-1 bg-black border border-neutral-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-primary text-white"
                            placeholder="Name"
                          />
                          <input
                            type="text"
                            value={editingCategoryIcon}
                            onChange={(e) => setEditingCategoryIcon(e.target.value.slice(0, 2))}
                            className="w-16 bg-black border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-center focus:outline-none focus:border-primary text-white"
                            placeholder="Emoji"
                          />
                        </div>
                        
                        <div className="flex flex-wrap gap-1.5">
                          {EMOJI_PRESETS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => setEditingCategoryIcon(emoji)}
                              className={cn(
                                "w-7 h-7 rounded-md bg-neutral-900 border text-xs flex items-center justify-center transition-all cursor-pointer hover:bg-neutral-800",
                                editingCategoryIcon === emoji ? "border-primary text-white" : "border-neutral-850 text-neutral-400"
                              )}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>

                        <div className="flex justify-end gap-2 pt-1 border-t border-neutral-900">
                          <button
                            onClick={() => handleUpdateCategory(category.id)}
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-md text-xs font-semibold"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingCategoryId(null)
                              setEditingCategoryName('')
                              setEditingCategoryIcon('')
                            }}
                            className="bg-neutral-900 hover:bg-neutral-800 text-text-muted px-3 py-1 rounded-md text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3 w-full">
                        <div className="flex items-center gap-2.5 truncate">
                          <span 
                            className="w-2.5 h-2.5 rounded-full shrink-0" 
                            style={{ backgroundColor: catColor }} 
                          />
                          {category.icon && <span className="text-base shrink-0">{category.icon}</span>}
                          <span className="font-semibold text-white truncate">{category.name}</span>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Reordering */}
                          <button
                            type="button"
                            onClick={() => handleMoveCategory(category.id, 'up')}
                            disabled={idx === 0}
                            className="p-1.5 hover:bg-neutral-900 rounded-md text-text-muted hover:text-white disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                            aria-label="Move category up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveCategory(category.id, 'down')}
                            disabled={idx === activeCategories.length - 1}
                            className="p-1.5 hover:bg-neutral-900 rounded-md text-text-muted hover:text-white disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                            aria-label="Move category down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategoryId(category.id)
                              setEditingCategoryName(category.name)
                              setEditingCategoryIcon(category.icon || '')
                            }}
                            className="p-1.5 hover:bg-neutral-900 rounded-md text-text-muted hover:text-white cursor-pointer"
                            aria-label="Edit category"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(category.id)}
                            className="p-1.5 hover:bg-red-500/10 rounded-md text-neutral-500 hover:text-red-400 cursor-pointer"
                            aria-label="Delete category"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    )
  }

  // --- Main Settings View ---

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Premium Success Toast */}
      {successMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Account Info Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <User className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold tracking-widest text-text-muted uppercase">
            Account Info
          </h4>
        </div>

        <div className="bg-surface-tile border border-neutral-900 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-3">
            {user?.picture ? (
              <img 
                src={user.picture} 
                alt={user.name || 'User avatar'} 
                className="w-10 h-10 rounded-full border border-neutral-800 object-cover" 
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-primary font-bold">
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h5 className="font-semibold text-sm text-white truncate">
                {user?.name || 'Authenticated User'}
              </h5>
              <p className="text-xs text-text-muted truncate">
                {user?.email || 'No email associated'}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full bg-neutral-900 hover:bg-neutral-850 text-white border border-neutral-800 py-2.5 rounded-lg text-xs font-bold transition-all active:scale-[0.99] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55"
          >
            <LogOut className="w-3.5 h-3.5" />
            {loggingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>

      {/* Grocery Configurations Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Database className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold tracking-widest text-text-muted uppercase">
            Grocery Configurations
          </h4>
        </div>

        <div className="bg-surface-tile border border-neutral-900 rounded-xl p-4 space-y-3">
          <button
            onClick={() => setActiveSubView('stores')}
            className="w-full bg-neutral-900 hover:bg-neutral-850 text-white border border-neutral-800 py-3 px-4 rounded-lg text-sm font-semibold transition-all active:scale-[0.99] flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span>Manage Stores</span>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-white transition-colors" />
          </button>

          <button
            onClick={() => setActiveSubView('categories')}
            className="w-full bg-neutral-900 hover:bg-neutral-850 text-white border border-neutral-800 py-3 px-4 rounded-lg text-sm font-semibold transition-all active:scale-[0.99] flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <Tag className="w-4 h-4 text-primary shrink-0" />
              <span>Manage Categories</span>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-white transition-colors" />
          </button>
        </div>
      </div>

      {/* Synchronization Engine Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <RefreshCw className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold tracking-widest text-text-muted uppercase">
            Sync Engine Configuration
          </h4>
        </div>

        <div className="bg-surface-tile border border-neutral-900 rounded-xl p-4 space-y-4">
          {/* Sync status */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted font-medium">Pending Local Mutations</span>
            <span className={cn(
              "font-bold text-xs px-2.5 py-0.5 rounded-full",
              pendingChanges > 0 ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
            )}>
              {pendingChanges} changes queued
            </span>
          </div>

          {/* Sync Frequency dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs text-text-muted font-medium block">
              Auto-Sync Frequency
            </label>
            <select
              value={syncInterval}
              onChange={(e) => setSyncInterval(e.target.value)}
              className="w-full bg-black/40 border border-neutral-800 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-primary text-white"
            >
              <option value="auto" className="bg-surface-tile">Real-time (On change)</option>
              <option value="hourly" className="bg-surface-tile">Every Hour</option>
              <option value="manual" className="bg-surface-tile">Manual Only</option>
            </select>
          </div>

          {/* API Endpoints */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-text-muted font-medium block">
                Backend API Base URL
              </label>
              <span className="flex items-center gap-1 text-[10px] text-emerald-500">
                <Wifi className="w-3 h-3" /> Online
              </span>
            </div>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => handleSaveApiUrl(e.target.value)}
              className="w-full bg-black/40 border border-neutral-800 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-primary text-white font-mono"
            />
          </div>
        </div>
      </div>

      {/* Database & Caching Statistics */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Database className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold tracking-widest text-text-muted uppercase">
            Local Database Info
          </h4>
        </div>

        <div className="bg-surface-tile border border-neutral-900 rounded-xl p-4 divide-y divide-neutral-900 text-sm">
          <div className="flex justify-between py-2.5">
            <span className="text-text-muted">Database Framework</span>
            <span className="font-semibold text-white">IndexedDB (LocalForage)</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-text-muted">Database Version</span>
            <span className="font-semibold text-white">v1.0 (Schema Sync Enabled)</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-text-muted">Total Cached Items</span>
            <span className="font-semibold text-white">{totalCached} records</span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <h4 className="text-xs font-bold tracking-widest text-red-400 uppercase">
            Danger Zone
          </h4>
        </div>

        <div className="bg-surface-tile border border-red-950/40 rounded-xl p-4 space-y-4">
          <div className="flex items-start gap-3">
            <HardDrive className="w-8 h-8 text-neutral-500 shrink-0" />
            <div>
              <h5 className="font-semibold text-sm text-white">Clear Caching Tables</h5>
              <p className="text-[11px] text-text-muted mt-0.5">
                Resets the local cache. Any changes that are not synced to the remote server will be permanently deleted.
              </p>
            </div>
          </div>

          <button
            onClick={handleClearLocal}
            disabled={clearing}
            className="w-full bg-red-650/10 hover:bg-red-650/20 text-red-400 border border-red-500/20 py-2.5 rounded-lg text-xs font-bold transition-all active:scale-[0.99] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {clearing ? 'Clearing Storage...' : 'Clear Local Cache'}
          </button>
        </div>
      </div>

    </div>
  )
}
