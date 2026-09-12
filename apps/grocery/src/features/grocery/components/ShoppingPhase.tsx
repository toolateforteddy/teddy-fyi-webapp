import { useState, useEffect, useRef, useMemo } from 'react'
import { flushSync } from 'react-dom'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import { CheckSquare, Square, Check, MapPin, MapPinOff, ClipboardList, ChevronDown } from 'lucide-react'
import type { GroceryItem } from '@/types/grocery'
import { cn } from '@/utils/cn'
import { DEFAULT_STORES, DEFAULT_CATEGORIES } from '../config/constants'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import { mappedStoreIds, isOffMappingAtStore, addStoreMapping } from '../utils/storeMapping'

/**
 * Runs a state update inside a View Transition when the browser supports one.
 *
 * React flushes state updates asynchronously, so passing a plain setState
 * callback to startViewTransition lets the DOM change *after* the browser has
 * taken its snapshot. Chrome tolerates this (you just lose the animation);
 * WebKit can leave the page visually stuck mid-transition. flushSync forces the
 * DOM to update inside the callback, which is what the API expects.
 */
function startTransitionSafely(update: () => void) {
  if (typeof document.startViewTransition !== 'function') {
    update()
    return
  }

  try {
    document.startViewTransition(() => {
      flushSync(update)
    })
  } catch (err) {
    console.error('[ViewTransition] Falling back to a plain update:', err)
    update()
  }
}

export function ShoppingPhase() {
  const { activeListId, items, setItems, stores, categories, itemStoreInfos, setItemStoreInfos } = useGrocery()

  const [rawSelectedStoreId, setSelectedStoreId] = useState<string | null>(() => {
    return storage.getItem<string | null>(STORAGE_KEYS.SELECTED_STORE_ID, null)
  })

  const [isConfirmTripOpen, setIsConfirmTripOpen] = useState(false)
  const [isOffMappingOpen, setIsOffMappingOpen] = useState(false)
  const confirmDialogRef = useRef<HTMLDialogElement>(null)

  // Which off-mapping purchases the shopper wants to keep. This starts empty on
  // every trip and is cleared again whenever the dialog opens: buying something
  // once at a store it is not mapped to is a one-off -- the expensive tub of
  // yoghurt you grabbed anyway -- and must not quietly become the mapping.
  const [mappingOptIns, setMappingOptIns] = useState<Record<string, boolean>>({})

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

  // A selected store can be deleted remotely, so treat a stale id as "no store
  // selected" during render rather than clearing it from an effect.
  const selectedStoreId =
    rawSelectedStoreId !== null && activeStores.some(s => s.id === rawSelectedStoreId)
      ? rawSelectedStoreId
      : null

  // Sync selectedStoreId with storage
  useEffect(() => {
    if (selectedStoreId === null) {
      storage.removeItem(STORAGE_KEYS.SELECTED_STORE_ID)
    } else {
      storage.setItem(STORAGE_KEYS.SELECTED_STORE_ID, selectedStoreId)
    }
  }, [selectedStoreId])


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

    startTransitionSafely(performUpdate)
  }

  // Clear in-cart items (Complete trip workflow)
  const handleCompleteTrip = () => {
    const storeId = selectedStoreId
    // Only the ticked ones. An off-mapping purchase left unticked archives exactly
    // like every other item and the mapping is untouched -- that is the default,
    // and it is what makes buying something here once safe.
    const optedIn = storeId === null ? [] : offMappingInCart.filter(item => mappingOptIns[item.id])

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

      if (storeId !== null && optedIn.length > 0) {
        setItemStoreInfos(prev =>
          optedIn.reduce((infos, item) => addStoreMapping(infos, item.id, storeId, activeListId), prev)
        )
      }

      setIsConfirmTripOpen(false)
      setMappingOptIns({})
    }

    startTransitionSafely(performArchive)
  }

  const openConfirmTrip = () => {
    setMappingOptIns({})
    setIsConfirmTripOpen(true)
  }

  // Filter items dynamically based on selected list & isolated store.
  //
  // An item this store is not mapped for stays out of the list until it is in the
  // cart. You reach it through the "Not usually here" tray below, and from the
  // moment it is checked it belongs on screen like anything else: so it can be
  // unchecked again, so it counts towards trip progress, and so completing the
  // trip can ask whether to map it.
  const activeItems = useMemo(() => {
    return items.filter(item => {
      if (item.listId !== activeListId || !item.isActive || item.is_deleted) {
        return false
      }
      if (selectedStoreId === null) {
        return true
      }
      if (!isOffMappingAtStore(itemStoreInfos, item.id, activeListId, selectedStoreId)) {
        return true
      }
      return item.isBought
    })
  }, [items, activeListId, selectedStoreId, itemStoreInfos])

  const selectedStore = activeStores.find(s => s.id === selectedStoreId)

  // The tray: everything the store filter is hiding, with the stores it is mapped
  // to, so "Fage -- usually Costco" is legible before you pick it up.
  const offMappingItems = useMemo(() => {
    if (selectedStoreId === null) return []
    return items
      .filter(item =>
        item.listId === activeListId &&
        item.isActive &&
        !item.is_deleted &&
        !item.isBought &&
        isOffMappingAtStore(itemStoreInfos, item.id, activeListId, selectedStoreId)
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(item => ({
        item,
        storeNames: mappedStoreIds(itemStoreInfos, item.id, activeListId)
          .map(id => activeStores.find(store => store.id === id)?.name)
          .filter((name): name is string => Boolean(name))
      }))
  }, [items, activeListId, selectedStoreId, itemStoreInfos, activeStores])

  // Split to buy vs in cart
  const { toBuyItems, inCartItems } = useMemo(() => {
    const toBuy = activeItems.filter(item => !item.isBought)
    const inCart = activeItems.filter(item => item.isBought)
    return { toBuyItems: toBuy, inCartItems: inCart }
  }, [activeItems])

  // What the completion dialog asks about: things in the cart that this store is
  // not mapped for. Derived at completion time rather than tracked as you shop,
  // so unchecking something takes it back out of the question with no bookkeeping.
  const offMappingInCart =
    selectedStoreId === null
      ? []
      : inCartItems
          .filter(item => isOffMappingAtStore(itemStoreInfos, item.id, activeListId, selectedStoreId))
          .sort((a, b) => a.name.localeCompare(b.name))

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
                    ? "bg-primary text-on-primary border-primary shadow-[var(--shadow-primary-glow)]"
                    : "bg-surface-tile border-line-faint hover:border-line text-text-muted hover:text-text-primary"
                )}
              >
                <MapPin className={cn("w-3.5 h-3.5", isSelected ? "text-on-primary" : "text-primary")} />
                {store.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Shopping Layout */}
      {!selectedStoreId ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 mt-12 animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-full bg-surface-tile border border-line flex items-center justify-center text-text-faint mb-4">
            <ClipboardList className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-text-secondary mb-1">High-Velocity Mode</h3>
          <p className="text-sm text-text-muted max-w-[240px]">Select which store you are physically at above to filter items and begin checkout.</p>
        </div>
      ) : (
        <div className="space-y-6 flex-1 flex flex-col min-h-0">
          
          {/* Progress Bar */}
          <div className="bg-surface-raised border border-line rounded-xl p-3.5 space-y-2 shrink-0">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-text-muted">Trip Progress</span>
              <span className="font-bold text-primary">{inCartItems.length} of {activeItems.length} items ({progressPercent}%)</span>
            </div>
            <div className="w-full bg-inset h-2 rounded-full overflow-hidden border border-line">
              <div 
                className="bg-primary h-full transition-all duration-300 ease-out" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Active Needed Items */}
          <div className="space-y-4 flex-1 overflow-y-auto overscroll-contain">
            {toBuyItems.length === 0 ? (
              <div className="text-center py-8">
                <Check className="w-10 h-10 text-success mx-auto mb-2" />
                <h4 className="font-semibold text-text-primary">All items captured!</h4>
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
                  <div className="tile-grid gap-2">
                    {categoryItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => toggleBought(item.id)}
                        className="flex items-center justify-between p-3 h-12 rounded-lg bg-surface-tile border border-line-faint active:scale-95 transition-all text-left cursor-pointer group"
                      >
                        <span className="text-sm font-semibold truncate text-text-primary pr-2 group-hover:text-primary">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-text-muted bg-inset px-1.5 py-0.5 rounded border border-line">
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

            {/* Things this store is not mapped for. Collapsed by default: the
                point of store isolation is a short list, and this is the escape
                hatch from it, not a second list. */}
            {offMappingItems.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-line-faint">
                <button
                  onClick={() => setIsOffMappingOpen(open => !open)}
                  aria-expanded={isOffMappingOpen}
                  className="w-full flex items-center justify-between px-1 cursor-pointer group"
                >
                  <h5 className="text-[10px] font-bold tracking-widest text-text-muted uppercase flex items-center gap-1.5 group-hover:text-text-secondary">
                    <MapPinOff className="w-3 h-3" />
                    Not usually here ({offMappingItems.length})
                  </h5>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-text-muted transition-transform duration-200",
                      isOffMappingOpen && "rotate-180"
                    )}
                  />
                </button>

                {isOffMappingOpen && (
                  <div className="space-y-2 animate-in fade-in duration-200">
                    <p className="text-[10px] text-text-subtle px-1">
                      Tap to buy one here anyway. Your mapping stays as it is unless you say otherwise when you complete the trip.
                    </p>
                    <div className="tile-grid gap-2">
                      {offMappingItems.map(({ item, storeNames }) => (
                        <button
                          key={item.id}
                          onClick={() => toggleBought(item.id)}
                          className="flex items-center justify-between p-3 h-12 rounded-lg bg-surface-tile border border-dashed border-line active:scale-95 transition-all text-left cursor-pointer group/item"
                        >
                          <span className="min-w-0 pr-2">
                            <span className="block text-sm font-semibold truncate text-text-secondary group-hover/item:text-primary">
                              {item.name}
                            </span>
                            {storeNames.length > 0 && (
                              <span className="block text-[10px] text-text-subtle truncate">
                                Usually {storeNames.join(', ')}
                              </span>
                            )}
                          </span>
                          <Square className="w-4 h-4 text-text-muted shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Collapsible/Faded "In Cart" Section */}
            {inCartItems.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-line-faint">
                <div className="flex items-center justify-between px-1">
                  <h5 className="text-[10px] font-bold tracking-widest text-success uppercase">
                    In Cart ({inCartItems.length})
                  </h5>
                </div>

                <div className="tile-grid gap-2 opacity-35">
                  {inCartItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleBought(item.id)}
                      className="flex items-center justify-between p-3 h-12 rounded-lg bg-surface-tile border border-success/25 text-left line-through cursor-pointer"
                    >
                      <span className="text-sm font-medium truncate text-text-muted">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-text-subtle bg-inset px-1.5 py-0.5 rounded border border-line">
                          {item.quantity}
                        </span>
                        <CheckSquare className="w-4 h-4 text-success" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Complete Trip Action Bar */}
          {inCartItems.length > 0 && (
            <div className="sticky bottom-0 bg-canvas pt-2 pb-1 z-30">
              <button
                onClick={openConfirmTrip}
                className="w-full bg-success hover:bg-success-hover text-on-success font-bold py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 text-sm shadow-[var(--shadow-success-glow)]"
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
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-32px)] max-w-sm bg-surface-tile border border-line p-6 rounded-2xl z-50 shadow-2xl backdrop:bg-scrim/75 backdrop:backdrop-blur-sm animate-in scale-in duration-200 focus:outline-none"
      >
        <h3 className="text-base font-bold text-text-primary mb-2">Complete Grocery Trip?</h3>
        <p className={cn("text-xs text-text-muted", offMappingInCart.length > 0 ? "mb-4" : "mb-6")}>
          This will archive and clear all {inCartItems.length} checked items from the current shopping cart. Unchecked items will remain on your list.
        </p>

        {offMappingInCart.length > 0 && (
          <div className="mb-6 space-y-2.5 rounded-xl border border-line bg-inset p-3">
            <div className="flex items-start gap-1.5">
              <MapPinOff className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed text-text-muted">
                You bought {offMappingInCart.length === 1 ? 'one thing' : `${offMappingInCart.length} things`}{' '}
                {selectedStore ? `${selectedStore.name} isn't mapped for` : 'this store is not mapped for'}. Tick anything
                you want to buy here from now on. Leave it unticked and your mapping does not change.
              </p>
            </div>

            <div className="space-y-1.5 max-h-40 overflow-y-auto overscroll-contain">
              {offMappingInCart.map(item => (
                <label
                  key={item.id}
                  className="flex items-center gap-2.5 rounded-lg border border-line-faint bg-surface-tile px-3 py-2 cursor-pointer hover:border-line"
                >
                  <input
                    type="checkbox"
                    checked={mappingOptIns[item.id] === true}
                    onChange={e => {
                      const { checked } = e.target
                      setMappingOptIns(prev => ({ ...prev, [item.id]: checked }))
                    }}
                    className="w-4 h-4 shrink-0 accent-success cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-text-primary truncate">{item.name}</span>
                  <span className="ml-auto text-[10px] text-text-subtle shrink-0">
                    {selectedStore ? `Add ${selectedStore.name}` : 'Add this store'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setIsConfirmTripOpen(false)}
            className="bg-surface-raised border border-line hover:bg-surface-hover text-text-primary text-xs font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            Keep Shopping
          </button>
          <button
            onClick={handleCompleteTrip}
            className="bg-success hover:bg-success-hover text-on-success text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            Yes, Archive Trip
          </button>
        </div>
      </dialog>
    </div>
  )
}
