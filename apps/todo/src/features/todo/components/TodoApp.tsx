import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import {
  CalendarClock,
  CalendarDays,
  CheckCheck,
  CloudOff,
  Inbox,
  ListChecks,
  LogOut,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sun,
  Trash2,
  X,
  ArrowUpDown,
} from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import { InstallBanner } from '@/features/pwa/components/InstallBanner'
import { InstallCard } from '@/features/pwa/components/InstallCard'
import { UpdateBanner } from '@/features/pwa/components/UpdateBanner'
import type { TodoItem, TodoList, TodoMode } from '../types'
import { useTodo } from '../TodoContext'
import { addDays, dateBucketLabel, parseIso, searchGroups, todayCountsByList, todayIso, viewGroups, type ItemGroup } from '../rules'
import { ItemRow } from './ItemRow'
import { ItemSheet } from './ItemSheet'
import { ReorderSpacesSheet, SpaceSheet } from './SpaceSheets'
import { Sheet, SheetAction, primaryButtonClass, quietButtonClass } from './Sheet'
import { PlainTextField } from './PlainTextField'

const FALLBACK_COLOR = 'var(--palette-primary)'

const TABS: ReadonlyArray<{ mode: TodoMode; label: string; icon: ReactNode }> = [
  { mode: 'BACKLOG', label: 'Backlog', icon: <Inbox className="w-5 h-5" /> },
  { mode: 'PLANNING', label: 'Planning', icon: <CalendarDays className="w-5 h-5" /> },
  { mode: 'TODAY', label: 'Today', icon: <Sun className="w-5 h-5" /> },
  { mode: 'SCHEDULED', label: 'Scheduled', icon: <CalendarClock className="w-5 h-5" /> },
]

function titleFor(mode: TodoMode, completed: boolean): string {
  switch (mode) {
    case 'BACKLOG':
      return completed ? 'Completed Backlog' : 'Backlog'
    case 'SCHEDULED':
      return completed ? 'Completed Future' : 'Future'
    case 'PLANNING':
      return 'Planning'
    case 'TODAY':
      return "Today's Tasks"
  }
}

/** The todo screen (`TodoScreen.kt`): four tabs over one list of tasks. */
export function TodoApp() {
  const todo = useTodo()
  const { mode, setMode, lists, items, selectedListId, setSelectedListId, recentlyCompleted } = todo
  const online = useOnlineStatus()

  const [showCompleted, setShowCompleted] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [planningDate, setPlanningDate] = useState(() => todayIso())
  const [openItem, setOpenItem] = useState<TodoItem | null>(null)
  const [spaceSheet, setSpaceSheet] = useState<TodoList | 'new' | null>(null)
  const [reordering, setReordering] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  // The add-task field has focus, so the keyboard is up. The tab bar steps aside for it, and
  // the header's spaces and days become what the new task is filed under.
  const [composing, setComposing] = useState(false)
  // Parents whose subtasks are showing; collapsed by default, as on Android.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(storage.getItem<string[]>(STORAGE_KEYS.EXPANDED_PARENTS, [])))
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      storage.setItem(STORAGE_KEYS.EXPANDED_PARENTS, [...next])
      return next
    })

  const now = useNow()
  const today = todayIso(now)
  const searching = mode === 'BACKLOG' && searchOpen && query.trim() !== ''

  const groups = useMemo<ItemGroup[]>(
    () =>
      searching
        ? searchGroups(items, query, selectedListId, now)
        : viewGroups(items, { mode, selectedListId, showCompletedOnly: showCompleted, recentlyCompleted, now }),
    [items, mode, selectedListId, showCompleted, recentlyCompleted, searching, query, now],
  )

  // Every subtask a parent has, not only the ones this view lists: the collapsed count says
  // how far along the whole task is.
  const subtaskCounts = useMemo(() => {
    const counts = new Map<string, { done: number; total: number }>()
    for (const item of items) {
      if (!item.parentId || item.isDeleted) continue
      const count = counts.get(item.parentId) ?? { done: 0, total: 0 }
      count.total += 1
      if (item.isCompleted || recentlyCompleted.has(item.id)) count.done += 1
      counts.set(item.parentId, count)
    }
    return counts
  }, [items, recentlyCompleted])

  const colorOf = (item: TodoItem) => lists.find((l) => l.id === item.listId)?.colorHex ?? FALLBACK_COLOR

  const chips = useMemo(() => {
    if (mode !== 'TODAY' || editMode) return lists.map((l) => ({ list: l, label: l.name }))
    const counts = todayCountsByList(items, now)
    return lists
      .filter((l) => (counts.get(l.id) ?? 0) > 0)
      .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
      .map((l) => ({ list: l, label: `${l.name} (${counts.get(l.id)})` }))
  }, [lists, items, mode, editMode, now])

  const showInput = (!showCompleted || searchOpen) && mode !== 'TODAY' && mode !== 'SCHEDULED' && !editMode
  const keyboardUp = composing && showInput
  const selectedList = lists.find((l) => l.id === selectedListId) ?? null

  const toggle = (item: TodoItem, checked: boolean) => {
    if (mode === 'PLANNING' && !showCompleted) {
      // In Planning the box means "planned for the day picked above".
      todo.updateItem(item.id, { scheduledDate: checked ? planningDate : null })
      return
    }
    todo.toggleComplete(item, checked)
  }
  const isChecked = (item: TodoItem) =>
    mode === 'PLANNING' && !showCompleted ? item.scheduledDate === planningDate : item.isCompleted || recentlyCompleted.has(item.id)

  const row = (item: TodoItem, isChild: boolean, hasChildren = false) => (
    <ItemRow
      key={item.id}
      item={item}
      color={colorOf(item)}
      checked={isChecked(item)}
      struck={item.isCompleted || recentlyCompleted.has(item.id)}
      isChild={isChild}
      editMode={editMode}
      showDate={mode === 'PLANNING' || searching}
      onToggle={(checked) => toggle(item, checked)}
      onOpen={() => setOpenItem(item)}
      onStar={() => todo.updateItem(item.id, { priority: item.priority >= 2 ? 0 : 2 })}
      onMove={(move) => todo.moveItem(item, move)}
      subtasks={hasChildren ? subtaskCounts.get(item.id) : undefined}
      expanded={searching || expanded.has(item.id)}
      onToggleExpand={searching ? undefined : () => toggleExpanded(item.id)}
    />
  )

  const groupBlock = (group: ItemGroup) => (
    <div key={group.parent.id} className="flex flex-col gap-1.5">
      {row(group.parent, false, group.children.length > 0)}
      {/* A search shows every match, so it never hides one under a collapsed parent. */}
      {(searching || expanded.has(group.parent.id)) && group.children.map((child) => row(child, true))}
    </div>
  )

  let body: ReactNode
  if (groups.length === 0) {
    body = <EmptyState mode={mode} completed={showCompleted} searching={searching} />
  } else if (mode === 'SCHEDULED' && !showCompleted) {
    const buckets = new Map<string, ItemGroup[]>()
    for (const group of groups) {
      const key = group.parent.scheduledDate ?? ''
      buckets.set(key, [...(buckets.get(key) ?? []), group])
    }
    body = [...buckets.entries()].map(([date, bucket]) => (
      <section key={date} className="flex flex-col gap-1.5">
        <h3 className="sticky top-0 z-10 bg-canvas py-1.5 text-[11px] font-bold tracking-widest uppercase text-primary">
          {dateBucketLabel(date, now)}
        </h3>
        {bucket.map(groupBlock)}
      </section>
    ))
  } else {
    body = groups.map(groupBlock)
  }

  return (
    <div className="min-h-dvh bg-canvas text-text-primary flex flex-col items-center font-sans antialiased">
      <div className="app-frame min-h-dvh flex flex-col">
        <header className="sticky top-0 z-20 bg-canvas/95 backdrop-blur pt-[env(safe-area-inset-top)] app-chrome">
          <div className="flex items-center gap-1 px-4 h-14">
            <h1 className="flex-1 text-lg font-black tracking-tight truncate">{titleFor(mode, showCompleted)}</h1>
            <SyncIndicator online={online} />
            {mode === 'BACKLOG' && (
              <IconButton label={searchOpen ? 'Close search' : 'Search'} onClick={() => (searchOpen ? (setSearchOpen(false), setQuery('')) : setSearchOpen(true))}>
                {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
              </IconButton>
            )}
            <IconButton label={showCompleted ? 'Show open tasks' : 'Show completed'} pressed={showCompleted} onClick={() => setShowCompleted((v) => !v)}>
              <CheckCheck className="w-5 h-5" />
            </IconButton>
            <IconButton label={editMode ? 'Done editing' : 'Edit'} pressed={editMode} onClick={() => setEditMode((v) => !v)}>
              <Pencil className="w-5 h-5" />
            </IconButton>
            <IconButton label="Menu" onClick={() => setMenuOpen(true)}>
              <Menu className="w-5 h-5" />
            </IconButton>
          </div>

          {mode === 'BACKLOG' && searchOpen && (
            <div className="px-4 pb-2">
              <PlainTextField
                autoFocus
                label="Search tasks"
                placeholder="Search tasks"
                enterKeyHint="search"
                value={query}
                onChange={setQuery}
                className="w-full bg-inset border border-line focus:border-primary outline-none text-sm px-3 py-2 rounded-lg"
              />
            </div>
          )}

          {(lists.length > 0 || editMode) && (
            <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
              <Chip selected={selectedListId === null} color={FALLBACK_COLOR} keepFocus onClick={() => setSelectedListId(null)}>
                All
              </Chip>
              {chips.map(({ list, label }) => (
                <Chip
                  key={list.id}
                  keepFocus={!editMode}
                  selected={selectedListId === list.id}
                  color={list.colorHex}
                  onClick={() => (editMode ? setSpaceSheet(list) : setSelectedListId(list.id))}
                >
                  {label}
                  {editMode && <Pencil className="w-3 h-3 opacity-60" />}
                </Chip>
              ))}
              {editMode && (
                <>
                  <Chip selected={false} onClick={() => setSpaceSheet('new')} label="Add space">
                    <Plus className="w-3.5 h-3.5" />
                  </Chip>
                  {lists.length > 1 && (
                    <Chip selected={false} onClick={() => setReordering(true)} label="Reorder spaces">
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </Chip>
                  )}
                </>
              )}
            </div>
          )}

          {mode === 'PLANNING' && !showCompleted && <PlanningStrip value={planningDate} onChange={setPlanningDate} today={today} />}
        </header>

        <main
          className={`flex-1 flex flex-col gap-1.5 px-4 pt-2 ${keyboardUp ? 'pb-28' : 'pb-[calc(var(--app-nav-height)+env(safe-area-inset-bottom)+5rem)]'}`}
        >
          {body}
          {editMode && (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="mt-6 self-center flex items-center gap-2 text-xs font-semibold text-danger px-4 py-2 rounded-lg border border-line hover:bg-surface-hover cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Clear all tasks
            </button>
          )}
        </main>

        {showInput && (
          <InputBar
            placeholder={mode === 'PLANNING' ? `Add for ${dateBucketLabel(planningDate, now)}` : 'Add a task'}
            composing={keyboardUp}
            onComposingChange={setComposing}
            space={selectedList ? { name: selectedList.name, color: selectedList.colorHex } : null}
            day={mode === 'PLANNING' ? dateBucketLabel(planningDate, now) : null}
            onAdd={(title) => todo.addItem(title, { scheduledDate: mode === 'PLANNING' ? planningDate : null })}
          />
        )}

        <nav
          hidden={keyboardUp}
          className="fixed bottom-0 inset-x-0 z-20 flex justify-center bg-chassis border-t border-line pb-[env(safe-area-inset-bottom)] app-chrome"
        >
          <div className="app-frame flex h-[var(--app-nav-height)]">
            {TABS.map((tab) => (
              <button
                key={tab.mode}
                type="button"
                aria-current={mode === tab.mode ? 'page' : undefined}
                onClick={() => {
                  setMode(tab.mode)
                  setSearchOpen(false)
                  setQuery('')
                }}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold cursor-pointer ${mode === tab.mode ? 'text-primary' : 'text-text-muted hover:text-text-primary'}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <UpdateBanner />
        <InstallBanner />
      </div>

      {openItem && <ItemSheet item={openItem} onClose={() => setOpenItem(null)} />}
      {spaceSheet && <SpaceSheet space={spaceSheet === 'new' ? null : spaceSheet} onClose={() => setSpaceSheet(null)} />}
      {reordering && <ReorderSpacesSheet onClose={() => setReordering(false)} />}
      {menuOpen && <AppMenu onClose={() => setMenuOpen(false)} />}
      {confirmClear && (
        <Sheet title="Clear all tasks?" onClose={() => setConfirmClear(false)}>
          <p className="text-sm text-text-secondary">
            This will permanently delete all tasks in the database for your account. This action cannot be undone.
          </p>
          <div className="flex gap-2 justify-end mt-4">
            <button type="button" className={quietButtonClass} onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2.5 rounded-lg bg-danger-solid hover:bg-danger-solid-hover text-on-danger text-sm font-semibold cursor-pointer"
              onClick={() => {
                todo.clearAll()
                setConfirmClear(false)
                setEditMode(false)
              }}
            >
              Delete everything
            </button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

/**
 * The clock the views read, ticking twice a minute: a recurring task due back shows, and
 * Today becomes tomorrow at midnight, without a reload.
 */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    const onVisible = () => document.visibilityState === 'visible' && setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return now
}

function IconButton({ label, pressed, onClick, children }: { label: string; pressed?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`p-2 rounded-lg cursor-pointer ${pressed ? 'text-primary bg-surface-hover' : 'text-text-muted hover:text-text-primary'}`}
    >
      {children}
    </button>
  )
}

/**
 * Taps on this control leave focus where it is. On the header's spaces and days that is the
 * add-task field, so picking where a new task goes does not close the keyboard mid-sentence.
 */
const keepFocusHandler = (event: MouseEvent) => event.preventDefault()

function Chip({
  selected,
  color,
  onClick,
  label,
  keepFocus,
  children,
}: {
  selected: boolean
  color?: string
  onClick: () => void
  label?: string
  keepFocus?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onMouseDown={keepFocus ? keepFocusHandler : undefined}
      onClick={onClick}
      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer ${selected ? 'border-primary bg-surface-hover-strong text-text-primary' : 'border-line text-text-secondary hover:bg-surface-hover'}`}
    >
      {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  )
}

/** Seven days from today and a picker for any other (`HexTimeline.kt`). */
function PlanningStrip({ value, onChange, today }: { value: string; onChange: (iso: string) => void; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i))
  const label = (iso: string, index: number) =>
    index === 0 ? 'TODAY' : index === 1 ? 'TMRW' : parseIso(iso).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()
  return (
    <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto">
      {days.map((iso, index) => (
        <button
          key={iso}
          type="button"
          aria-pressed={value === iso}
          onMouseDown={keepFocusHandler}
          onClick={() => onChange(iso)}
          className={`clipped shrink-0 w-12 py-1.5 flex flex-col items-center cursor-pointer ${value === iso ? 'bg-primary text-on-primary' : 'bg-surface-tile text-text-secondary hover:bg-surface-hover'}`}
        >
          <span className="text-[9px] font-bold tracking-wider">{label(iso, index)}</span>
          <span className="text-base font-black leading-tight">{parseIso(iso).getDate()}</span>
        </button>
      ))}
      <label
        className={`clipped shrink-0 w-12 flex items-center justify-center cursor-pointer relative ${days.includes(value) ? 'bg-surface-tile text-text-secondary' : 'bg-primary text-on-primary'}`}
        title="Pick a date"
      >
        <CalendarDays className="w-5 h-5" />
        <input
          type="date"
          aria-label="Pick a date"
          value={value}
          min={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
    </div>
  )
}

/**
 * The add-task field. While it has focus it sits on the keyboard rather than on the tab bar,
 * and says where the task will land: the space picked in the header (none under "All") and,
 * in Planning, the day picked in the strip. Both stay tappable without closing the keyboard.
 */
function InputBar({
  placeholder,
  composing,
  onComposingChange,
  space,
  day,
  onAdd,
}: {
  placeholder: string
  composing: boolean
  onComposingChange: (composing: boolean) => void
  space: { name: string; color: string } | null
  day: string | null
  onAdd: (title: string) => void
}) {
  const [value, setValue] = useState('')
  // A tab switch can unmount the bar with focus still in it, and no blur follows.
  useEffect(() => () => onComposingChange(false), [onComposingChange])
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (!value.trim()) return
        onAdd(value)
        setValue('')
      }}
      className="fixed inset-x-0 z-20 flex justify-center px-4 pointer-events-none"
      style={{
        bottom: composing
          ? 'calc(var(--keyboard-inset) + env(safe-area-inset-bottom) + 0.5rem)'
          : 'calc(var(--app-nav-height) + env(safe-area-inset-bottom) + 0.75rem)',
      }}
    >
      <div className="app-frame flex flex-col gap-1 pointer-events-auto bg-surface-raised border border-line-strong rounded-xl p-1.5 shadow-[var(--shadow-sheet)]">
        {composing && (
          <p className="flex items-center gap-1.5 px-2 pt-0.5 text-[11px] font-semibold text-text-muted app-chrome" aria-live="polite">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: space?.color ?? 'var(--palette-text-faint)' }} />
            <span className="truncate">
              {space ? `In ${space.name}` : 'No space'}
              {day && ` · ${day}`}
            </span>
          </p>
        )}
        <div className="flex gap-2">
          <PlainTextField
            label={placeholder}
            placeholder={placeholder}
            value={value}
            onChange={setValue}
            onFocus={() => onComposingChange(true)}
            onBlur={() => onComposingChange(false)}
            className="flex-1 min-w-0 self-center bg-transparent outline-none text-sm px-2 py-1 text-text-primary"
          />
          {/* Keeps focus too, so several tasks can go in without the keyboard dropping between them. */}
          <button
            type="submit"
            aria-label="Add task"
            disabled={!value.trim()}
            onMouseDown={keepFocusHandler}
            className={`${primaryButtonClass} px-3 py-2`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </form>
  )
}

function EmptyState({ mode, completed, searching }: { mode: TodoMode; completed: boolean; searching: boolean }) {
  let text = 'Nothing here yet.'
  if (searching) text = 'No tasks match.'
  else if (completed) text = 'Nothing completed here yet.'
  else if (mode === 'TODAY') text = 'All clear for today! Time to relax.'
  else if (mode === 'SCHEDULED') text = 'Nothing planned beyond today.'
  else if (mode === 'BACKLOG') text = 'The backlog is empty. Add something below.'
  else if (mode === 'PLANNING') text = 'Tick a task to plan it for the day above.'
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-text-muted">
      <ListChecks className="w-10 h-10 text-text-faint" />
      <p className="text-sm text-center">{text}</p>
    </div>
  )
}

function SyncIndicator({ online }: { online: boolean }) {
  const { syncing, syncError, pendingCount } = useTodo()
  if (!online) {
    return (
      <span className="p-2 text-warning" title="Offline. Changes will sync when you reconnect." aria-label="Offline">
        <CloudOff className="w-4 h-4" />
      </span>
    )
  }
  if (syncError) {
    return (
      <span className="p-2 text-danger" title={syncError} aria-label={syncError}>
        <CloudOff className="w-4 h-4" />
      </span>
    )
  }
  if (syncing || pendingCount > 0) {
    return (
      <span className="p-2 text-pending" title="Syncing" aria-label="Syncing">
        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
      </span>
    )
  }
  return null
}

function AppMenu({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth()
  const { syncNow, lastSyncedAt, pendingCount } = useTodo()
  return (
    <Sheet title="Todo" onClose={onClose}>
      {user && <p className="text-xs text-text-muted mb-2 truncate">Signed in as {user.email}</p>}
      <div className="flex flex-col">
        <SheetAction
          icon={<RefreshCw className="w-4 h-4" />}
          label="Sync now"
          detail={pendingCount > 0 ? `${pendingCount} waiting` : lastSyncedAt ? `Last ${new Date(lastSyncedAt).toLocaleTimeString()}` : null}
          onClick={() => {
            syncNow()
            onClose()
          }}
        />
        <SheetAction icon={<LogOut className="w-4 h-4" />} label="Sign out" onClick={() => void logout()} />
      </div>
      <div className="mt-4">
        <InstallCard />
      </div>
    </Sheet>
  )
}

export default TodoApp
