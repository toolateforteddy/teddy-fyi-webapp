/**
 * The todo rules, ported from the Android app so a task behaves the same on both.
 *
 * Every function here is pure. Dates are local `yyyy-MM-dd` strings throughout, exactly as
 * Android stores them, and every date calculation works on calendar fields rather than on
 * millisecond offsets, so a daylight-saving change never moves a task to the wrong day.
 */
import type { TodoItem } from './types'

// --- titles ---------------------------------------------------------------------------

/**
 * `formatTitle` from `StringUtils.kt`: collapse whitespace, then title-case each word,
 * leaving alone any word with letters but no lowercase ones (an acronym).
 * `"pay  rent"` → `"Pay Rent"`, `"iPhone"` → `"Iphone"`, `"API"` → `"API"`.
 */
export function formatTitle(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const hasLetter = /\p{L}/u.test(word)
      const hasLower = /\p{Ll}/u.test(word)
      if (hasLetter && !hasLower) return word
      const lower = word.toLowerCase()
      const first = lower.search(/\p{L}/u)
      if (first < 0) return lower
      return lower.slice(0, first) + lower.charAt(first).toUpperCase() + lower.slice(first + 1)
    })
    .join(' ')
}

// --- dates ----------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0')

/** A `Date`'s local calendar date. */
export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayIso(now: number = Date.now()): string {
  return isoDate(new Date(now))
}

/** A local date at local midnight. */
export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, days: number): string {
  const date = parseIso(iso)
  date.setDate(date.getDate() + days)
  return isoDate(date)
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

/**
 * Java's `LocalDate.plusMonths`: the day is clamped to the end of a shorter month, so
 * Jan 31 + 1 is Feb 28 (or 29). Never `Date.setMonth`, which overflows into March.
 */
export function plusMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  const year = Math.floor(total / 12)
  const monthIndex = total - year * 12
  const day = Math.min(d, daysInMonth(year, monthIndex))
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`
}

/**
 * Snoozing by months (`TaskSchedulerUtils.kt`): `plusMonths`, except that when the clamp
 * shortened the day the task moves to the 1st of the following month instead — a task due on
 * the 31st is not quietly brought forward. Jan 31 + 1 → Mar 1; Dec 15 + 1 → Jan 15.
 */
export function snoozeMonths(iso: string, months: number): string {
  const base = Number(iso.split('-')[2])
  const target = plusMonths(iso, months)
  if (Number(target.split('-')[2]) < base) {
    const next = plusMonths(target, 1)
    return `${next.slice(0, 8)}01`
  }
  return target
}

/**
 * How a date reads in a header: Today, Tomorrow, a weekday within the week, else the date
 * itself (`formatDateBucket` in `TodoScreen.kt`).
 */
export function dateBucketLabel(iso: string, now: number = Date.now()): string {
  const today = todayIso(now)
  if (iso === today) return 'Today'
  if (iso === addDays(today, 1)) return 'Tomorrow'
  const diff = Math.round((parseIso(iso).getTime() - parseIso(today).getTime()) / 86_400_000)
  if (diff > 1 && diff < 7) return parseIso(iso).toLocaleDateString(undefined, { weekday: 'long' })
  return iso
}

// --- recurrence -----------------------------------------------------------------------

/** The rules the recurrence picker offers, with the exact strings Android stores. */
export const RECURRENCE_OPTIONS: ReadonlyArray<{ label: string; rule: string | null }> = [
  { label: 'None', rule: null },
  { label: 'Every Day', rule: 'FREQ=DAILY;INTERVAL=1' },
  { label: 'Every Week', rule: 'FREQ=DAILY;INTERVAL=7' },
  { label: 'Tuesday & Thursday', rule: 'FREQ=WEEKLY;BYDAY=TU,TH' },
  { label: 'Monday, Wednesday & Friday', rule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR' },
  { label: 'Every Month', rule: 'FREQ=MONTHLY;INTERVAL=1' },
]

export function customDaysRule(days: number): string {
  return `FREQ=DAILY;INTERVAL=${Math.max(1, Math.floor(days) || 1)}`
}

function parseRule(rule: string): Record<string, string> {
  const parts: Record<string, string> = {}
  for (const part of rule.split(';')) {
    const pieces = part.split('=')
    if (pieces.length === 2) parts[pieces[0].trim().toUpperCase()] = pieces[1].trim().toUpperCase()
  }
  return parts
}

/** The label a row shows for its rule (`TodoItemRow.kt`). */
export function recurrenceLabel(rule: string | null): string | null {
  if (!rule) return null
  switch (rule) {
    case 'FREQ=DAILY;INTERVAL=1':
      return 'Every day'
    case 'FREQ=DAILY;INTERVAL=7':
      return 'Every week'
    case 'FREQ=WEEKLY;BYDAY=TU,TH':
      return 'Tuesday & Thursday'
    case 'FREQ=WEEKLY;BYDAY=MO,WE,FR':
      return 'Mon, Wed & Fri'
    case 'FREQ=MONTHLY;INTERVAL=1':
      return 'Every month'
  }
  const parts = parseRule(rule)
  if (parts.FREQ === 'DAILY') return `Every ${parseInt(parts.INTERVAL, 10) || 1} days`
  if (parts.FREQ === 'WEEKLY') return 'Every week'
  if (parts.FREQ === 'MONTHLY') return 'Every month'
  return 'Recurring'
}

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/**
 * When a recurring task comes back, as local midnight in epoch ms
 * (`calculateNextRecurrenceTime`). Weekly with `BYDAY` is the first listed weekday strictly
 * after the base date, and ignores `INTERVAL`, as Android does.
 */
export function nextRecurrenceTime(baseMs: number, rule: string): number {
  const parts = parseRule(rule)
  const freq = parts.FREQ || 'DAILY'
  const interval = parseInt(parts.INTERVAL, 10) || 1
  const base = todayIso(baseMs)
  let next: string
  if (freq === 'WEEKLY') {
    const days = (parts.BYDAY || '')
      .split(',')
      .map((d) => WEEKDAYS.indexOf(d.trim()))
      .filter((d) => d >= 0)
    if (days.length > 0) {
      next = addDays(base, 1)
      while (!days.includes(parseIso(next).getDay())) next = addDays(next, 1)
    } else {
      next = addDays(base, interval * 7)
    }
  } else if (freq === 'MONTHLY') {
    next = plusMonths(base, interval)
  } else {
    next = addDays(base, interval)
  }
  return parseIso(next).getTime()
}

// --- which items show where -------------------------------------------------------------

/** Within a minute of now counts as now, as on Android. */
const RECURRENCE_GRACE_MS = 60_000

/**
 * Android's `getAllItems`: everything not deleted, except a recurring task waiting for its
 * next occurrence.
 */
export function isVisible(item: TodoItem, now: number): boolean {
  return (
    !item.isDeleted &&
    (item.isDaily || item.recurrenceRule === null || item.scheduledAt <= now + RECURRENCE_GRACE_MS || item.isCompleted)
  )
}

export interface ViewOptions {
  mode: 'BACKLOG' | 'PLANNING' | 'TODAY' | 'SCHEDULED'
  selectedListId: string | null
  showCompletedOnly: boolean
  /** Checked a moment ago; kept on screen, struck through, for a beat. */
  recentlyCompleted: ReadonlySet<string>
  now: number
}

export interface ItemGroup {
  parent: TodoItem
  children: TodoItem[]
}

function byDisplayOrder(a: TodoItem, b: TodoItem): number {
  return (
    Number(b.lastScheduledDate !== null) - Number(a.lastScheduledDate !== null) ||
    b.priority - a.priority ||
    a.position - b.position ||
    b.createdAt - a.createdAt
  )
}

/**
 * What a tab shows: parents, each with the children that belong under it there
 * (`TodoViewModel.kt`). A child whose parent is not shown is not shown either.
 */
export function viewGroups(items: readonly TodoItem[], options: ViewOptions): ItemGroup[] {
  const { mode, selectedListId, showCompletedOnly, recentlyCompleted, now } = options
  const today = todayIso(now)

  let base: TodoItem[]
  if (mode === 'SCHEDULED') {
    base = items.filter((i) => !i.isDeleted && i.scheduledDate !== null && i.scheduledDate > today && !i.isCompleted)
  } else if (mode === 'TODAY') {
    // A recurring task scheduled for today shows even while it waits for its next occurrence.
    base = items.filter((i) => !i.isDeleted && (i.scheduledDate === today || isVisible(i, now)))
  } else {
    base = items.filter((i) => isVisible(i, now) && (mode === 'PLANNING' || i.scheduledDate === null))
  }
  if (selectedListId !== null) base = base.filter((i) => i.listId === selectedListId)

  const shown = base
    .filter((i) => (showCompletedOnly ? i.isCompleted : !i.isCompleted || recentlyCompleted.has(i.id)))
    .sort(showCompletedOnly ? (a, b) => b.scheduledAt - a.scheduledAt : byDisplayOrder)
  if (mode === 'SCHEDULED') shown.sort((a, b) => (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? ''))

  const childrenOf = new Map<string, TodoItem[]>()
  for (const item of shown) {
    if (item.parentId === null) continue
    const list = childrenOf.get(item.parentId) ?? []
    list.push(item)
    childrenOf.set(item.parentId, list)
  }
  const parents = shown.filter((i) => i.parentId === null)

  if (mode !== 'TODAY') return parents.map((parent) => ({ parent, children: childrenOf.get(parent.id) ?? [] }))

  return parents
    .filter((p) => p.scheduledDate === today || (childrenOf.get(p.id) ?? []).some((c) => c.scheduledDate === today))
    .map((parent) => ({
      parent,
      children: (childrenOf.get(parent.id) ?? []).filter(
        (c) => c.scheduledDate === today || (parent.scheduledDate === today && c.scheduledDate === null),
      ),
    }))
}

/**
 * How many of today's tasks are in each space: today's unfinished parents and today's
 * children, as the TODAY tab's chips count them.
 */
export function todayCountsByList(items: readonly TodoItem[], now: number): Map<string, number> {
  const today = todayIso(now)
  const counts = new Map<string, number>()
  for (const item of items) {
    if (item.isDeleted || item.isCompleted || item.scheduledDate !== today || item.listId === null) continue
    counts.set(item.listId, (counts.get(item.listId) ?? 0) + 1)
  }
  return counts
}

/**
 * Backlog search, in Android's four tiers: unfinished tasks whose title matches, then those
 * with a matching subtask, then those whose description (or a subtask's) matches, then
 * finished tasks matching anything. Each with all its children.
 */
export function searchGroups(
  items: readonly TodoItem[],
  query: string,
  selectedListId: string | null,
  now: number,
): ItemGroup[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const pool = items.filter((i) => isVisible(i, now) && (selectedListId === null || i.listId === selectedListId))
  const matches = (s: string | null) => (s ?? '').toLowerCase().includes(q)
  const tiers: ItemGroup[][] = [[], [], [], []]
  for (const parent of pool.filter((i) => i.parentId === null).sort(byDisplayOrder)) {
    const children = pool.filter((i) => i.parentId === parent.id).sort(byDisplayOrder)
    const title = matches(parent.title)
    const childTitle = children.some((c) => matches(c.title))
    const description = matches(parent.description) || children.some((c) => matches(c.description))
    const group = { parent, children }
    if (!parent.isCompleted) {
      if (title) tiers[0].push(group)
      else if (childTitle) tiers[1].push(group)
      else if (description) tiers[2].push(group)
    } else if (title || childTitle || description) {
      tiers[3].push(group)
    }
  }
  return tiers.flat()
}

// --- positions ---------------------------------------------------------------------------

/** Siblings share a parent and a space (`TodoPositionUseCases.kt`). */
export function siblingsOf(items: readonly TodoItem[], item: TodoItem): TodoItem[] {
  return items
    .filter((i) => !i.isDeleted && i.parentId === item.parentId && i.listId === item.listId)
    .sort((a, b) => a.position - b.position)
}

/** The position a new item takes: one past its siblings' highest, or 0. */
export function nextPosition(items: readonly TodoItem[], parentId: string | null): number {
  const positions = items.filter((i) => !i.isDeleted && i.parentId === parentId).map((i) => i.position)
  return positions.length ? Math.max(...positions) + 1 : 0
}

export type Move = 'up' | 'down' | 'top' | 'bottom'

/**
 * The position changes a move makes, as `[id, newPosition]` pairs: up and down swap with the
 * neighbour, top and bottom go one past the end.
 */
export function positionChanges(items: readonly TodoItem[], item: TodoItem, move: Move): Array<[string, number]> {
  const siblings = siblingsOf(items, item)
  const index = siblings.findIndex((s) => s.id === item.id)
  if (index < 0) return []
  if (move === 'top') return [[item.id, Math.min(...siblings.map((s) => s.position)) - 1]]
  if (move === 'bottom') return [[item.id, Math.max(...siblings.map((s) => s.position)) + 1]]
  const other = siblings[move === 'up' ? index - 1 : index + 1]
  if (!other) return []
  // Equal positions would swap to the same values and move nothing, so break the tie.
  if (other.position === item.position) {
    return move === 'up' ? [[item.id, other.position - 1]] : [[item.id, other.position + 1]]
  }
  return [
    [item.id, other.position],
    [other.id, item.position],
  ]
}

// --- the two scheduled resets ------------------------------------------------------------

/**
 * Which resets are due (`TodoResetScheduler.kt`): the midnight rollover if a midnight has
 * passed since the last run, and the 08:00 daily reset if an 08:00 has.
 */
export function resetsDue(lastReset: number, now: number): { rollover: boolean; daily: boolean } {
  const midnight = parseIso(todayIso(now)).getTime()
  const eight = new Date(midnight)
  eight.setHours(8)
  return {
    rollover: now >= midnight && lastReset < midnight,
    daily: now >= eight.getTime() && lastReset < eight.getTime(),
  }
}
