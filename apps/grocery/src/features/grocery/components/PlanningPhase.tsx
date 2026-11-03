import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import { Plus, Check, Sparkles, AlertCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { DEFAULT_RECOMMENDATIONS } from '../config/constants'
import { recommendationsFromHistory } from '../utils/recommendations'
import { MIN_RECOMMENDATIONS, TRAY_MIN_HEIGHT_PX, recommendationsThatFit } from '../utils/recommendationLimit'
import { addOrReuseItem } from '../utils/addItem'
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

// How often Planning re-reads the clock, so an item bought 36 hours ago comes back to the
// tray on a tab left open rather than only when something else changes.
const RECENT_PURCHASE_REFRESH_MS = 10 * 60 * 1000

// The current time, refreshed every `intervalMs`. Kept in state so rendering stays pure.
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function useRecommendationLimit(): [(el: HTMLDivElement | null) => void, number] {
  const [limit, setLimit] = useState(MIN_RECOMMENDATIONS)
  const observer = useRef<ResizeObserver | null>(null)

  const ref = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!el || typeof ResizeObserver === 'undefined') return
    observer.current = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setLimit(recommendationsThatFit(width, height))
    })
    observer.current.observe(el)
  }, [])

  return [ref, limit]
}

export function PlanningPhase() {
  const { activeListId, items, setItems } = useGrocery()

  const [addedItems, triggerAdded] = useTimeoutState<string>(2000)

  // Memoize currently planned items names
  const plannedItems = useMemo(() => {
    return items
      .filter(item => item.listId === activeListId && item.isActive && !item.is_deleted)
      .map(item => item.name)
  }, [items, activeListId])

  // Memoize historical bought items as recommendations source. Anything a trip bought in the
  // last 36 hours is left out.
  const now = useNow(RECENT_PURCHASE_REFRESH_MS)
  const dynamicRecs = useMemo(
    () => recommendationsFromHistory(items, activeListId, now),
    [items, activeListId, now]
  )

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
      .sort((a, b) => b.timesBought - a.timesBought)
  }, [dynamicRecs, plannedItems])

  const [trayRef, recLimit] = useRecommendationLimit()
  const shownRecs = useMemo(() => filteredRecs.slice(0, recLimit), [filteredRecs, recLimit])

  // A recommendation is a row the list already has, so tapping one brings that row back
  // rather than inserting a twin of it. The insert path is only for a recommendation with no
  // row behind it -- a built-in default.
  const handleAddRecommendation = useCallback((itemName: string) => {
    if (addedItems[itemName]) return

    triggerAdded(itemName)

    // Where an item is bought is not a question while planning -- there is one list -- so
    // adding from here tags no store. Shopping's checkout is where a store mapping is made.
    setItems(prev => addOrReuseItem(
      prev,
      { name: itemName, listId: activeListId },
      () => ({
        id: generateUuid(),
        name: itemName,
        quantity: '1',
        isBought: false,
        createdAt: Date.now(),
        position: prev.length + 1,
        categoryId: undefined,
        timesBought: 1,
        isActive: true,
        listId: activeListId,
        sync_state: 'PENDING_INSERT',
        version: 1,
        is_deleted: false,
      })
    ).items)
  }, [addedItems, setItems, activeListId, triggerAdded])

  return (
    // flex-1 down to the tray: the page fills the shell's column, the list takes the height
    // its rows need, and the tray takes whatever is left -- so a short list leaves room
    // for more suggestions rather than for empty screen.
    <div className="flex-1 flex flex-col animate-in fade-in duration-200">
      {/* The tray and the list. Stacked on a phone; side by side at 40/60 once the
          content column can carry two panes, which is the arrangement the Android
          tablet layout uses. */}
      <div className="planning-panes flex-1">

        {/* Recommendation Tray */}
        <div className="flex flex-col gap-2.5 min-h-0">
          <div className="flex items-center gap-1.5 px-1 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
            <h4 className="text-xs font-bold tracking-widest text-text-muted uppercase truncate">
              Recommendations
            </h4>
          </div>

          {/* The recommendation grid's 140px is deliberately below the item tiles'
              160px: it is still two columns on a phone, and two rather than one in
              the narrower of the two panes on a tablet. */}
          {filteredRecs.length === 0 ? (
            <div className="bg-surface-tile border border-line-faint rounded-xl p-6 text-center">
              <AlertCircle className="w-5 h-5 text-text-subtle mx-auto mb-2" />
              <p className="text-sm text-text-muted">Nothing to recommend yet.</p>
            </div>
          ) : (
            // The grid is absolutely placed so that the box measured is the room the layout
            // gave the tray, not the grid's own content -- otherwise a tray once grown would
            // hold its height when the list got longer.
            <div ref={trayRef} className="relative flex-1" style={{ minHeight: TRAY_MIN_HEIGHT_PX }}>
            <div className="absolute inset-0 overflow-y-auto grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] content-start gap-2.5">
              {shownRecs.map((rec) => {
                const isAdded = addedItems[rec.name]

                return (
                  <button
                    key={rec.name}
                    onClick={() => handleAddRecommendation(rec.name)}
                    disabled={isAdded}
                    // A suggestion is a tinted pill with the + leading, so it reads at a glance as
                    // not yet on the list -- unlike the list's own rows, which are square and grey.
                    className={cn(
                      "flex items-center gap-1.5 text-left px-3 h-9 rounded-full border transition-all cursor-pointer min-w-0",
                      isAdded
                        ? "bg-success/10 border-success/40 text-success-strong"
                        : "bg-primary/10 border-primary/40 text-primary hover:bg-primary/20"
                    )}
                  >
                    {isAdded
                      ? <Check className="w-3.5 h-3.5 shrink-0" />
                      : <Plus className="w-3.5 h-3.5 shrink-0" />}
                    <span className="text-xs font-semibold truncate">
                      {rec.name}
                    </span>
                  </button>
                )
              })}
            </div>
            </div>
          )}
        </div>

        {/* Current List Progress */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold tracking-widest text-text-muted px-1 uppercase">
            Your List
          </h4>

          <div className="bg-surface-tile border border-line-faint rounded-xl divide-y divide-line-faint overflow-hidden">
            {plannedItems.map((itemName, index) => (
              <div key={index} className="flex items-center justify-between p-3.5 text-sm">
                <span className="font-medium text-text-primary">{itemName}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
