import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import { Plus, Check, MapPin, Sparkles, AlertCircle } from 'lucide-react'
import type { GroceryItem } from '@/types/grocery'
import { cn } from '@/utils/cn'
import { DEFAULT_STORES, DEFAULT_RECOMMENDATIONS } from '../config/constants'
import { generateUuid } from '@/utils/uuid'

// Custom hook to manage items temporarily marked as "added" with self-cleaning timeouts
function useTimeoutState<T extends string | number>(delay = 2000): [Record<T, boolean>, (val: T) => void] {
  const [state, setState] = useState<Record<T, boolean>>({} as Record<T, boolean>)
  const timeoutRefs = useRef<Record<T, any>>({} as Record<T, any>)

  useEffect(() => {
    const refs = timeoutRefs.current
    return () => {
      Object.values(refs).forEach(val => clearTimeout(val as any))
    }
  }, [])

  const trigger = useCallback((val: T) => {
    setState(prev => ({ ...prev, [val]: true }))
    if (timeoutRefs.current[val]) {
      clearTimeout(timeoutRefs.current[val])
    }
    timeoutRefs.current[val] = setTimeout(() => {
      setState(prev => ({ ...prev, [val]: false }))
      delete timeoutRefs.current[val]
    }, delay)
  }, [delay])

  return [state, trigger]
}

export function PlanningPhase() {
  const { activeListId, items, setItems, stores, setItemStoreInfos } = useGrocery()

  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const [addedItems, triggerAdded] = useTimeoutState<string>(2000)

  // Memoize active stores list
  const activeStores = useMemo(() => {
    const list = stores && stores.length > 0 ? stores : DEFAULT_STORES
    return [...list]
      .filter(s => s.listId === activeListId && !s.is_deleted)
      .sort((a, b) => a.position - b.position)
  }, [stores, activeListId])

  // Memoize currently planned items names
  const plannedItems = useMemo(() => {
    return items
      .filter(item => item.listId === activeListId && item.isActive && !item.is_deleted)
      .map(item => item.name)
  }, [items, activeListId])

  // Memoize historical bought items as recommendations source
  const dynamicRecs = useMemo(() => {
    return items
      .filter(item => item.listId === activeListId && !item.isActive && !item.is_deleted && item.timesBought > 0)
      .map(item => ({
        name: item.name,
        categoryId: item.categoryId || '1',
        storeId: selectedStoreId || '',
        timesBought: item.timesBought
      }))
  }, [items, activeListId, selectedStoreId])

  // Memoize recommendation merging & sorting operations
  const filteredRecs = useMemo(() => {
    const recs = [...dynamicRecs]
    DEFAULT_RECOMMENDATIONS.forEach(def => {
      if (!recs.some(r => r.name.toLowerCase() === def.name.toLowerCase())) {
        recs.push(def)
      }
    })

    return recs
      .filter(rec => !plannedItems.some(pName => pName.toLowerCase() === rec.name.toLowerCase()))
      .filter(rec => selectedStoreId === null || rec.storeId === selectedStoreId)
      .sort((a, b) => b.timesBought - a.timesBought)
      .slice(0, 10)
  }, [dynamicRecs, plannedItems, selectedStoreId])

  const handleAddRecommendation = useCallback((itemName: string) => {
    if (addedItems[itemName]) return

    triggerAdded(itemName)

    const itemId = generateUuid()
    const newItem: GroceryItem = {
      id: itemId,
      name: itemName,
      quantity: '1',
      isBought: false,
      createdAt: Date.now(),
      position: items.length + 1,
      categoryId: '1',
      timesBought: 1,
      isActive: true,
      listId: activeListId,
      sync_state: 'PENDING_INSERT',
      version: 1,
      is_deleted: false,
    }

    setItems(prev => [...prev, newItem])

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
  }, [addedItems, items.length, setItems, activeListId, selectedStoreId, setItemStoreInfos, triggerAdded])

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
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

      {/* The tray and the list. Stacked on a phone; side by side at 40/60 once the
          content column can carry two panes, which is the arrangement the Android
          tablet layout uses. */}
      <div className="planning-panes">

        {/* Recommendation Tray */}
        <div className="space-y-2.5">
          {/* Wraps rather than squeezes: in the two-pane layout this header lives
              in the narrower of the two panes. */}
          <div className="flex items-center justify-between flex-wrap gap-x-2 gap-y-0.5 px-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <h4 className="text-xs font-bold tracking-widest text-text-muted uppercase">
                Smart Recommendations
              </h4>
            </div>
            <span className="text-[10px] text-neutral-500">Based on historical purchases</span>
          </div>

          {/* The recommendation grid's 140px is deliberately below the item tiles'
              160px: it is still two columns on a phone, and two rather than one in
              the narrower of the two panes on a tablet. */}
          {filteredRecs.length === 0 ? (
            <div className="bg-surface-tile border border-neutral-900 rounded-xl p-6 text-center">
              <AlertCircle className="w-5 h-5 text-neutral-500 mx-auto mb-2" />
              <p className="text-sm text-text-muted">No recommendations for this store yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
              {filteredRecs.map((rec) => {
                const isAdded = addedItems[rec.name]

                return (
                  <button
                    key={rec.name}
                    onClick={() => handleAddRecommendation(rec.name)}
                    disabled={isAdded}
                    className={cn(
                      "flex flex-col justify-between items-start text-left p-3 h-12 rounded-lg border transition-all cursor-pointer",
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
    </div>
  )
}
