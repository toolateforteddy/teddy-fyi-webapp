import { useState, useEffect, useRef, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Plus, Check, MapPin, Sparkles, AlertCircle } from 'lucide-react'
import type { Store, GroceryItem, Category, GroceryList, GroceryItemStoreInfo } from '@/types/grocery'
import { cn } from '@/utils/cn'
import { DEFAULT_STORES, DEFAULT_RECOMMENDATIONS } from '../config/constants'
import { generateUuid } from '@/utils/uuid'

export function PlanningPhase() {
  const { activeListId, setActiveListId, items, setItems, lists, stores, setItemStoreInfos } = useOutletContext<{
    activeListId: string
    setActiveListId: React.Dispatch<React.SetStateAction<string>>
    items: GroceryItem[]
    setItems: React.Dispatch<React.SetStateAction<GroceryItem[]>>
    lists: GroceryList[]
    stores: Store[]
    categories: Category[]
    setItemStoreInfos: React.Dispatch<React.SetStateAction<GroceryItemStoreInfo[]>>
  }>()

  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null) // Default to null (All Stores)
  const [addedItems, setAddedItems] = useState<Record<string, boolean>>({})
  const timeoutRefs = useRef<Record<string, number>>({})

  // Cleanup all pending timeouts on unmount safely
  useEffect(() => {
    const currentTimeouts = timeoutRefs.current
    return () => {
      Object.values(currentTimeouts).forEach(clearTimeout)
    }
  }, [])
  
  const activeStores = [...(stores && stores.length > 0 ? stores : DEFAULT_STORES)]
    .filter(s => s.listId === activeListId && !s.is_deleted)
    .sort((a, b) => a.position - b.position)

  // Active planning list (derived dynamically from the active list items)
  const plannedItems = items
    .filter(item => item.listId === activeListId && item.isActive && !item.is_deleted)
    .map(item => item.name)

  // Generate dynamic recommendations from historically bought items
  const dynamicRecs = items
    .filter(item => item.listId === activeListId && !item.isActive && !item.is_deleted && item.timesBought > 0)
    .map(item => ({
      name: item.name,
      categoryId: item.categoryId || '1',
      storeId: selectedStoreId || 1,
      timesBought: item.timesBought
    }))

  // Merge dynamic recommendations with default ones, preventing duplicates
  const recommendations = [...dynamicRecs]
  DEFAULT_RECOMMENDATIONS.forEach(def => {
    if (!recommendations.some(r => r.name.toLowerCase() === def.name.toLowerCase())) {
      recommendations.push(def)
    }
  })

  // Filter recommendations by selected store, exclude items already on the list, sort by timesBought descending, and take the top 10
  const filteredRecs = recommendations
    .filter(rec => !plannedItems.some(pName => pName.toLowerCase() === rec.name.toLowerCase()))
    .filter(rec => selectedStoreId === null || rec.storeId === selectedStoreId)
    .sort((a, b) => b.timesBought - a.timesBought)
    .slice(0, 10)

  const handleAddRecommendation = useCallback((itemName: string) => {
    if (addedItems[itemName]) return

    setAddedItems(prev => ({ ...prev, [itemName]: true }))

    const itemId = generateUuid() // Local client ID
    // Create a new real grocery item and append it
    const newItem: GroceryItem = {
      id: itemId,
      name: itemName,
      quantity: '1',
      isBought: false,
      createdAt: Date.now(),
      position: items.length + 1,
      categoryId: '1', // Default category
      timesBought: 1,
      isActive: true,
      listId: activeListId,
      sync_state: 'PENDING_INSERT',
      version: 1,
      is_deleted: false,
    }

    setItems(prev => [...prev, newItem])

    // Automatically map the item to the currently selected store if one is active
    if (selectedStoreId !== null) {
      setItemStoreInfos(prev => [
        ...prev,
        {
          groceryItemId: itemId,
          storeId: selectedStoreId,
          isAvailable: true,
          listId: activeListId,
          sync_state: 'PENDING_INSERT',
          version: 1,
          is_deleted: false
        }
      ])
    }
    
    // Auto-clear added state checkmark after 2 seconds safely
    const timer = setTimeout(() => {
      setAddedItems(prev => ({ ...prev, [itemName]: false }))
      delete timeoutRefs.current[itemName]
    }, 2000)
    timeoutRefs.current[itemName] = timer as unknown as number
  }, [addedItems, items.length, setItems, activeListId, selectedStoreId, setItemStoreInfos])

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* List Selector Header */}
      <div className="flex items-center justify-between bg-surface-tile border border-neutral-900 rounded-xl p-3.5 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider truncate">Active List</span>
        </div>
        <div className="relative shrink-0">
          <select
            value={activeListId}
            onChange={(e) => setActiveListId(e.target.value)}
            className="bg-black border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary text-white cursor-pointer active:scale-95 transition-all max-w-[180px]"
          >
            {lists.filter(l => !l.is_deleted).map(list => (
              <option key={list.id} value={list.id} className="bg-surface-tile text-white">
                {list.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-wider font-bold text-text-muted px-1 block">
          Select Store Filter
        </label>
        
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 mask-right">
          <button
            onClick={() => setSelectedStoreId(null)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap cursor-pointer",
              selectedStoreId === null 
                ? "bg-primary text-black border-primary"
                : "bg-surface-tile text-text-muted border-neutral-800 hover:border-neutral-700"
            )}
          >
            All Stores
          </button>

          {activeStores.map((store) => (
            <button
              key={store.id}
              onClick={() => setSelectedStoreId(store.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap cursor-pointer",
                selectedStoreId === store.id 
                  ? "bg-primary text-black border-primary" 
                  : "bg-surface-tile text-text-muted border-neutral-800 hover:border-neutral-700"
              )}
            >
              <MapPin className="w-3 h-3" />
              {store.name}
            </button>
          ))}
        </div>
      </div>

      {/* Recommendation Tray */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <h4 className="text-xs font-bold tracking-widest text-text-muted uppercase">
              Smart Recommendations
            </h4>
          </div>
          <span className="text-[10px] text-neutral-500">Based on historical purchases</span>
        </div>

        {filteredRecs.length === 0 ? (
          <div className="bg-surface-tile border border-neutral-900 rounded-xl p-6 text-center">
            <AlertCircle className="w-5 h-5 text-neutral-500 mx-auto mb-2" />
            <p className="text-sm text-text-muted">No recommendations for this store yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredRecs.map((rec) => {
              const isAdded = addedItems[rec.name]
              
              return (
                <button
                  key={rec.name}
                  onClick={() => handleAddRecommendation(rec.name)}
                  disabled={isAdded}
                  className={cn(
                    "flex flex-col justify-between items-start text-left p-3 h-20 rounded-lg border transition-all cursor-pointer",
                    isAdded 
                      ? "bg-emerald-950/20 border-emerald-800 text-emerald-400" 
                      : "bg-surface-tile border-neutral-950 hover:border-neutral-800 hover:bg-neutral-900/50"
                  )}
                >
                  <div className="w-full flex items-start justify-between">
                    <span className={cn(
                      "text-xs font-semibold line-clamp-2 pr-2",
                      isAdded ? "text-emerald-400" : "text-white"
                    )}>
                      {rec.name}
                    </span>
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center transition-all",
                      isAdded ? "bg-emerald-500 text-black" : "bg-neutral-800 text-text-muted hover:bg-neutral-700"
                    )}>
                      {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </div>
                  </div>

                  <span className="text-[9px] text-neutral-500">
                    Bought {rec.timesBought}x
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Current List Progress */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-bold tracking-widest text-text-muted px-1 uppercase">
          Planned Items on active trip
        </h4>

        <div className="bg-surface-tile border border-neutral-900 rounded-xl divide-y divide-neutral-900 overflow-hidden">
          {plannedItems.map((itemName, index) => (
            <div key={index} className="flex items-center justify-between p-3.5 text-sm">
              <span className="font-medium text-white">{itemName}</span>
              <span className="text-[10px] text-text-muted bg-black/40 px-2 py-0.5 rounded border border-neutral-800">
                Active in Need List
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
