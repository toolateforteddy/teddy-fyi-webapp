import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import api from '@/lib/axios'
import { STORAGE_KEYS } from '@/config/storageKeys'
import { storage } from '@/utils/storage'
import { generateUuid, getClientUuid } from '@/utils/uuid'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { rowUserId } from '@/features/auth/utils/identity'
import type { TodoItem, TodoList, TodoMode } from './types'
import { formatTitle, nextPosition, nextRecurrenceTime, positionChanges, resetsDue, todayIso, type Move } from './rules'
import { mergeItems, mergeLists, runTodoSync } from './sync'

/** How long a just-ticked task stays on screen, struck through. */
const RECENTLY_COMPLETED_MS = 2000
/** A local edit goes up this long after the last one, so a burst of taps is one request. */
const PUSH_DEBOUNCE_MS = 1000
/**
 * How often an open app asks whether another device changed anything. The API sends no
 * stream events for todo rows, so this is the freshness. The check is a cached status read.
 */
const POLL_MS = 45_000

const MODES: readonly TodoMode[] = ['BACKLOG', 'PLANNING', 'TODAY', 'SCHEDULED']

export interface TodoContextValue {
  items: TodoItem[]
  /** Not deleted, in this device's order. */
  lists: TodoList[]
  mode: TodoMode
  setMode: (mode: TodoMode) => void
  selectedListId: string | null
  setSelectedListId: (id: string | null) => void
  recentlyCompleted: ReadonlySet<string>
  pendingCount: number
  syncing: boolean
  syncError: string | null
  lastSyncedAt: string | null
  syncNow: () => void

  addItem: (title: string, options?: { parentId?: string | null; scheduledDate?: string | null }) => void
  updateItem: (id: string, patch: Partial<TodoItem>) => void
  toggleComplete: (item: TodoItem, checked: boolean) => void
  deleteItem: (id: string) => void
  moveItem: (item: TodoItem, move: Move) => void
  assignIcon: (item: TodoItem) => Promise<boolean>
  clearAll: () => void

  addList: (name: string, colorHex: string) => void
  updateList: (id: string, patch: Pick<TodoList, 'name' | 'colorHex'>) => void
  deleteList: (id: string) => void
  reorderLists: (orderedIds: string[]) => void
}

const TodoContext = createContext<TodoContextValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useTodo(): TodoContextValue {
  const value = useContext(TodoContext)
  if (!value) throw new Error('useTodo must be used inside TodoProvider')
  return value
}

/** A row's change, marking it for upload unless it is already waiting to be inserted. */
function touched<T extends { syncState: TodoItem['syncState'] }>(row: T, patch: Partial<T>): T {
  return { ...row, ...patch, syncState: row.syncState === 'PENDING_INSERT' ? 'PENDING_INSERT' : 'PENDING_UPDATE' }
}

function usePersisted<T>(key: string, fallback: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => storage.getItem<T>(key, fallback))
  useEffect(() => {
    storage.setItem(key, value)
  }, [key, value])
  // Another tab of this app edited the same list.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) setValue(storage.getItem<T>(key, fallback))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
    // `fallback` is a literal at every call site; depending on it would re-subscribe every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return [value, setValue]
}

export function TodoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const owner = rowUserId(user) ?? null

  const [items, setItems] = usePersisted<TodoItem[]>(STORAGE_KEYS.ITEMS, [])
  const [allLists, setAllLists] = usePersisted<TodoList[]>(STORAGE_KEYS.LISTS, [])
  const [listOrder, setListOrder] = usePersisted<Record<string, number>>(STORAGE_KEYS.LIST_ORDER, {})
  const [mode, setMode] = usePersisted<TodoMode>(STORAGE_KEYS.MODE, 'BACKLOG')
  const [selectedListId, setSelectedListId] = usePersisted<string | null>(STORAGE_KEYS.SELECTED_LIST_ID, null)
  const [lastSyncedAt, setLastSyncedAt] = usePersisted<string | null>(STORAGE_KEYS.LAST_SYNCED, null)
  const [recentlyCompleted, setRecentlyCompleted] = useState<ReadonlySet<string>>(new Set())
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  // The latest state, for a sync that started a render ago.
  const latest = useRef({ items, allLists, lastSyncedAt })
  useEffect(() => {
    latest.current = { items, allLists, lastSyncedAt }
  }, [items, allLists, lastSyncedAt])

  const lists = useMemo(
    () =>
      allLists
        .filter((l) => !l.isDeleted)
        .sort((a, b) => (listOrder[a.id] ?? Infinity) - (listOrder[b.id] ?? Infinity) || a.createdAt - b.createdAt),
    [allLists, listOrder],
  )

  const pendingCount = useMemo(
    () => items.filter((i) => i.syncState !== 'SYNCED').length + allLists.filter((l) => l.syncState !== 'SYNCED').length,
    [items, allLists],
  )

  // --- sync ------------------------------------------------------------------------------

  const inFlight = useRef(false)
  const again = useRef(false)

  const sync = useCallback(
    async (force = false) => {
      if (inFlight.current) {
        // One more round once this one lands, so a change made mid-request is not left
        // waiting for the next poll.
        again.current = true
        return
      }
      inFlight.current = true
      setSyncing(true)
      let forceThisRound = force
      try {
        do {
          again.current = false
          const { items: nowItems, allLists: nowLists, lastSyncedAt: since } = latest.current
          const result = await runTodoSync({
            items: nowItems,
            lists: nowLists,
            lastSyncedAt: since,
            clientId: getClientUuid(),
            force: forceThisRound,
          })
          forceThisRound = false
          if (result) {
            setAllLists((prev) => mergeLists(prev, result))
            setItems((prev) => mergeItems(prev, result))
            setLastSyncedAt(result.serverTimestamp)
          }
          setSyncError(null)
          // Long enough for React to render the merge, which is what refreshes `latest`.
          if (again.current) await new Promise((resolve) => setTimeout(resolve, 300))
        } while (again.current)
      } catch (error) {
        console.error('[Todo sync] failed:', error)
        // The poll is the retry.
        setSyncError(navigator.onLine === false ? 'Offline. Changes will sync when you reconnect.' : 'Sync failed. Retrying soon.')
      } finally {
        inFlight.current = false
        setSyncing(false)
      }
    },
    [setAllLists, setItems, setLastSyncedAt],
  )

  const syncNow = useCallback(() => void sync(true), [sync])

  // Push local changes a moment after the last one.
  useEffect(() => {
    if (pendingCount === 0) return
    const timer = setTimeout(() => void sync(), PUSH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [pendingCount, items, allLists, sync])

  // --- the scheduled resets ----------------------------------------------------------------

  const runResets = useCallback(() => {
    const now = Date.now()
    const lastReset = storage.getItem<number>(STORAGE_KEYS.LAST_RESET_TIME, 0)
    const due = resetsDue(lastReset, now)
    storage.setItem(STORAGE_KEYS.LAST_RESET_TIME, now)
    if (!due.rollover && !due.daily) return
    const today = todayIso(now)
    setItems((prev) =>
      prev.map((item) => {
        if (item.isDeleted) return item
        if (due.rollover && !item.isCompleted && !item.isDaily && item.scheduledDate !== null && item.scheduledDate < today) {
          return touched(item, { lastScheduledDate: item.scheduledDate, scheduledDate: null })
        }
        if (due.daily && item.isDaily && (item.isCompleted || item.scheduledDate !== today)) {
          return touched(item, { isCompleted: false, scheduledDate: today })
        }
        return item
      }),
    )
  }, [setItems])

  // A launcher shortcut names its tab (`/?mode=TODAY`); otherwise open on Today when there
  // is something for today, as Android does.
  const openOnLaunchTab = useCallback(() => {
    const params = new URLSearchParams(window.location.search)
    const requested = params.get('mode')
    if (requested && (MODES as readonly string[]).includes(requested)) {
      setMode(requested as TodoMode)
      params.delete('mode')
      const rest = params.toString()
      window.history.replaceState(window.history.state, '', window.location.pathname + (rest ? `?${rest}` : ''))
    } else {
      const today = todayIso()
      if (latest.current.items.some((i) => !i.isDeleted && !i.isCompleted && i.scheduledDate === today)) setMode('TODAY')
    }
  }, [setMode])

  // On open, on coming back, on the network returning, and on a timer while visible.
  useEffect(() => {
    // Deferred a tick so the first render commits before any of this sets state.
    const start = setTimeout(() => {
      runResets()
      void sync()
      openOnLaunchTab()
    }, 0)

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      runResets()
      void sync()
    }
    const onOnline = () => void sync()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') void sync()
    }, POLL_MS)
    return () => {
      clearTimeout(start)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      clearInterval(poll)
    }
    // Once per mount; the callbacks are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- items -------------------------------------------------------------------------------

  const addItem = useCallback<TodoContextValue['addItem']>(
    (raw, options = {}) => {
      const title = formatTitle(raw)
      if (!title) return
      const now = Date.now()
      setItems((prev) => {
        const parentId = options.parentId ?? null
        const parent = parentId ? prev.find((i) => i.id === parentId) : undefined
        const item: TodoItem = {
          id: generateUuid(),
          title,
          isCompleted: false,
          createdAt: now,
          position: nextPosition(prev, parentId),
          scheduledDate: options.scheduledDate ?? null,
          recurrenceRule: null,
          scheduledAt: now,
          userId: owner,
          parentId,
          isDaily: false,
          dueDate: null,
          description: null,
          listId: parent ? parent.listId : selectedListId,
          priority: 0,
          icon: null,
          lastScheduledDate: null,
          syncState: 'PENDING_INSERT',
          version: 1,
          isDeleted: false,
        }
        return [...prev, item]
      })
    },
    [owner, selectedListId, setItems],
  )

  const updateItem = useCallback<TodoContextValue['updateItem']>(
    (id, patch) => {
      setItems((prev) => {
        const current = prev.find((i) => i.id === id)
        if (!current) return prev
        const normalized = patch.title !== undefined ? { ...patch, title: formatTitle(patch.title) || current.title } : patch
        const updated = touched(current, normalized)
        return prev.map((item) => {
          if (item.id === id) return updated
          // A parent's date and space flow down to its subtasks (`TodoRepository.updateItem`).
          if (item.parentId !== id || item.isDeleted) return item
          const cascade: Partial<TodoItem> = {}
          if (item.listId !== updated.listId) cascade.listId = updated.listId
          if (updated.scheduledDate !== null && !item.isCompleted && item.scheduledDate === null) {
            cascade.scheduledDate = updated.scheduledDate
          }
          return Object.keys(cascade).length ? touched(item, cascade) : item
        })
      })
    },
    [setItems],
  )

  const toggleComplete = useCallback<TodoContextValue['toggleComplete']>(
    (item, checked) => {
      if (!checked) {
        setRecentlyCompleted((prev) => {
          const next = new Set(prev)
          next.delete(item.id)
          return next
        })
        updateItem(item.id, { isCompleted: false })
        return
      }
      setRecentlyCompleted((prev) => new Set(prev).add(item.id))
      setTimeout(() => {
        setRecentlyCompleted((prev) => {
          const next = new Set(prev)
          next.delete(item.id)
          return next
        })
      }, RECENTLY_COMPLETED_MS)
      if (item.recurrenceRule) {
        // A recurring task is never finished; it goes away until it next comes round.
        updateItem(item.id, {
          isCompleted: false,
          scheduledAt: nextRecurrenceTime(Date.now(), item.recurrenceRule),
          scheduledDate: null,
        })
      } else {
        updateItem(item.id, { isCompleted: true })
      }
    },
    [updateItem],
  )

  const deleteItem = useCallback<TodoContextValue['deleteItem']>(
    (id) => {
      setItems((prev) => {
        // Subtasks go with their parent: Android leaves them as hidden orphans.
        const doomed = new Set([id, ...prev.filter((i) => i.parentId === id).map((i) => i.id)])
        return prev.flatMap((item) => {
          if (!doomed.has(item.id)) return [item]
          // Never sent, so there is nothing on the server to delete.
          if (item.syncState === 'PENDING_INSERT') return []
          return [{ ...item, isDeleted: true, syncState: 'PENDING_DELETE' as const }]
        })
      })
    },
    [setItems],
  )

  const moveItem = useCallback<TodoContextValue['moveItem']>(
    (item, move) => {
      setItems((prev) => {
        const changes = new Map(positionChanges(prev, item, move))
        if (changes.size === 0) return prev
        return prev.map((i) => (changes.has(i.id) ? touched(i, { position: changes.get(i.id)! }) : i))
      })
    },
    [setItems],
  )

  const assignIcon = useCallback<TodoContextValue['assignIcon']>(
    async (item) => {
      try {
        const response = await api.post<{ emoji_or_asset_token: string }>('/api/assign-icon', { todo_title: item.title })
        const icon = response.data.emoji_or_asset_token
        if (!icon) return false
        updateItem(item.id, { icon })
        return true
      } catch {
        return false
      }
    },
    [updateItem],
  )

  const clearAll = useCallback(() => {
    setItems((prev) =>
      prev.flatMap((item) =>
        item.syncState === 'PENDING_INSERT' ? [] : [{ ...item, isDeleted: true, syncState: 'PENDING_DELETE' as const }],
      ),
    )
  }, [setItems])

  // --- spaces ------------------------------------------------------------------------------

  const addList = useCallback<TodoContextValue['addList']>(
    (raw, colorHex) => {
      const name = formatTitle(raw)
      if (!name) return
      const id = generateUuid()
      setAllLists((prev) => [
        ...prev,
        { id, name, colorHex, userId: owner, createdAt: Date.now(), syncState: 'PENDING_INSERT', version: 1, isDeleted: false },
      ])
      setListOrder((prev) => ({ ...prev, [id]: Math.max(-1, ...Object.values(prev)) + 1 }))
    },
    [owner, setAllLists, setListOrder],
  )

  const updateList = useCallback<TodoContextValue['updateList']>(
    (id, patch) => {
      setAllLists((prev) =>
        prev.map((l) => (l.id === id ? touched(l, { ...patch, name: formatTitle(patch.name) || l.name }) : l)),
      )
    },
    [setAllLists],
  )

  const deleteList = useCallback<TodoContextValue['deleteList']>(
    (id) => {
      // The server does not cascade, so the items leave the space here and say so upstream.
      setItems((prev) => prev.map((i) => (i.listId === id && !i.isDeleted ? touched(i, { listId: null }) : i)))
      setAllLists((prev) =>
        prev.flatMap((l) => {
          if (l.id !== id) return [l]
          if (l.syncState === 'PENDING_INSERT') return []
          return [{ ...l, isDeleted: true, syncState: 'PENDING_DELETE' as const }]
        }),
      )
      if (selectedListId === id) setSelectedListId(null)
    },
    [selectedListId, setAllLists, setItems, setSelectedListId],
  )

  const reorderLists = useCallback<TodoContextValue['reorderLists']>(
    (orderedIds) => setListOrder(Object.fromEntries(orderedIds.map((id, index) => [id, index]))),
    [setListOrder],
  )

  const value: TodoContextValue = {
    items,
    lists,
    mode,
    setMode,
    selectedListId,
    setSelectedListId,
    recentlyCompleted,
    pendingCount,
    syncing,
    syncError,
    lastSyncedAt,
    syncNow,
    addItem,
    updateItem,
    toggleComplete,
    deleteItem,
    moveItem,
    assignIcon,
    clearAll,
    addList,
    updateList,
    deleteList,
    reorderLists,
  }

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>
}
