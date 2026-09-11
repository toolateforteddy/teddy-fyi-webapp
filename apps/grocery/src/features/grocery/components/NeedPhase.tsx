import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import { Plus, ShoppingBag } from 'lucide-react'
import type { GroceryItem, GroceryItemStoreInfo } from '@/types/grocery'
import { cn } from '@/utils/cn'
import { generateUuid } from '@/utils/uuid'
import { DEFAULT_CATEGORIES, getCategoryColor, DEFAULT_STORES } from '../config/constants'
import { GroceryItemTile } from './GroceryItemTile'
import { AddNeededItemSheet, AddNeededItemPane } from './AddNeededItemSheet'
import { useAppLayout } from '@/hooks/useAppLayout'
import { peekSharedItem, clearSharedItem } from '../utils/sharedItem'

export function NeedPhase() {
  const { 
    activeListId, 
    items, 
    setItems, 
    categories, 
    stores, 
    itemStoreInfos, 
    setItemStoreInfos
  } = useGrocery()

  const { dockAddPane } = useAppLayout()

  const [rawExpandedItemId, setExpandedItemId] = useState<string | null>(null)
  // An expanded item can be deleted remotely mid-sync, so treat a stale id as
  // collapsed rather than resetting it from an effect.
  const expandedItemId =
    rawExpandedItemId && items.some(item => item.id === rawExpandedItemId && !item.is_deleted)
      ? rawExpandedItemId
      : null

  /**
   * Two ways into the add sheet besides the button: the manifest's "Add an item"
   * shortcut, which launches at /?add=1, and a share, which lands at /share and
   * parks the text before redirecting here.
   *
   * Both are read as the component initialises rather than from an effect, so the
   * sheet is open on the first paint instead of the list flashing up first. The
   * read is a peek, not a take -- clearing is a side effect and belongs in the
   * effect below, which also means a double render cannot lose the shared name.
   */
  const [searchParams, setSearchParams] = useSearchParams()
  const wantsAdd = searchParams.get('add') !== null

  const [shared] = useState<string | null>(() => peekSharedItem())
  const [sharedName, setSharedName] = useState<string | undefined>(shared ?? undefined)
  const [wantsSheet, setIsAddOpen] = useState(shared !== null || wantsAdd)

  // With the form docked there is nothing for the sheet to add, and a modal over
  // a form that is already on screen is just something to dismiss. A rotation
  // into the docked layout closes a sheet that was already up.
  const isAddOpen = wantsSheet && !dockAddPane

  useEffect(() => {
    if (shared !== null) clearSharedItem()
  }, [shared])

  // Consume the query parameter, so a reload or a back gesture does not reopen the
  // sheet over a list the user has already moved on from.
  useEffect(() => {
    if (!wantsAdd) return

    const next = new URLSearchParams(searchParams)
    next.delete('add')
    setSearchParams(next, { replace: true })
  }, [wantsAdd, searchParams, setSearchParams])

  // Memoize active stores
  const activeStores = useMemo(() => {
    const list = stores && stores.length > 0 ? stores : DEFAULT_STORES
    return [...list]
      .filter(s => s.listId === activeListId && !s.is_deleted)
      .sort((a, b) => a.position - b.position)
  }, [stores, activeListId])

  // Memoize active categories
  const activeCategories = useMemo(() => {
    const list = categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES
    return list
      .filter(cat => cat.listId === activeListId && !cat.is_deleted)
      .sort((a, b) => a.position - b.position)
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: getCategoryColor(cat.id)
      }))
  }, [categories, activeListId])

  // Memoize active items
  const activeItems = useMemo(() => {
    return items.filter(item => item.listId === activeListId && item.isActive && !item.is_deleted)
  }, [items, activeListId])

  // Memoize grouped items by category
  const itemsByCategory = useMemo(() => {
    const groups = activeCategories.reduce((acc, cat) => {
      const catItems = activeItems.filter(item => item.categoryId === cat.id)
      if (catItems.length > 0) {
        const sortedItems = [...catItems].sort((a, b) => a.name.localeCompare(b.name))
        acc.push({ category: cat, items: sortedItems })
      }
      return acc
    }, [] as Array<{ category: any; items: GroceryItem[] }>)

    const uncategorizedItems = activeItems.filter(
      item => !item.categoryId || !activeCategories.some(cat => cat.id === item.categoryId)
    )

    if (uncategorizedItems.length > 0) {
      const sortedUncategorized = [...uncategorizedItems].sort((a, b) => a.name.localeCompare(b.name))
      groups.push({
        category: {
          id: '-1',
          name: 'Uncategorized',
          color: '#737373',
          icon: ''
        },
        items: sortedUncategorized
      })
    }

    return groups
  }, [activeCategories, activeItems])

  // Handlers for item modifications
  const toggleStoreForItem = (itemId: string, storeId: string) => {
    setItemStoreInfos(prev => {
      const existingIndex = prev.findIndex(info => info.groceryItemId === itemId && info.storeId === storeId)
      if (existingIndex !== -1) {
        const existing = prev[existingIndex]
        if (existing.is_deleted || !existing.isAvailable) {
          return prev.map((info, idx) => idx === existingIndex ? {
            ...info,
            isAvailable: true,
            is_deleted: false,
            sync_state: existing.sync_state === 'PENDING_INSERT' ? 'PENDING_INSERT' : 'PENDING_UPDATE',
            version: info.version + 1
          } : info)
        } else {
          if (existing.sync_state === 'PENDING_INSERT') {
            return prev.filter((_, idx) => idx !== existingIndex)
          } else {
            return prev.map((info, idx) => idx === existingIndex ? {
              ...info,
              isAvailable: false,
              is_deleted: true,
              sync_state: 'PENDING_DELETE',
              version: info.version + 1
            } : info)
          }
        }
      } else {
        const newInfo: GroceryItemStoreInfo = {
          groceryItemId: itemId,
          storeId: storeId,
          isAvailable: true,
          listId: activeListId,
          sync_state: 'PENDING_INSERT',
          version: 1,
          is_deleted: false
        }
        return [...prev, newInfo]
      }
    })
  }

  const updateQuantity = (itemId: string, increment: boolean) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      
      const currentQty = parseInt(item.quantity, 10)
      let nextQtyStr: string
      
      if (!isNaN(currentQty)) {
        const nextQty = increment ? currentQty + 1 : Math.max(1, currentQty - 1)
        const unitPart = item.quantity.replace(/^\d+\s*/, '')
        nextQtyStr = unitPart ? `${nextQty} ${unitPart}` : `${nextQty}`
      } else {
        nextQtyStr = increment ? '2' : '1'
      }

      return {
        ...item,
        quantity: nextQtyStr,
        sync_state: item.sync_state === 'PENDING_INSERT' ? 'PENDING_INSERT' : 'PENDING_UPDATE',
        version: item.version + 1
      }
    }))
  }

  const updateCategory = (itemId: string, newCategoryId: string | undefined) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      return {
        ...item,
        categoryId: newCategoryId,
        sync_state: item.sync_state === 'PENDING_INSERT' ? 'PENDING_INSERT' : 'PENDING_UPDATE',
        version: item.version + 1
      }
    }))
  }

  const deleteItem = (itemId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      
      const hasHistory = (item.timesBought || 0) > 0
      return {
        ...item,
        is_deleted: !hasHistory,
        isActive: false,
        sync_state: hasHistory ? 'PENDING_UPDATE' : 'PENDING_DELETE',
        version: item.version + 1
      }
    }))
    setExpandedItemId(null)
  }

  const handleAddItem = (name: string, quantity: string, categoryId: string | undefined) => {
    const newItem: GroceryItem = {
      id: generateUuid(),
      name: name,
      quantity: quantity || '1',
      isBought: false,
      createdAt: Date.now(),
      position: items.length + 1,
      categoryId: categoryId,
      timesBought: 0,
      isActive: true,
      listId: activeListId,
      sync_state: 'PENDING_INSERT',
      version: 1,
      is_deleted: false,
    }

    setItems(prev => [...prev, newItem])
  }

  const list = (
    <div className="flex-1 min-w-0 space-y-4">
      {activeItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 mt-12 animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-full bg-surface-tile border border-neutral-800 flex items-center justify-center text-neutral-600 mb-4">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-300 mb-1">Your list is empty</h3>
          <p className="text-sm text-text-muted max-w-[240px]">
            {dockAddPane
              ? 'Use the form beside this list to add items you need.'
              : 'Tap the floating action button below to add items you need.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {itemsByCategory.map(({ category, items: categoryItems }) => (
            <div key={category.id} className="space-y-2">
              {/* Category Header */}
              <div className="flex items-center gap-2 px-1">
                <span 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: category.color }} 
                />
                <h4 className="text-xs font-bold tracking-widest text-text-muted uppercase flex items-center gap-1.5">
                  {category.icon && <span className="text-sm normal-case">{category.icon}</span>}
                  <span>{category.name}</span>
                </h4>
                <span className="text-[10px] text-neutral-600 bg-neutral-900 px-1.5 py-0.5 rounded-full font-medium">
                  {categoryItems.length}
                </span>
              </div>

              {/* Fluid Responsive Grid */}
              <div className="tile-grid gap-2">
                {categoryItems.map((item) => {
                  const isExpanded = expandedItemId === item.id
                  const isPending = item.sync_state !== 'SYNCED'

                  return (
                    <GroceryItemTile
                      key={item.id}
                      item={item}
                      isExpanded={isExpanded}
                      isPending={isPending}
                      activeCategories={activeCategories}
                      activeStores={activeStores}
                      itemStoreInfos={itemStoreInfos}
                      onToggleExpand={() => setExpandedItemId(isExpanded ? null : item.id)}
                      onUpdateQuantity={updateQuantity}
                      onUpdateCategory={updateCategory}
                      onToggleStore={toggleStoreForItem}
                      onDeleteItem={deleteItem}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div
      className={cn(
        'relative flex-1 flex min-h-0',
        // The docked pane is a sibling of the list, not an overlay on it.
        dockAddPane ? 'flex-row gap-4' : 'flex-col space-y-4 pb-20'
      )}
    >
      {list}

      {dockAddPane && (
        <AddNeededItemPane
          activeCategories={activeCategories}
          onAddItem={handleAddItem}
          initialName={sharedName}
        />
      )}

      {/* Floating Action Button (FAB). Absent while the form is docked -- there is
          nothing left for it to open. */}
      {!dockAddPane && (
      <button
        onClick={() => setIsAddOpen(true)}
        className={cn(
          // Anchored to the app frame rather than the viewport: --app-frame-gutter
          // is the distance from the viewport edge to the frame edge, and
          // --app-nav-height is 0 when the nav has moved to a side rail. Both are
          // inherited from .app-frame, which works even though this is fixed.
          "fixed z-30 right-[calc(var(--app-frame-gutter)+1rem)] bottom-[calc(var(--app-nav-height)+env(safe-area-inset-bottom)+1rem)]",
          "w-14 h-14 rounded-full bg-primary text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer duration-200",
          expandedItemId !== null ? "opacity-0 scale-75 pointer-events-none" : "opacity-100 scale-100"
        )}
        aria-label="Add grocery item"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>
      )}

      {/* Slide-Up Bottom Sheet Modal */}
      <AddNeededItemSheet
        isOpen={isAddOpen}
        initialName={sharedName}
        onClose={() => {
          setIsAddOpen(false)
          setSharedName(undefined)
        }}
        activeCategories={activeCategories}
        onAddItem={handleAddItem}
      />
    </div>
  )
}
