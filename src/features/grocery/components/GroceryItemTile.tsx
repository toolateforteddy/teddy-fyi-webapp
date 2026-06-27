import { Trash2, Check, Minus, Plus } from 'lucide-react'
import type { GroceryItem, GroceryItemStoreInfo } from '@/types/grocery'
import { cn } from '@/utils/cn'

interface GroceryItemTileProps {
  item: GroceryItem
  isExpanded: boolean
  isPending: boolean
  activeCategories: Array<{ id: string | number; name: string; color: string; icon?: string }>
  activeStores: any[]
  itemStoreInfos: GroceryItemStoreInfo[]
  onToggleExpand: () => void
  onUpdateQuantity: (itemId: string, increment: boolean) => void
  onUpdateCategory: (itemId: string, categoryId: string | undefined) => void
  onToggleStore: (itemId: string, storeId: number) => void
  onDeleteItem: (itemId: string) => void
}

export function GroceryItemTile({
  item,
  isExpanded,
  isPending,
  activeCategories,
  activeStores,
  itemStoreInfos,
  onToggleExpand,
  onUpdateQuantity,
  onUpdateCategory,
  onToggleStore,
  onDeleteItem
}: GroceryItemTileProps) {
  return (
    <div
      className={cn(
        "relative rounded-lg bg-surface-tile border transition-all duration-200 overflow-hidden select-none",
        isExpanded ? "col-span-2 h-[148px] border-neutral-700 bg-neutral-900/40" : "border-neutral-900",
        isPending && !isExpanded && "border-dashed border-primary/20"
      )}
    >
      {!isExpanded ? (
        /* CSS Scroll-Snap Horizontal Container for Swipe-to-Delete */
        <div className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-none overscroll-x-contain">
          {/* Main Item Tile */}
          <div
            onClick={onToggleExpand}
            className="w-full shrink-0 h-full px-3 flex items-center justify-between cursor-pointer active:bg-neutral-800/40 transition-all snap-start"
          >
            <div className="flex items-center gap-2 overflow-hidden mr-2">
              <span className="text-sm font-semibold truncate text-white">{item.name}</span>
              {isPending && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted bg-black/40 px-2 py-0.5 rounded-md border border-neutral-800">
                {item.quantity}
              </span>
            </div>
          </div>

          {/* Delete Action Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDeleteItem(item.id)
            }}
            className="w-16 shrink-0 h-full bg-red-600 flex items-center justify-center text-white cursor-pointer snap-end active:bg-red-700 transition-colors"
            aria-label="Delete item"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      ) : (
        /* Expanded Drawer Controls */
        <div className="absolute inset-0 bg-neutral-900 border-t border-neutral-800 flex flex-col justify-between p-3 animate-in fade-in duration-100">
          {/* Row 1: Item Name / Action buttons */}
          <div className="flex items-center justify-between w-full">
            <span className="text-sm font-semibold text-white truncate max-w-[70%]">
              {item.name}
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onDeleteItem(item.id)}
                className="p-1.5 text-red-400 hover:text-red-500 rounded-md hover:bg-red-950/20 active:scale-95 cursor-pointer"
                aria-label="Delete item"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
              <button 
                onClick={onToggleExpand}
                className="p-1.5 text-text-muted hover:text-white rounded-md hover:bg-neutral-800 active:scale-95 cursor-pointer"
                aria-label="Close edit"
              >
                <Check className="w-4.5 h-4.5 text-primary" />
              </button>
            </div>
          </div>

          {/* Row 2: Category and Quantity Controls */}
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-neutral-800/60">
            {/* Category Selector */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-[10px] uppercase font-bold text-text-muted shrink-0">Cat:</span>
              <select
                value={item.categoryId && activeCategories.some(c => c.id === item.categoryId) ? item.categoryId : ''}
                onChange={(e) => {
                  const newCatId = e.target.value ? e.target.value : undefined
                  onUpdateCategory(item.id, newCatId)
                }}
                className="bg-black/40 border border-neutral-800 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-primary text-white w-full max-w-[130px] cursor-pointer"
              >
                <option value="" className="bg-surface-tile text-neutral-400">Uncategorized</option>
                {activeCategories.map(cat => (
                  <option key={cat.id} value={cat.id} className="bg-surface-tile text-white">
                    {cat.icon ? `${cat.icon} ${cat.name}` : cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-medium text-text-muted">Qty: {item.quantity}</span>
              <div className="flex items-center gap-1 bg-black/40 rounded-lg p-0.5 border border-neutral-800">
                <button 
                  onClick={() => onUpdateQuantity(item.id, false)}
                  className="p-1 text-text-muted hover:text-white hover:bg-surface-tile rounded-md active:scale-95 cursor-pointer"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => onUpdateQuantity(item.id, true)}
                  className="p-1 text-text-muted hover:text-white hover:bg-surface-tile rounded-md active:scale-95 cursor-pointer"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: Store Selector */}
          <div className="flex items-center gap-1.5 pt-2 border-t border-neutral-800/60 overflow-x-auto scrollbar-none">
            <span className="text-[10px] uppercase font-bold text-text-muted shrink-0">Stores:</span>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {activeStores.length === 0 ? (
                <span className="text-[10px] text-neutral-500 italic">No stores configured</span>
              ) : (
                activeStores.map(store => {
                  const isSelected = itemStoreInfos.some(
                    info => info.groceryItemId === item.id && info.storeId === store.id && !info.is_deleted && info.isAvailable
                  )
                  return (
                    <button
                      key={store.id}
                      onClick={() => onToggleStore(item.id, store.id)}
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all cursor-pointer whitespace-nowrap",
                        isSelected
                          ? "bg-primary/20 text-primary border-primary/40 hover:bg-primary/30"
                          : "bg-black/40 text-text-muted border-neutral-800 hover:border-neutral-700 hover:text-white"
                      )}
                    >
                      {store.name}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
