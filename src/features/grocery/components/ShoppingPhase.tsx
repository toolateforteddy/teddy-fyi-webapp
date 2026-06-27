import { useState, useEffect, useRef, useMemo } from 'react'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import { CheckSquare, Square, Check, MapPin, ClipboardList } from 'lucide-react'
import type { GroceryItem } from '@/types/grocery'
import { cn } from '@/utils/cn'
import { DEFAULT_STORES, DEFAULT_CATEGORIES } from '../config/constants'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'

export function ShoppingPhase() {
  const { activeListId, items, setItems, stores, categories, itemStoreInfos } = useGrocery()

  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(() => {
    return storage.getItem<number | null>(STORAGE_KEYS.SELECTED_STORE_ID, null)
  })

  const [isConfirmTripOpen, setIsConfirmTripOpen] = useState(false)
  const confirmDialogRef = useRef<HTMLDialogElement>(null)

  // Sync selectedStoreId with storage
  useEffect(() => {
    if (selectedStoreId === null) {
      storage.removeItem(STORAGE_KEYS.SELECTED_STORE_ID)
    } else {
      storage.setItem(STORAGE_KEYS.SELECTED_STORE_ID, selectedStoreId)
    }
  }, [selectedStoreId])

  // Handle native confirmation dialog visibility
  useEffect(() => {
    const dialog = confirmDialogRef.current
    if (!dialog) return

    if (isConfirmTripOpen) {
      if (!dialog.open) {
        dialog.showModal()
      }
    } else {
      if (dialog.open) {
        dialog.close()
      }
    }
  }, [isConfirmTripOpen])

  // Memoize active stores
  const activeStores = useMemo(() => {
    const list = stores && stores.length > 0 ? stores : DEFAULT_STORES
    return [...list]
      .filter(s => s.listId === activeListId && !s.is_deleted)
      .sort((a, b) => a.position - b.position)
  }, [stores, activeListId])

  // Clear selection if the store is deleted/missing
  useEffect(() => {
    if (selectedStoreId !== null && !activeStores.some(s => s.id === selectedStoreId)) {
      setSelectedStoreId(null)
    }
  }, [selectedStoreId, activeStores])

  // Memoize active categories
  const activeCategories = useMemo(() => {
    const list = categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES
    return list
      .filter(c => c.listId === activeListId && !c.is_deleted)
      .sort((a, b) => a.position - b.position)
  }, [categories, activeListId])

  // Toggle "Bought" state with View Transitions API
  const toggleBought = (itemId: string) => {
    const performUpdate = () => {
      setItems(prev => prev.map(item => {
        if (item.id !== itemId) return item
        return {
          ...item,
          isBought: !item.isBought,
          sync_state: 'PENDING_UPDATE',
          version: item.version + 1
        }
      }))
    }

    if (document.startViewTransition) {
      document.startViewTransition(performUpdate)
    } else {
      performUpdate()
    }
  }

  // Clear in-cart items (Complete trip workflow)
  const handleCompleteTrip = () => {
    const performArchive = () => {
      setItems(prev => prev.map(item => {
        if (item.isBought) {
          return {
            ...item,
            isActive: false,
            timesBought: (item.timesBought || 0) + 1,
            sync_state: 'PENDING_UPDATE',
            version: item.version + 1
          }
        }
        return item
      }))
      setIsConfirmTripOpen(false)
    }

    if (document.startViewTransition) {
      document.startViewTransition(performArchive)
    } else {
      performArchive()
    }
  }

  // Filter items dynamically based on selected list & isolated store
  const activeItems = useMemo(() => {
    return items.filter(item => {
      if (item.listId !== activeListId || !item.isActive || item.is_deleted) {
        return false
      }
      if (selectedStoreId === null) {
        return true
      }
      const itemMappings = itemStoreInfos.filter(
        info => info.groceryItemId === item.id && info.listId === activeListId && !info.is_deleted && info.isAvailable
      )
      if (itemMappings.length === 0) {
        return true
      }
      return itemMappings.some(info => info.storeId === selectedStoreId)
    })
  }, [items, activeListId, selectedStoreId, itemStoreInfos])

  // Split to buy vs in cart
  const { toBuyItems, inCartItems } = useMemo(() => {
    const toBuy = activeItems.filter(item => !item.isBought)
    const inCart = activeItems.filter(item => item.isBought)
    return { toBuyItems: toBuy, inCartItems: inCart }
  }, [activeItems])

  const progressPercent = useMemo(() => {
    if (activeItems.length === 0) return 0
    return Math.round((inCartItems.length / activeItems.length) * 100)
  }, [inCartItems.length, activeItems.length])

  // Group to-buy items by category
  const toBuyByCategory = useMemo(() => {
    const groups = activeCategories.reduce((acc, cat) => {
      const catItems = toBuyItems.filter(item => item.categoryId === cat.id)
      if (catItems.length > 0) {
        const sortedItems = [...catItems].sort((a, b) => a.name.localeCompare(b.name))
        acc.push({ category: cat, items: sortedItems })
      }
      return acc
    }, [] as Array<{ category: typeof categories[0]; items: GroceryItem[] }>)

    const uncategorizedToBuyItems = toBuyItems.filter(
      item => !item.categoryId || !activeCategories.some(cat => cat.id === item.categoryId)
    )

    if (uncategorizedToBuyItems.length > 0) {
      const sortedUncategorized = [...uncategorizedToBuyItems].sort((a, b) => a.name.localeCompare(b.name))
      groups.push({
        category: {
          id: '-1',
          name: 'Uncategorized',
          position: 999,
          listId: activeListId,
          sync_state: 'SYNCED',
          version: 1,
          is_deleted: false
        },
        items: sortedUncategorized
      })
    }

    return groups
  }, [activeCategories, toBuyItems, activeListId])

  return (
    <div className="space-y-5 flex-1 flex flex-col min-h-0 animate-in fade-in duration-200">
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-wider font-bold text-text-muted px-1 block mb-1">
          Active Store Isolation
        </label>
        <div className="flex flex-wrap gap-2 animate-in fade-in duration-200">
          {activeStores.map((store) => {
            const isSelected = store.id === selectedStoreId
            return (
              <button
                key={store.id}
                onClick={() => setSelectedStoreId(isSelected ? null : store.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-semibold transition-all duration-200 active:scale-95 cursor-pointer",
                  isSelected
                    ? "bg-primary text-black border-primary shadow-[0_0_12px_rgba(208,188,255,0.35)]"
                    : "bg-surface-tile border-neutral-900 hover:border-neutral-800 text-text-muted hover:text-white"
                )}
              >
                <MapPin className={cn("w-3.5 h-3.5", isSelected ? "text-black" : "text-primary")} />
                {store.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Shopping Layout */}
      {!selectedStoreId ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 mt-12 animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-full bg-surface-tile border border-neutral-800 flex items-center justify-center text-neutral-600 mb-4">
            <ClipboardList className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-300 mb-1">High-Velocity Mode</h3>
          <p className="text-sm text-text-muted max-w-[240px]">Select which store you are physically at above to filter items and begin checkout.</p>
        </div>
      ) : (
        <div className="space-y-6 flex-1 flex flex-col min-h-0">
          
          {/* Progress Bar */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 space-y-2 shrink-0">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-text-muted">Trip Progress</span>
              <span className="font-bold text-primary">{inCartItems.length} of {activeItems.length} items ({progressPercent}%)</span>
            </div>
            <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-neutral-800">
              <div 
                className="bg-primary h-full transition-all duration-300 ease-out" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Active Needed Items */}
          <div className="space-y-4 flex-1 overflow-y-auto">
            {toBuyItems.length === 0 ? (
              <div className="text-center py-8">
                <Check className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <h4 className="font-semibold text-white">All items captured!</h4>
                <p className="text-xs text-text-muted">Nice work. Proceed to complete your trip.</p>
              </div>
            ) : (
              toBuyByCategory.map(({ category, items: categoryItems }) => (
                <div key={category.id} className="space-y-2">
                  <h5 className="text-[10px] font-bold tracking-widest text-text-muted px-1 uppercase flex items-center gap-1">
                    {category.icon && <span className="text-xs normal-case">{category.icon}</span>}
                    <span>{category.name}</span>
                  </h5>

                  {/* Fluid responsive columns layout */}
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
                    {categoryItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => toggleBought(item.id)}
                        className="flex items-center justify-between p-3 h-12 rounded-lg bg-surface-tile border border-neutral-950 active:scale-95 transition-all text-left cursor-pointer group"
                      >
                        <span className="text-sm font-semibold truncate text-white pr-2 group-hover:text-primary">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-text-muted bg-black/40 px-1.5 py-0.5 rounded border border-neutral-800">
                            {item.quantity}
                          </span>
                          <Square className="w-4 h-4 text-text-muted" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}

            {/* Collapsible/Faded "In Cart" Section */}
            {inCartItems.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-[#1a1a1a]">
                <div className="flex items-center justify-between px-1">
                  <h5 className="text-[10px] font-bold tracking-widest text-emerald-500 uppercase">
                    In Cart ({inCartItems.length})
                  </h5>
                </div>

                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2 opacity-35">
                  {inCartItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleBought(item.id)}
                      className="flex items-center justify-between p-3 h-12 rounded-lg bg-surface-tile border border-emerald-950 text-left line-through cursor-pointer"
                    >
                      <span className="text-sm font-medium truncate text-neutral-400">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-neutral-500 bg-black/40 px-1.5 py-0.5 rounded border border-neutral-800">
                          {item.quantity}
                        </span>
                        <CheckSquare className="w-4 h-4 text-emerald-500" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Complete Trip Action Bar */}
          {inCartItems.length > 0 && (
            <div className="sticky bottom-0 bg-black pt-2 pb-1 z-30">
              <button
                onClick={() => setIsConfirmTripOpen(true)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 text-sm shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              >
                <Check className="w-5 h-5 stroke-[2.5]" />
                Complete Shopping Trip
              </button>
            </div>
          )}
        </div>
      )}

      {/* Complete Trip Confirmation Native Dialog */}
      <dialog
        ref={confirmDialogRef}
        onClose={() => setIsConfirmTripOpen(false)}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-32px)] max-w-sm bg-surface-tile border border-neutral-800 p-6 rounded-2xl z-50 shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm animate-in scale-in duration-200 focus:outline-none"
      >
        <h3 className="text-base font-bold text-white mb-2">Complete Grocery Trip?</h3>
        <p className="text-xs text-text-muted mb-6">
          This will archive and clear all {inCartItems.length} checked items from the current shopping cart. Unchecked items will remain on your list.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setIsConfirmTripOpen(false)}
            className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            Keep Shopping
          </button>
          <button
            onClick={handleCompleteTrip}
            className="bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            Yes, Archive Trip
          </button>
        </div>
      </dialog>
    </div>
  )
}
